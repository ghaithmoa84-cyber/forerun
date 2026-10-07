import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { BannersAdminController } from '../../src/modules/banners/banners-admin.controller.js';
import { BannersPublicController } from '../../src/modules/banners/banners-public.controller.js';
import type { BannersService } from '../../src/modules/banners/banners.service.js';
import type { CreateBannerDto, UpdateBannerDto } from '@forerun/shared-types';

describe('Banners Controllers (Sprint 7A)', () => {
  let adminController: BannersAdminController;
  let publicController: BannersPublicController;
  let bannersService: {
    createBanner: ReturnType<typeof vi.fn>;
    getAllBannersAdmin: ReturnType<typeof vi.fn>;
    getBannerByIdAdmin: ReturnType<typeof vi.fn>;
    updateBanner: ReturnType<typeof vi.fn>;
    reorderBanners: ReturnType<typeof vi.fn>;
    deleteBanner: ReturnType<typeof vi.fn>;
    getActiveBanners: ReturnType<typeof vi.fn>;
  };

  const mockAdminUser = {
    userId: 'usr-admin-1',
    adminId: 'adm-record-1',
    role: 'ADMIN',
    status: 'VERIFIED',
  };

  const mockNonAdminUser = {
    userId: 'usr-customer-1',
    adminId: null,
    role: 'CUSTOMER',
    status: 'VERIFIED',
  };

  beforeEach(() => {
    bannersService = {
      createBanner: vi.fn(),
      getAllBannersAdmin: vi.fn(),
      getBannerByIdAdmin: vi.fn(),
      updateBanner: vi.fn(),
      reorderBanners: vi.fn(),
      deleteBanner: vi.fn(),
      getActiveBanners: vi.fn(),
    };

    adminController = new BannersAdminController(
      bannersService as unknown as BannersService,
    );
    publicController = new BannersPublicController(
      bannersService as unknown as BannersService,
    );
  });

  describe('BannersAdminController', () => {
    it('throws ForbiddenException on createBanner if adminId is missing', async () => {
      const dto: CreateBannerDto = {
        title: 'شريحة',
        imageUrl: 'https://example.com/banner.png',
        actionType: 'NONE',
        sortOrder: 0,
        isActive: true,
      };

      await expect(
        adminController.createBanner(dto, mockNonAdminUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('delegates createBanner to service when adminId is present', async () => {
      const dto: CreateBannerDto = {
        title: 'شريحة',
        imageUrl: 'https://example.com/banner.png',
        actionType: 'NONE',
        sortOrder: 0,
        isActive: true,
      };
      bannersService.createBanner.mockResolvedValue({ id: 'ban-1', ...dto });

      const res = await adminController.createBanner(dto, mockAdminUser);
      expect(res.id).toBe('ban-1');
      expect(bannersService.createBanner).toHaveBeenCalledWith(
        dto,
        mockAdminUser.userId,
        mockAdminUser.adminId,
      );
    });

    it('delegates getAllBanners and getBannerById to service', async () => {
      bannersService.getAllBannersAdmin.mockResolvedValue([]);
      bannersService.getBannerByIdAdmin.mockResolvedValue({ id: 'b-1' });

      await adminController.getAllBanners();
      expect(bannersService.getAllBannersAdmin).toHaveBeenCalledOnce();

      await adminController.getBannerById({ id: 'b-1' });
      expect(bannersService.getBannerByIdAdmin).toHaveBeenCalledWith('b-1');
    });

    it('throws ForbiddenException on reorderBanners if adminId is missing', async () => {
      await expect(
        adminController.reorderBanners({ bannerIds: ['b-1', 'b-2'] }, mockNonAdminUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('delegates reorderBanners to service when adminId is present', async () => {
      bannersService.reorderBanners.mockResolvedValue({ success: true, count: 2 });

      const res = await adminController.reorderBanners(
        { bannerIds: ['b-2', 'b-1'] },
        mockAdminUser,
      );
      expect(res).toEqual({ success: true, count: 2 });
      expect(bannersService.reorderBanners).toHaveBeenCalledWith(
        ['b-2', 'b-1'],
        mockAdminUser.userId,
        mockAdminUser.adminId,
      );
    });

    it('throws ForbiddenException on updateBanner if adminId is missing', async () => {
      const dto: UpdateBannerDto = { title: 'محدث' };
      await expect(
        adminController.updateBanner({ id: 'b-1' }, dto, mockNonAdminUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('delegates updateBanner to service when adminId is present', async () => {
      const dto: UpdateBannerDto = { title: 'محدث' };
      bannersService.updateBanner.mockResolvedValue({ id: 'b-1', title: 'محدث' });

      const res = await adminController.updateBanner(
        { id: 'b-1' },
        dto,
        mockAdminUser,
      );
      expect(res.title).toBe('محدث');
      expect(bannersService.updateBanner).toHaveBeenCalledWith(
        'b-1',
        dto,
        mockAdminUser.userId,
        mockAdminUser.adminId,
      );
    });

    it('throws ForbiddenException on deleteBanner if adminId is missing', async () => {
      await expect(
        adminController.deleteBanner({ id: 'b-1' }, mockNonAdminUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('delegates deleteBanner to service when adminId is present', async () => {
      bannersService.deleteBanner.mockResolvedValue({ success: true });

      const res = await adminController.deleteBanner(
        { id: 'b-1' },
        mockAdminUser,
      );
      expect(res).toEqual({ success: true });
      expect(bannersService.deleteBanner).toHaveBeenCalledWith(
        'b-1',
        mockAdminUser.userId,
        mockAdminUser.adminId,
      );
    });
  });

  describe('BannersPublicController', () => {
    it('delegates getActiveBanners directly to service', async () => {
      bannersService.getActiveBanners.mockResolvedValue([
        { id: 'b-pub-1', headline: 'عرض اليوم' },
      ]);

      const res = await publicController.getActiveBanners();
      expect(res).toHaveLength(1);
      expect(bannersService.getActiveBanners).toHaveBeenCalledOnce();
    });
  });
});
