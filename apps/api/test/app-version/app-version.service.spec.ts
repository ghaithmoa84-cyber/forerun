import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AppVersionService } from '../../src/modules/app-version/app-version.service.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import type { AuditService } from '../../src/modules/audit/audit.service.js';

describe('AppVersionService', () => {
  let service: AppVersionService;
  let mockPrisma: any;
  let mockAuditService: { log: ReturnType<typeof vi.fn> };

  const mockDbRow = {
    id: 'ver-uuid-1234',
    platform: 'android',
    latestVersionCode: 4,
    latestVersionName: '0.1.3',
    minSupportedVersionCode: 3,
    downloadUrl: 'https://faow.run/fawrun.apk',
    releaseNotes: 'تحسينات جديدة',
    updatedAt: new Date('2026-10-23T12:00:00Z'),
    updatedByUserId: 'usr-admin-1',
  };

  beforeEach(() => {
    mockPrisma = {
      appVersion: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };

    mockAuditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    service = new AppVersionService(
      mockPrisma as unknown as PrismaService,
      mockAuditService as unknown as AuditService,
    );
  });

  describe('getPublicAppVersion', () => {
    it('returns sanitized public version without internal fields (Rule 7)', async () => {
      mockPrisma.appVersion.findUnique.mockResolvedValue(mockDbRow);

      const result = await service.getPublicAppVersion('android');

      expect(result).toEqual({
        platform: 'android',
        latestVersionCode: 4,
        latestVersionName: '0.1.3',
        minSupportedVersionCode: 3,
        downloadUrl: 'https://faow.run/fawrun.apk',
        releaseNotes: 'تحسينات جديدة',
      });
      expect(result).not.toHaveProperty('id');
      expect(result).not.toHaveProperty('updatedByUserId');
      expect(result).not.toHaveProperty('updatedAt');
      expect(mockPrisma.appVersion.findUnique).toHaveBeenCalledWith({
        where: { platform: 'android' },
      });
    });

    it('caches public version and avoids redundant DB queries within TTL', async () => {
      mockPrisma.appVersion.findUnique.mockResolvedValue(mockDbRow);

      const res1 = await service.getPublicAppVersion('android');
      const res2 = await service.getPublicAppVersion('android');

      expect(res1).toEqual(res2);
      expect(mockPrisma.appVersion.findUnique).toHaveBeenCalledTimes(1);
    });

    it('returns null when no version row exists in DB', async () => {
      mockPrisma.appVersion.findUnique.mockResolvedValue(null);

      const result = await service.getPublicAppVersion('android');

      expect(result).toBeNull();
    });
  });

  describe('getAdminAppVersion', () => {
    it('returns complete admin DTO with audit fields and updatedAt', async () => {
      mockPrisma.appVersion.findUnique.mockResolvedValue(mockDbRow);

      const result = await service.getAdminAppVersion('android');

      expect(result).toEqual(mockDbRow);
      expect(mockPrisma.appVersion.findUnique).toHaveBeenCalledWith({
        where: { platform: 'android' },
      });
    });

    it('throws NotFoundException if version row is missing', async () => {
      mockPrisma.appVersion.findUnique.mockResolvedValue(null);

      await expect(service.getAdminAppVersion('android')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateAppVersion', () => {
    const updateDto = {
      platform: 'android' as const,
      latestVersionCode: 5,
      latestVersionName: '0.1.4',
      minSupportedVersionCode: 4,
      downloadUrl: 'https://faow.run/fawrun-new.apk',
      releaseNotes: 'تحديث أمني إلزامي',
      updatedAt: new Date('2026-10-23T12:00:00Z'),
    };

    it('updates version with optimistic locking and records AuditLog', async () => {
      mockPrisma.appVersion.findUnique.mockResolvedValue(mockDbRow);
      mockPrisma.appVersion.updateMany.mockResolvedValue({ count: 1 });
      const updatedRow = {
        ...mockDbRow,
        latestVersionCode: 5,
        latestVersionName: '0.1.4',
        minSupportedVersionCode: 4,
        downloadUrl: 'https://faow.run/fawrun-new.apk',
        releaseNotes: 'تحديث أمني إلزامي',
        updatedByUserId: 'admin-123',
        updatedAt: new Date('2026-10-23T13:00:00Z'),
      };
      mockPrisma.appVersion.findUniqueOrThrow.mockResolvedValue(updatedRow);

      const result = await service.updateAppVersion(updateDto, 'admin-123');

      expect(result.latestVersionCode).toBe(5);
      expect(result.minSupportedVersionCode).toBe(4);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'admin-123',
          actorRole: 'ADMIN',
          event: 'APP_VERSION_UPDATED',
          meta: expect.objectContaining({
            platform: 'android',
            before: expect.objectContaining({ latestVersionCode: 4 }),
            after: expect.objectContaining({ latestVersionCode: 5 }),
          }),
        }),
        expect.anything(),
      );
    });

    it('throws ConflictException (409) when concurrent update changes DB timestamp (count === 0)', async () => {
      mockPrisma.appVersion.findUnique.mockResolvedValue(mockDbRow);
      mockPrisma.appVersion.updateMany.mockResolvedValue({ count: 0 });

      const staleDto = {
        ...updateDto,
        updatedAt: new Date('2026-10-23T10:00:00Z'),
      };

      await expect(service.updateAppVersion(staleDto, 'admin-123')).rejects.toThrow(
        ConflictException,
      );
      expect(mockPrisma.appVersion.updateMany).toHaveBeenCalledWith({
        where: {
          platform: 'android',
          updatedAt: staleDto.updatedAt,
        },
        data: expect.any(Object),
      });
    });

    it('throws NotFoundException if platform row does not exist in DB', async () => {
      mockPrisma.appVersion.findUnique.mockResolvedValue(null);

      await expect(service.updateAppVersion(updateDto, 'admin-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
