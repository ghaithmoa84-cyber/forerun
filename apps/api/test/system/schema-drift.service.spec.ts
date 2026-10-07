import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchemaDriftService, parsePrismaSchema } from '../../src/modules/system/schema-drift.service.js';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('SchemaDriftService', () => {
  let service: SchemaDriftService;
  let mockPrisma: any;
  let mockAudit: any;
  let mockTelegram: any;

  beforeEach(() => {
    mockPrisma = {
      $queryRawUnsafe: vi.fn(),
    };
    mockAudit = {
      log: vi.fn().mockResolvedValue(undefined),
    };
    mockTelegram = {
      sendMessage: vi.fn().mockResolvedValue(undefined),
    };

    service = new SchemaDriftService(mockPrisma, mockAudit, mockTelegram);
  });

  describe('parsePrismaSchema', () => {
    it('correctly extracts models, scalar fields, and enums', () => {
      const sampleSchema = `
        enum UserRole {
          CUSTOMER
          RUNNER
          ADMIN
        }

        model User {
          id        String   @id @default(cuid())
          whatsapp  String   @unique
          role      UserRole
          createdAt DateTime @default(now())
          orders    Order[]
        }

        model Order {
          id     String @id
          userId String
          user   User   @relation(fields: [userId], references: [id])
        }
      `;

      const { models, enums } = parsePrismaSchema(sampleSchema);

      expect(enums.has('UserRole')).toBe(true);
      expect(models.has('User')).toBe(true);
      expect(models.has('Order')).toBe(true);

      const userCols = models.get('User')!;
      expect(userCols.has('id')).toBe(true);
      expect(userCols.has('whatsapp')).toBe(true);
      expect(userCols.has('role')).toBe(true);
      expect(userCols.get('role')!.isEnum).toBe(true);
      // relation array must not be treated as a DB column
      expect(userCols.has('orders')).toBe(false);
    });
  });

  describe('compareSchemas', () => {
    it('returns IN_SYNC when DB tables and columns match schema models exactly', () => {
      const models = new Map([
        [
          'User',
          new Map([
            ['id', { name: 'id', type: 'String', isOptional: false }],
            ['whatsapp', { name: 'whatsapp', type: 'String', isOptional: false }],
          ]),
        ],
      ]);

      const dbTables = new Map([
        [
          'User',
          new Map([
            ['id', { name: 'id' }],
            ['whatsapp', { name: 'whatsapp' }],
          ]),
        ],
      ]);

      const summary = service.compareSchemas(models as any, dbTables as any);

      expect(summary.expectedModels).toBe(1);
      expect(summary.actualTables).toBe(1);
      expect(summary.missingTables).toEqual([]);
      expect(summary.extraTables).toEqual([]);
      expect(summary.missingColumns).toEqual([]);
      expect(summary.extraColumns).toEqual([]);
    });

    it('detects missing and extra tables as schema drift', () => {
      const models = new Map([
        ['User', new Map()],
        ['Order', new Map()], // defined in schema, missing in DB
      ]);

      const dbTables = new Map([
        ['User', new Map()],
        ['LegacyLog', new Map()], // exists in DB, not in schema
      ]);

      const summary = service.compareSchemas(models as any, dbTables as any);

      expect(summary.missingTables).toEqual(['Order']);
      expect(summary.extraTables).toEqual(['LegacyLog']);
    });

    it('detects missing and extra columns within matching tables as schema drift', () => {
      const models = new Map([
        [
          'User',
          new Map([
            ['id', { name: 'id', type: 'String', isOptional: false }],
            ['altPhone', { name: 'altPhone', type: 'String', isOptional: true }], // missing in DB
          ]),
        ],
      ]);

      const dbTables = new Map([
        [
          'User',
          new Map([
            ['id', { name: 'id' }],
            ['tempField', { name: 'tempField' }], // extra in DB
          ]),
        ],
      ]);

      const summary = service.compareSchemas(models as any, dbTables as any);

      expect(summary.missingColumns).toEqual([
        { table: 'User', column: 'altPhone', type: 'String?' },
      ]);
      expect(summary.extraColumns).toEqual([
        { table: 'User', column: 'tempField' },
      ]);
    });
  });

  describe('checkAdminRateLimit (Per-Admin 10s cooldown)', () => {
    it('allows first call, blocks rapid second call from same admin, and allows different admin', () => {
      const admin1 = 'admin-user-1';
      const admin2 = 'admin-user-2';

      // First call for admin1 passes
      expect(() => service.checkAdminRateLimit(admin1)).not.toThrow();

      // Second call immediately for admin1 fails with 429
      try {
        service.checkAdminRateLimit(admin1);
        expect.unreachable('Should have thrown 429');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
        expect(err.getResponse().error).toBe('TOO_MANY_REQUESTS');
      }

      // Different admin passes without interference
      expect(() => service.checkAdminRateLimit(admin2)).not.toThrow();
    });
  });

  describe('checkDrift execution, AuditLog, and Telegram flood protection', () => {
    it('executes checkDrift, records AuditLog, and skips Telegram when IN_SYNC', async () => {
      vi.spyOn(service, 'readSchemaContent').mockReturnValue('model User { id String @id }');
      vi.spyOn(service, 'inspectDatabaseSchema').mockResolvedValue(
        new Map([['User', new Map([['id', {}]])]]),
      );
      vi.spyOn(service, 'compareSchemas').mockReturnValue({
        expectedModels: 1,
        actualTables: 1,
        missingTables: [],
        extraTables: [],
        missingColumns: [],
        extraColumns: [],
      });

      const result = await service.checkDrift('usr-admin-1', 'adm-1');

      expect(result.status).toBe('IN_SYNC');
      expect(mockAudit.log).toHaveBeenCalledTimes(1);
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'usr-admin-1',
          actorRole: 'ADMIN',
          event: 'SYSTEM_SCHEMA_DRIFT_CHECK',
          meta: expect.objectContaining({ status: 'IN_SYNC' }),
        }),
      );
      expect(mockTelegram.sendMessage).not.toHaveBeenCalled();
    });

    it('sends Telegram alert on DRIFT_DETECTED, and throttles consecutive Telegram alerts within 10 min', async () => {
      vi.spyOn(service, 'readSchemaContent').mockReturnValue('model User { id String @id }');
      vi.spyOn(service, 'inspectDatabaseSchema').mockResolvedValue(new Map());
      vi.spyOn(service, 'compareSchemas').mockReturnValue({
        expectedModels: 1,
        actualTables: 0,
        missingTables: ['User'],
        extraTables: [],
        missingColumns: [],
        extraColumns: [],
      });

      // 1st drift check: Telegram alert sent
      const result1 = await service.checkDrift('usr-admin-1', 'adm-1');
      expect(result1.status).toBe('DRIFT_DETECTED');
      expect(mockTelegram.sendMessage).toHaveBeenCalledTimes(1);

      // Bypass per-admin 10s cooldown by using a distinct admin or waiting
      const result2 = await service.checkDrift('usr-admin-2', 'adm-2');
      expect(result2.status).toBe('DRIFT_DETECTED');
      // Telegram alert was NOT sent a second time because 10-min cooldown is active
      expect(mockTelegram.sendMessage).toHaveBeenCalledTimes(1);
    });
  });
});
