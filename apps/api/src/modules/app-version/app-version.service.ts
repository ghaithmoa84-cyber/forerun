import {
  Injectable,
  Logger,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  type PublicAppVersionResponse,
  type AdminAppVersionResponse,
  type UpdatePlatformAppVersionDto,
} from '@forerun/shared-types';

interface CachedPublicVersion {
  data: PublicAppVersionResponse;
  expiresAt: number;
}

@Injectable()
export class AppVersionService {
  private readonly logger = new Logger(AppVersionService.name);
  private cachedVersion: Map<string, CachedPublicVersion> = new Map();
  private readonly cacheTtlMs = 30000; // 30 seconds cache

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Retrieves public version info for client apps (GET /api/v1/app/version).
   * Masks all internal IDs and audit fields (Rule 7).
   * Returns null if no version row is found (controller responds with 204 No Content).
   */
  async getPublicAppVersion(platform: 'android'): Promise<PublicAppVersionResponse | null> {
    const cached = this.cachedVersion.get(platform);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    try {
      const row = await this.prisma.appVersion.findUnique({
        where: { platform },
      });

      if (!row) {
        this.logger.warn(`No AppVersion row found in DB for platform: ${platform}`);
        return null;
      }

      const publicData: PublicAppVersionResponse = {
        platform: row.platform as 'android',
        latestVersionCode: row.latestVersionCode,
        latestVersionName: row.latestVersionName,
        minSupportedVersionCode: row.minSupportedVersionCode,
        downloadUrl: row.downloadUrl,
        releaseNotes: row.releaseNotes,
      };

      this.cachedVersion.set(platform, {
        data: publicData,
        expiresAt: Date.now() + this.cacheTtlMs,
      });

      return publicData;
    } catch (error) {
      this.logger.error(`Error fetching AppVersion for ${platform}`, error);
      throw error;
    }
  }

  /**
   * Retrieves admin version info including internal metadata and updatedAt token
   * for optimistic concurrency (GET /api/v1/admin/app-version).
   */
  async getAdminAppVersion(platform: 'android'): Promise<AdminAppVersionResponse> {
    const row = await this.prisma.appVersion.findUnique({
      where: { platform },
    });

    if (!row) {
      throw new NotFoundException(`إعدادات إصدار التطبيق غير موجودة للمنصة: ${platform}`);
    }

    return {
      id: row.id,
      platform: row.platform as 'android',
      latestVersionCode: row.latestVersionCode,
      latestVersionName: row.latestVersionName,
      minSupportedVersionCode: row.minSupportedVersionCode,
      downloadUrl: row.downloadUrl,
      releaseNotes: row.releaseNotes,
      updatedAt: row.updatedAt,
      updatedByUserId: row.updatedByUserId,
    };
  }

  /**
   * Updates platform version config with optimistic concurrency check and AuditLog.
   * (PUT /api/v1/admin/app-version)
   */
  async updateAppVersion(
    dto: UpdatePlatformAppVersionDto,
    userId: string,
  ): Promise<AdminAppVersionResponse> {
    const updatedRow = await this.prisma.$transaction(async (tx) => {
      const currentRow = await tx.appVersion.findUnique({
        where: { platform: dto.platform },
      });

      // Architecture Decision (D51): Platform rows must be pre-seeded via migrations (e.g. android).
      // PUT is strictly an update endpoint to enforce optimistic locking (updatedAt requires an existing token)
      // and prevent accidental creation of malformed platform records. Future platforms (e.g. ios) must be seeded via migration.
      if (!currentRow) {
        throw new NotFoundException(
          `إعدادات إصدار التطبيق غير موجودة للمنصة: ${dto.platform}`,
        );
      }

      const before = {
        latestVersionCode: currentRow.latestVersionCode,
        latestVersionName: currentRow.latestVersionName,
        minSupportedVersionCode: currentRow.minSupportedVersionCode,
        downloadUrl: currentRow.downloadUrl,
        releaseNotes: currentRow.releaseNotes,
        updatedAt: currentRow.updatedAt,
      };

      // Atomic optimistic concurrency: must match client-supplied updatedAt token
      const clientUpdatedAt = new Date(dto.updatedAt);

      const updateResult = await tx.appVersion.updateMany({
        where: {
          platform: dto.platform,
          updatedAt: clientUpdatedAt,
        },
        data: {
          latestVersionCode: dto.latestVersionCode,
          latestVersionName: dto.latestVersionName,
          minSupportedVersionCode: dto.minSupportedVersionCode,
          downloadUrl: dto.downloadUrl,
          releaseNotes: dto.releaseNotes,
          updatedByUserId: userId,
          updatedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictException(
          'تعارض في التحديث: تم تعديل إعدادات الإصدار من قِبل جلسة أخرى، يرجى إعادة التحميل',
        );
      }

      const row = await tx.appVersion.findUniqueOrThrow({
        where: { platform: dto.platform },
      });

      const after = {
        latestVersionCode: row.latestVersionCode,
        latestVersionName: row.latestVersionName,
        minSupportedVersionCode: row.minSupportedVersionCode,
        downloadUrl: row.downloadUrl,
        releaseNotes: row.releaseNotes,
        updatedAt: row.updatedAt,
      };

      await this.auditService.log(
        {
          actorId: userId,
          actorRole: 'ADMIN',
          event: 'APP_VERSION_UPDATED',
          meta: {
            platform: dto.platform,
            before,
            after,
          },
        },
        tx,
      );

      return row;
    });

    this.clearCache(dto.platform);

    return {
      id: updatedRow.id,
      platform: updatedRow.platform as 'android',
      latestVersionCode: updatedRow.latestVersionCode,
      latestVersionName: updatedRow.latestVersionName,
      minSupportedVersionCode: updatedRow.minSupportedVersionCode,
      downloadUrl: updatedRow.downloadUrl,
      releaseNotes: updatedRow.releaseNotes,
      updatedAt: updatedRow.updatedAt,
      updatedByUserId: updatedRow.updatedByUserId,
    };
  }

  clearCache(platform?: string): void {
    if (platform) {
      this.cachedVersion.delete(platform);
    } else {
      this.cachedVersion.clear();
    }
  }
}
