import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { TelegramService } from '../notifications/telegram.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SchemaDriftSummary {
  expectedModels: number;
  actualTables: number;
  missingTables: string[];
  extraTables: string[];
  missingColumns: Array<{ table: string; column: string; type: string }>;
  extraColumns: Array<{ table: string; column: string }>;
}

export interface SchemaDriftResult {
  status: 'IN_SYNC' | 'DRIFT_DETECTED';
  checkedAt: string;
  summary: SchemaDriftSummary;
}

/**
 * Parses Prisma schema content and returns persisted models and enums.
 * Pure function reusable across service and testing.
 */
export function parsePrismaSchema(schemaContent: string): {
  models: Map<string, Map<string, { name: string; type: string; isOptional: boolean; isEnum: boolean }>>;
  enums: Set<string>;
} {
  const models = new Map();
  const enums = new Set<string>();

  const enumRegex = /enum\s+(\w+)\s*\{([^}]+)\}/g;
  let enumMatch: RegExpExecArray | null;
  while ((enumMatch = enumRegex.exec(schemaContent)) !== null) {
    enums.add(enumMatch[1]);
  }

  const SCALAR_TYPES = new Set([
    'String',
    'Boolean',
    'Int',
    'BigInt',
    'Float',
    'Decimal',
    'DateTime',
    'Json',
    'Bytes',
  ]);

  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  let modelMatch: RegExpExecArray | null;
  while ((modelMatch = modelRegex.exec(schemaContent)) !== null) {
    const modelName = modelMatch[1];
    const body = modelMatch[2];
    const columns = new Map();

    const lines = body.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('//') || line.startsWith('@@')) continue;

      const parts = line.split(/\s+/);
      if (parts.length < 2) continue;

      const fieldName = parts[0];
      const rawType = parts[1];
      const isOptional = rawType.endsWith('?');
      const isArray = rawType.endsWith('[]');
      const baseType = rawType.replace(/[?[\]]/g, '');

      const isColumn = (SCALAR_TYPES.has(baseType) || enums.has(baseType)) && !isArray;

      if (isColumn) {
        columns.set(fieldName, {
          name: fieldName,
          type: baseType,
          isOptional,
          isEnum: enums.has(baseType),
        });
      }
    }

    models.set(modelName, columns);
  }

  return { models, enums };
}

@Injectable()
export class SchemaDriftService {
  private readonly logger = new Logger(SchemaDriftService.name);

  // Per-admin cooldown to avoid rapid repeated execution (10 seconds)
  private readonly adminLastChecked = new Map<string, number>();

  // Telegram alert flood protection: max 1 notification per 10 minutes (600,000 ms)
  private lastTelegramAlertTimestamp = 0;
  private readonly TELEGRAM_COOLDOWN_MS = 10 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly telegramService: TelegramService,
  ) {}

  /**
   * Resolves schema.prisma file location across different runtime execution contexts.
   */
  public resolveSchemaPath(): string {
    const candidates = [
      path.resolve(process.cwd(), 'apps/api/prisma/schema.prisma'),
      path.resolve(process.cwd(), 'prisma/schema.prisma'),
      path.resolve(__dirname, '../../../prisma/schema.prisma'),
      path.resolve(__dirname, '../../../../prisma/schema.prisma'),
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        return cand;
      }
    }

    throw new Error(`schema.prisma not found. Searched paths: ${candidates.join(', ')}`);
  }

  /**
   * Enforces in-memory per-admin rate limiting (10 seconds interval).
   */
  public checkAdminRateLimit(adminId: string): void {
    const now = Date.now();
    const lastCheck = this.adminLastChecked.get(adminId) || 0;
    const elapsed = now - lastCheck;

    if (elapsed < 10000) {
      const waitSeconds = Math.ceil((10000 - elapsed) / 1000);
      throw new HttpException(
        {
          error: 'TOO_MANY_REQUESTS',
          message: `فحص المخطط متاح مرة واحدة كل 10 ثوانٍ لكل مسؤول. يرجى الانتظار ${waitSeconds} ثانية.`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.adminLastChecked.set(adminId, now);
  }

  /**
   * Inspects database schema strictly in READ-ONLY mode using PrismaService.
   * NOTE: Absolutely NO $executeRaw or DDL mutation is permitted in this service.
   * Only SELECT from information_schema is executed.
   */
  public async inspectDatabaseSchema(): Promise<Map<string, Map<string, unknown>>> {
    const tablesRaw = await this.prisma.$queryRawUnsafe<Array<{ table_name: string }>>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name != '_prisma_migrations'
      ORDER BY table_name;
    `);

    const columnsRaw = await this.prisma.$queryRawUnsafe<
      Array<{
        table_name: string;
        column_name: string;
        data_type: string;
        is_nullable: string;
        column_default: string | null;
      }>
    >(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);

    const dbTables = new Map<string, Map<string, unknown>>();
    for (const row of tablesRaw) {
      dbTables.set(row.table_name, new Map());
    }

    for (const col of columnsRaw) {
      if (col.table_name === '_prisma_migrations') continue;
      if (!dbTables.has(col.table_name)) {
        dbTables.set(col.table_name, new Map());
      }
      dbTables.get(col.table_name)!.set(col.column_name, {
        name: col.column_name,
        dataType: col.data_type,
        isNullable: col.is_nullable === 'YES',
        defaultVal: col.column_default,
      });
    }

    return dbTables;
  }

  /**
   * Compares parsed schema.prisma models with database tables.
   */
  public compareSchemas(
    models: Map<string, Map<string, { name: string; type: string; isOptional: boolean }>>,
    dbTables: Map<string, Map<string, unknown>>,
  ): SchemaDriftSummary {
    const missingTables: string[] = [];
    const extraTables: string[] = [];
    const missingColumns: Array<{ table: string; column: string; type: string }> = [];
    const extraColumns: Array<{ table: string; column: string }> = [];

    // Check models against DB tables
    for (const [modelName, expectedCols] of models.entries()) {
      if (!dbTables.has(modelName)) {
        missingTables.push(modelName);
        continue;
      }

      const actualCols = dbTables.get(modelName)!;
      for (const [colName, colInfo] of expectedCols.entries()) {
        if (!actualCols.has(colName)) {
          missingColumns.push({
            table: modelName,
            column: colName,
            type: colInfo.type + (colInfo.isOptional ? '?' : ''),
          });
        }
      }
    }

    // Check DB tables against models
    for (const [tableName, actualCols] of dbTables.entries()) {
      if (!models.has(tableName)) {
        extraTables.push(tableName);
        continue;
      }

      const expectedCols = models.get(tableName)!;
      for (const colName of actualCols.keys()) {
        if (!expectedCols.has(colName)) {
          extraColumns.push({
            table: tableName,
            column: colName,
          });
        }
      }
    }

    return {
      expectedModels: models.size,
      actualTables: dbTables.size,
      missingTables,
      extraTables,
      missingColumns,
      extraColumns,
    };
  }

  public readSchemaContent(): string {
    const schemaPath = this.resolveSchemaPath();
    return fs.readFileSync(schemaPath, 'utf8');
  }

  /**
   * Main diagnostic method invoked by the admin endpoint.
   */
  async checkDrift(adminUserId: string, adminId: string): Promise<SchemaDriftResult> {
    const startTime = Date.now();

    // 1. Enforce per-admin rate limit
    this.checkAdminRateLimit(adminId);

    // 2. Read and parse schema.prisma
    const schemaContent = this.readSchemaContent();
    const { models } = parsePrismaSchema(schemaContent);

    // 3. Query DB information_schema in read-only mode
    const dbTables = await this.inspectDatabaseSchema();

    // 4. Compare
    const summary = this.compareSchemas(models, dbTables);

    const hasDrift =
      summary.missingTables.length > 0 ||
      summary.extraTables.length > 0 ||
      summary.missingColumns.length > 0 ||
      summary.extraColumns.length > 0;

    const status: 'IN_SYNC' | 'DRIFT_DETECTED' = hasDrift ? 'DRIFT_DETECTED' : 'IN_SYNC';
    const executionTimeMs = Date.now() - startTime;

    // 5. AuditLog entry (event is free-form String)
    try {
      await this.auditService.log({
        actorId: adminUserId,
        actorRole: 'ADMIN',
        event: 'SYSTEM_SCHEMA_DRIFT_CHECK',
        meta: {
          hasDrift,
          checkedTables: summary.actualTables,
          executionTimeMs,
          status,
          summary,
          checkedAt: new Date().toISOString(),
        },
      });
    } catch (auditErr) {
      this.logger.error('Failed to write SYSTEM_SCHEMA_DRIFT_CHECK audit log', auditErr);
    }

    // 6. Telegram notification on DRIFT_DETECTED with flood protection (cooldown 10 minutes)
    if (hasDrift) {
      const now = Date.now();
      const elapsedSinceLastTelegram = now - this.lastTelegramAlertTimestamp;

      if (elapsedSinceLastTelegram >= this.TELEGRAM_COOLDOWN_MS) {
        this.lastTelegramAlertTimestamp = now;
        const alertMessage =
          `⚠️ <b>[تحذير أمني] اكتشاف انحراف في المخطط (Schema Drift)!</b>\n\n` +
          `• جداول مفقودة في DB: ${summary.missingTables.length}\n` +
          `• جداول زائدة في DB: ${summary.extraTables.length}\n` +
          `• أعمدة مفقودة في DB: ${summary.missingColumns.length}\n` +
          `• أعمدة زائدة في DB: ${summary.extraColumns.length}\n\n` +
          `الفاحص: مسؤول النظام (ID: ${adminUserId})`;

        this.telegramService.sendMessage(alertMessage).catch((err) => {
          this.logger.error('Failed to send Telegram drift alert', err);
        });
      } else {
        const remainingMinutes = Math.ceil(
          (this.TELEGRAM_COOLDOWN_MS - elapsedSinceLastTelegram) / 60000,
        );
        this.logger.warn(
          `Schema drift detected, but Telegram alert was throttled (cooldown active: ${remainingMinutes} min remaining).`,
        );
      }
    }

    return {
      status,
      checkedAt: new Date().toISOString(),
      summary,
    };
  }
}
