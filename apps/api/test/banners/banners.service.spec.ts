import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MAX_ACTIVE_BANNERS, BANNER_IN_APP_ROUTES } from '@forerun/shared-constants';
import type { CreateBannerDto, UpdateBannerDto } from '@forerun/shared-types';
import { BannersService } from '../../src/modules/banners/banners.service.js';
import type { PrismaService } from '../../src/database/prisma.service.js';
import type { AuditService } from '../../src/modules/audit/audit.service.js';

describe('BannersService (Sprint 7A)', () => {
  let service: BannersService;
  let prisma: {
    banner: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      findUniqueOrThrow: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let auditService: {
    log: ReturnType<typeof vi.fn>;
  };

  const mockUserId = 'usr-admin-uuid-1';
  const mockAdminId = 'adm-record-uuid-1';

  beforeEach(() => {
    prisma = {
      banner: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        create: vi.fn(),
        updateMany: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn().mockImplementation(async (callback) => {
        return callback(prisma);
      }),
    };

    auditService = {
      log: vi.fn().mockResolvedValue(undefined),
    };

    service = new BannersService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
    );
  });

  describe('createBanner', () => {
    const validDto: CreateBannerDto = {
      title: 'عروض الخضار الأسبوعية',
      headline: 'خصم 20% على الخضار',
      subtitle: 'لفترة محدودة',
      imageUrl: 'https://cdn.example.com/banners/veg.webp',
      actionType: 'NONE',
      sortOrder: 0,
      isActive: true,
    };

    it('creates banner successfully, logs to AuditLog inside transaction, and sets sortOrder', async () => {
      prisma.banner.count.mockResolvedValue(0);
      prisma.banner.findFirst.mockResolvedValue({ sortOrder: 2 });
      const createdRecord = {
        id: 'ban-1',
        title: validDto.title,
        headline: validDto.headline,
        subtitle: validDto.subtitle,
        imageUrl: validDto.imageUrl,
        actionType: 'NONE',
        actionValue: null,
        ctaLabel: null,
        sortOrder: 3,
        isActive: true,
        isDeleted: false,
        startsAt: null,
        endsAt: null,
        createdByAdminId: mockAdminId,
        createdAt: new Date('2026-10-07T00:00:00Z'),
        updatedAt: new Date('2026-10-07T00:00:00Z'),
      };
      prisma.banner.create.mockResolvedValue(createdRecord);

      const result = await service.createBanner(
        { ...validDto, sortOrder: undefined },
        mockUserId,
        mockAdminId,
      );

      expect(prisma.banner.count).toHaveBeenCalledWith({
        where: { isDeleted: false, isActive: true },
      });
      expect(prisma.banner.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: validDto.title,
          imageUrl: validDto.imageUrl,
          createdByAdminId: mockAdminId,
          sortOrder: 3,
          isDeleted: false,
        }),
      });
      expect(auditService.log).toHaveBeenCalledWith(
        {
          actorId: mockUserId,
          actorRole: 'ADMIN',
          event: 'BANNER_CREATED',
          meta: expect.objectContaining({
            bannerId: 'ban-1',
            title: validDto.title,
          }),
        },
        expect.anything(),
      );
      expect(result.id).toBe('ban-1');
      expect(result.createdByAdminId).toBe(mockAdminId);
    });

    it('throws BadRequestException if active count reached MAX_ACTIVE_BANNERS (10)', async () => {
      prisma.banner.count.mockResolvedValue(MAX_ACTIVE_BANNERS);

      await expect(
        service.createBanner(validDto, mockUserId, mockAdminId),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.banner.create).not.toHaveBeenCalled();
    });

    it('allows creation with isActive=false even if active count is at maximum', async () => {
      const inactiveDto = { ...validDto, isActive: false };
      prisma.banner.findFirst.mockResolvedValue(null);
      prisma.banner.create.mockResolvedValue({
        id: 'ban-inactive',
        ...inactiveDto,
        actionValue: null,
        ctaLabel: null,
        sortOrder: 0,
        isDeleted: false,
        startsAt: null,
        endsAt: null,
        createdByAdminId: mockAdminId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.createBanner(inactiveDto, mockUserId, mockAdminId);
      expect(res.isActive).toBe(false);
      expect(prisma.banner.count).not.toHaveBeenCalled();
    });

    it('throws BadRequestException if imageUrl is invalid https URL', async () => {
      await expect(
        service.createBanner(
          { ...validDto, imageUrl: 'http://insecure.com/pic.jpg' },
          mockUserId,
          mockAdminId,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createBanner(
          { ...validDto, imageUrl: 'https://' },
          mockUserId,
          mockAdminId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates EXTERNAL_URL action requiring valid https URL', async () => {
      prisma.banner.count.mockResolvedValue(0);

      await expect(
        service.createBanner(
          {
            ...validDto,
            actionType: 'EXTERNAL_URL',
            actionValue: 'invalid-url',
          },
          mockUserId,
          mockAdminId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('validates IN_APP_ROUTE action against whitelist', async () => {
      prisma.banner.count.mockResolvedValue(0);

      await expect(
        service.createBanner(
          {
            ...validDto,
            actionType: 'IN_APP_ROUTE',
            actionValue: '/unauthorized-secret-path',
          },
          mockUserId,
          mockAdminId,
        ),
      ).rejects.toThrow(BadRequestException);

      prisma.banner.create.mockResolvedValue({
        id: 'ban-route',
        ...validDto,
        actionType: 'IN_APP_ROUTE',
        actionValue: '/create-order',
        ctaLabel: null,
        sortOrder: 1,
        isDeleted: false,
        startsAt: null,
        endsAt: null,
        createdByAdminId: mockAdminId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const validRouteRes = await service.createBanner(
        {
          ...validDto,
          actionType: 'IN_APP_ROUTE',
          actionValue: '/create-order',
        },
        mockUserId,
        mockAdminId,
      );
      expect(validRouteRes.actionValue).toBe('/create-order');
    });

    it('throws BadRequestException if endsAt is before or equal to startsAt', async () => {
      prisma.banner.count.mockResolvedValue(0);

      await expect(
        service.createBanner(
          {
            ...validDto,
            startsAt: '2026-10-10T12:00:00Z',
            endsAt: '2026-10-10T11:00:00Z',
          },
          mockUserId,
          mockAdminId,
        ),
      ).rejects.toThrow('تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء');
    });
  });

  describe('getAllBannersAdmin and getBannerByIdAdmin', () => {
    it('returns all non-deleted banners ordered by sortOrder asc', async () => {
      const records = [
        {
          id: 'b-1',
          title: 'شريحة 1',
          headline: null,
          subtitle: null,
          imageUrl: 'https://example.com/1.png',
          actionType: 'NONE',
          actionValue: null,
          ctaLabel: null,
          sortOrder: 0,
          isActive: true,
          isDeleted: false,
          startsAt: null,
          endsAt: null,
          createdByAdminId: mockAdminId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prisma.banner.findMany.mockResolvedValue(records);

      const res = await service.getAllBannersAdmin();
      expect(res).toHaveLength(1);
      expect(prisma.banner.findMany).toHaveBeenCalledWith({
        where: { isDeleted: false },
        orderBy: { sortOrder: 'asc' },
      });
    });

    it('returns single banner by id or throws NotFoundException', async () => {
      prisma.banner.findFirst.mockResolvedValue(null);
      await expect(service.getBannerByIdAdmin('missing')).rejects.toThrow(
        NotFoundException,
      );

      const record = {
        id: 'b-exist',
        title: 'موجودة',
        headline: null,
        subtitle: null,
        imageUrl: 'https://example.com/img.png',
        actionType: 'NONE',
        actionValue: null,
        ctaLabel: null,
        sortOrder: 0,
        isActive: true,
        isDeleted: false,
        startsAt: null,
        endsAt: null,
        createdByAdminId: mockAdminId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prisma.banner.findFirst.mockResolvedValue(record);
      const found = await service.getBannerByIdAdmin('b-exist');
      expect(found.id).toBe('b-exist');
    });
  });

  describe('updateBanner', () => {
    const existingBanner = {
      id: 'ban-up',
      title: 'شريحة تجريبية',
      headline: 'عنوان قديم',
      subtitle: null,
      imageUrl: 'https://example.com/old.png',
      actionType: 'NONE',
      actionValue: null,
      ctaLabel: null,
      sortOrder: 0,
      isActive: false,
      isDeleted: false,
      startsAt: new Date('2026-10-01T00:00:00Z'),
      endsAt: new Date('2026-10-20T00:00:00Z'),
      createdByAdminId: mockAdminId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('throws NotFoundException if banner does not exist or is deleted', async () => {
      prisma.banner.findFirst.mockResolvedValue(null);
      await expect(
        service.updateBanner('missing-id', { title: 'جديد' }, mockUserId, mockAdminId),
      ).rejects.toThrow(NotFoundException);
    });

    it('enforces MAX_ACTIVE_BANNERS when activating a previously inactive banner', async () => {
      prisma.banner.findFirst.mockResolvedValue(existingBanner); // isActive: false
      prisma.banner.count.mockResolvedValue(MAX_ACTIVE_BANNERS); // Already 10 active

      await expect(
        service.updateBanner('ban-up', { isActive: true }, mockUserId, mockAdminId),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not count existing banner against limit if it was already active', async () => {
      prisma.banner.findFirst.mockResolvedValue({
        ...existingBanner,
        isActive: true,
      });
      prisma.banner.updateMany.mockResolvedValue({ count: 1 });
      prisma.banner.findUniqueOrThrow.mockResolvedValue({
        ...existingBanner,
        isActive: true,
        title: 'عنوان محدث',
      });

      const updated = await service.updateBanner(
        'ban-up',
        { title: 'عنوان محدث', isActive: true },
        mockUserId,
        mockAdminId,
      );

      expect(updated.title).toBe('عنوان محدث');
      expect(prisma.banner.count).not.toHaveBeenCalled();
    });

    it('validates merged cross-field dates on partial update', async () => {
      prisma.banner.findFirst.mockResolvedValue(existingBanner); // startsAt: Oct 1, endsAt: Oct 20

      // Try setting startsAt to Oct 25 (after existing endsAt Oct 20)
      await expect(
        service.updateBanner(
          'ban-up',
          { startsAt: '2026-10-25T00:00:00Z' },
          mockUserId,
          mockAdminId,
        ),
      ).rejects.toThrow('تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء');
    });

    it('updates defensively with count === 1 and logs AuditLog', async () => {
      prisma.banner.findFirst.mockResolvedValue(existingBanner);
      prisma.banner.updateMany.mockResolvedValue({ count: 1 });
      prisma.banner.findUniqueOrThrow.mockResolvedValue({
        ...existingBanner,
        title: 'اسم جديد',
      });

      const res = await service.updateBanner(
        'ban-up',
        { title: 'اسم جديد' },
        mockUserId,
        mockAdminId,
      );

      expect(prisma.banner.updateMany).toHaveBeenCalledWith({
        where: { id: 'ban-up', isDeleted: false },
        data: expect.objectContaining({ title: 'اسم جديد' }),
      });
      expect(auditService.log).toHaveBeenCalledWith(
        {
          actorId: mockUserId,
          actorRole: 'ADMIN',
          event: 'BANNER_UPDATED',
          meta: expect.objectContaining({ bannerId: 'ban-up' }),
        },
        expect.anything(),
      );
      expect(res.title).toBe('اسم جديد');
    });

    it('throws NotFoundException if updateMany affected 0 rows (concurrent deletion)', async () => {
      prisma.banner.findFirst.mockResolvedValue(existingBanner);
      prisma.banner.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.updateBanner(
          'ban-up',
          { title: 'اسم جديد' },
          mockUserId,
          mockAdminId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorderBanners', () => {
    it('successfully updates sortOrder for all non-deleted banners in transaction', async () => {
      prisma.banner.findMany.mockResolvedValue([
        { id: 'b-1' },
        { id: 'b-2' },
        { id: 'b-3' },
      ]);
      prisma.banner.updateMany.mockResolvedValue({ count: 1 });

      const res = await service.reorderBanners(
        ['b-3', 'b-1', 'b-2'],
        mockUserId,
        mockAdminId,
      );

      expect(res).toEqual({ success: true, count: 3 });
      expect(prisma.banner.updateMany).toHaveBeenCalledTimes(3);
      expect(prisma.banner.updateMany).toHaveBeenNthCalledWith(1, {
        where: { id: 'b-3', isDeleted: false },
        data: { sortOrder: 0 },
      });
      expect(prisma.banner.updateMany).toHaveBeenNthCalledWith(2, {
        where: { id: 'b-1', isDeleted: false },
        data: { sortOrder: 1 },
      });
      expect(prisma.banner.updateMany).toHaveBeenNthCalledWith(3, {
        where: { id: 'b-2', isDeleted: false },
        data: { sortOrder: 2 },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        {
          actorId: mockUserId,
          actorRole: 'ADMIN',
          event: 'BANNERS_REORDERED',
          meta: { bannerIds: ['b-3', 'b-1', 'b-2'] },
        },
        expect.anything(),
      );
    });

    it('rejects with BadRequestException if count of IDs does not match existing banners', async () => {
      prisma.banner.findMany.mockResolvedValue([
        { id: 'b-1' },
        { id: 'b-2' },
      ]);

      await expect(
        service.reorderBanners(['b-1'], mockUserId, mockAdminId),
      ).rejects.toThrow('قائمة المعرفات يجب أن تطابق تماماً جميع الشرائح غير المحذوفة');
    });

    it('rejects with BadRequestException if IDs contain duplicates', async () => {
      prisma.banner.findMany.mockResolvedValue([
        { id: 'b-1' },
        { id: 'b-2' },
      ]);

      await expect(
        service.reorderBanners(['b-1', 'b-1'], mockUserId, mockAdminId),
      ).rejects.toThrow('قائمة المعرفات تحتوي على معرفات مكررة');
    });

    it('rejects with BadRequestException if an ID is missing or deleted', async () => {
      prisma.banner.findMany.mockResolvedValue([
        { id: 'b-1' },
        { id: 'b-2' },
      ]);

      await expect(
        service.reorderBanners(['b-1', 'b-unknown'], mockUserId, mockAdminId),
      ).rejects.toThrow('غير موجود أو محذوف مسبقاً');
    });
  });

  describe('deleteBanner', () => {
    it('performs soft delete (isDeleted=true, isActive=false) and logs to AuditLog', async () => {
      prisma.banner.updateMany.mockResolvedValue({ count: 1 });

      const res = await service.deleteBanner('ban-del', mockUserId, mockAdminId);
      expect(res).toEqual({ success: true });
      expect(prisma.banner.updateMany).toHaveBeenCalledWith({
        where: { id: 'ban-del', isDeleted: false },
        data: { isDeleted: true, isActive: false },
      });
      expect(auditService.log).toHaveBeenCalledWith(
        {
          actorId: mockUserId,
          actorRole: 'ADMIN',
          event: 'BANNER_DELETED',
          meta: { bannerId: 'ban-del' },
        },
        expect.anything(),
      );
    });

    it('throws NotFoundException if banner does not exist or was already deleted', async () => {
      prisma.banner.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.deleteBanner('missing', mockUserId, mockAdminId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getActiveBanners & Cache Behavior', () => {
    it('returns public banners without administrative fields and respects date filtering', async () => {
      const now = new Date('2026-10-07T12:00:00Z');
      const activeRecords = [
        {
          id: 'b-pub-1',
          title: 'عنوان داخلي سري',
          headline: 'عرض الصباح',
          subtitle: 'خصم ممتاز',
          imageUrl: 'https://example.com/banner1.png',
          actionType: 'IN_APP_ROUTE',
          actionValue: '/create-order',
          ctaLabel: 'اطلب الآن',
          sortOrder: 0,
          isActive: true,
          isDeleted: false,
          startsAt: new Date('2026-10-07T00:00:00Z'),
          endsAt: new Date('2026-10-07T23:59:59Z'),
          createdByAdminId: 'secret-admin',
          createdAt: new Date('2026-10-01T00:00:00Z'),
          updatedAt: new Date('2026-10-01T00:00:00Z'),
        },
      ];
      prisma.banner.findMany.mockResolvedValue(activeRecords);

      const result = await service.getActiveBanners(now);

      expect(result).toHaveLength(1);
      const item = result[0] as Record<string, unknown>;
      expect(item.id).toBe('b-pub-1');
      expect(item.headline).toBe('عرض الصباح');
      expect(item.actionType).toBe('IN_APP_ROUTE');
      expect(item.actionValue).toBe('/create-order');

      // Crucial: Administrative fields must NEVER be returned to the client
      expect(item.title).toBeUndefined();
      expect(item.isActive).toBeUndefined();
      expect(item.isDeleted).toBeUndefined();
      expect(item.createdByAdminId).toBeUndefined();
      expect(item.createdAt).toBeUndefined();
      expect(item.updatedAt).toBeUndefined();
      expect(item.startsAt).toBeUndefined();
      expect(item.endsAt).toBeUndefined();

      expect(prisma.banner.findMany).toHaveBeenCalledWith({
        where: {
          isDeleted: false,
          isActive: true,
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
        orderBy: { sortOrder: 'asc' },
        take: MAX_ACTIVE_BANNERS,
      });
    });

    it('caches active banners for 30 seconds and invalidates on mutations', async () => {
      service.invalidateCache();
      prisma.banner.findMany.mockResolvedValue([
        {
          id: 'b-cache-1',
          headline: 'كاش 1',
          subtitle: null,
          imageUrl: 'https://example.com/1.png',
          actionType: 'NONE',
          actionValue: null,
          ctaLabel: null,
          sortOrder: 0,
        },
      ]);

      // Call 1: fetches from DB
      const res1 = await service.getActiveBanners();
      expect(prisma.banner.findMany).toHaveBeenCalledTimes(1);
      expect(res1).toHaveLength(1);

      // Call 2: should return cached data without querying DB
      const res2 = await service.getActiveBanners();
      expect(prisma.banner.findMany).toHaveBeenCalledTimes(1);
      expect(res2).toEqual(res1);

      // Mutation invalidates cache
      service.invalidateCache();

      // Call 3: should re-query DB
      await service.getActiveBanners();
      expect(prisma.banner.findMany).toHaveBeenCalledTimes(2);
    });
  });
});
