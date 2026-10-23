import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { AppVersionController } from '../../src/modules/app-version/app-version.controller.js';
import type { AppVersionService } from '../../src/modules/app-version/app-version.service.js';

describe('AppVersionController', () => {
  let controller: AppVersionController;
  let mockService: {
    getPublicAppVersion: ReturnType<typeof vi.fn>;
    getAdminAppVersion: ReturnType<typeof vi.fn>;
    updateAppVersion: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockService = {
      getPublicAppVersion: vi.fn(),
      getAdminAppVersion: vi.fn(),
      updateAppVersion: vi.fn(),
    };

    controller = new AppVersionController(
      mockService as unknown as AppVersionService,
    );
  });

  describe('GET /app/version (Public)', () => {
    it('returns 200 with public app version data when found', async () => {
      const publicData = {
        platform: 'android' as const,
        latestVersionCode: 4,
        latestVersionName: '0.1.3',
        minSupportedVersionCode: 3,
        downloadUrl: 'https://faow.run/fawrun.apk',
        releaseNotes: 'تحسينات جديدة',
      };
      mockService.getPublicAppVersion.mockResolvedValue(publicData);

      const mockRes = {
        status: vi.fn().mockReturnThis(),
      } as unknown as Response;

      const result = await controller.getPublicAppVersion(
        { platform: 'android' },
        mockRes,
      );

      expect(result).toEqual(publicData);
      expect(mockRes.status).not.toHaveBeenCalledWith(HttpStatus.NO_CONTENT);
      expect(mockService.getPublicAppVersion).toHaveBeenCalledWith('android');
    });

    it('sets 204 No Content when version row does not exist for platform', async () => {
      mockService.getPublicAppVersion.mockResolvedValue(null);

      const mockRes = {
        status: vi.fn().mockReturnThis(),
      } as unknown as Response;

      const result = await controller.getPublicAppVersion(
        { platform: 'android' },
        mockRes,
      );

      expect(result).toBeUndefined();
      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.NO_CONTENT);
    });
  });

  describe('GET /admin/app-version (Admin)', () => {
    it('returns admin app version data with metadata', async () => {
      const adminData = {
        id: 'ver-123',
        platform: 'android' as const,
        latestVersionCode: 4,
        latestVersionName: '0.1.3',
        minSupportedVersionCode: 3,
        downloadUrl: 'https://faow.run/fawrun.apk',
        releaseNotes: 'تحسينات جديدة',
        updatedAt: new Date(),
        updatedByUserId: 'usr-admin-1',
      };
      mockService.getAdminAppVersion.mockResolvedValue(adminData);

      const result = await controller.getAdminAppVersion({ platform: 'android' });

      expect(result).toEqual(adminData);
      expect(mockService.getAdminAppVersion).toHaveBeenCalledWith('android');
    });
  });

  describe('PUT /admin/app-version (Admin)', () => {
    it('updates version and returns updated data', async () => {
      const updateDto = {
        platform: 'android' as const,
        latestVersionCode: 5,
        latestVersionName: '0.1.4',
        minSupportedVersionCode: 4,
        downloadUrl: 'https://faow.run/fawrun-new.apk',
        releaseNotes: 'إصلاحات أمنية',
        updatedAt: new Date(),
      };
      const updatedResponse = {
        id: 'ver-123',
        ...updateDto,
        updatedByUserId: 'admin-user-id',
      };
      mockService.updateAppVersion.mockResolvedValue(updatedResponse);

      const result = await controller.updateAppVersion(updateDto, {
        userId: 'admin-user-id',
        adminId: 'adm-record-id',
      });

      expect(result).toEqual(updatedResponse);
      expect(mockService.updateAppVersion).toHaveBeenCalledWith(
        updateDto,
        'admin-user-id',
      );
    });
  });
});
