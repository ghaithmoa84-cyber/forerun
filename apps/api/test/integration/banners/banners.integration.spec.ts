import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { cleanDatabase, prisma } from '../setup';
import { createTestApp, closeTestApp, getRequest, getTestApp } from '../helpers/app.helper';
import { seedAdmin, loginAs } from '../helpers/seed.helper';
import { BannersService } from '../../../src/modules/banners/banners.service';

describe('Banners Endpoints Integration (Sprint 7A)', () => {
  let request!: ReturnType<typeof getRequest>;
  let adminToken: string;
  let adminUser: Awaited<ReturnType<typeof seedAdmin>>;

  beforeAll(async () => {
    await createTestApp();
    request = getRequest();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();

    // Ensure cache is completely cleared between tests
    const bannersService = getTestApp().get(BannersService);
    bannersService.invalidateCache();

    adminUser = await seedAdmin(prisma);
    adminToken = await loginAs(request, adminUser.whatsapp, 'Admin@12345');
  });

  describe('GET /api/v1/banners/active', () => {
    it('excludes expired banners where endsAt is in the past', async () => {
      const past = new Date(Date.now() - 3600 * 1000);
      const wayPast = new Date(Date.now() - 7200 * 1000);
      const future = new Date(Date.now() + 3600 * 1000);

      const validBanner = await prisma.banner.create({
        data: {
          title: 'شريحة صالحة',
          headline: 'عرض ساري',
          imageUrl: 'https://example.com/banner-valid.png',
          actionType: 'NONE',
          sortOrder: 0,
          isActive: true,
          isDeleted: false,
          startsAt: past,
          endsAt: future,
          createdByAdminId: adminUser.admin.id,
        },
      });

      await prisma.banner.create({
        data: {
          title: 'شريحة منتهية',
          headline: 'عرض منتهي',
          imageUrl: 'https://example.com/banner-expired.png',
          actionType: 'NONE',
          sortOrder: 1,
          isActive: true,
          isDeleted: false,
          startsAt: wayPast,
          endsAt: past,
          createdByAdminId: adminUser.admin.id,
        },
      });

      const res = await request.get('/api/v1/banners/active');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(validBanner.id);
      expect(res.body[0].headline).toBe('عرض ساري');
    });

    it('excludes future banners where startsAt is in the future', async () => {
      const past = new Date(Date.now() - 3600 * 1000);
      const future = new Date(Date.now() + 3600 * 1000);
      const wayFuture = new Date(Date.now() + 7200 * 1000);

      const validBanner = await prisma.banner.create({
        data: {
          title: 'شريحة حالية',
          headline: 'عرض حالي',
          imageUrl: 'https://example.com/banner-valid.png',
          actionType: 'NONE',
          sortOrder: 0,
          isActive: true,
          isDeleted: false,
          startsAt: past,
          endsAt: future,
          createdByAdminId: adminUser.admin.id,
        },
      });

      await prisma.banner.create({
        data: {
          title: 'شريحة مستقبلية لم تبدأ بعد',
          headline: 'عرض قادم',
          imageUrl: 'https://example.com/banner-future.png',
          actionType: 'NONE',
          sortOrder: 1,
          isActive: true,
          isDeleted: false,
          startsAt: future,
          endsAt: wayFuture,
          createdByAdminId: adminUser.admin.id,
        },
      });

      const res = await request.get('/api/v1/banners/active');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(validBanner.id);
      expect(res.body[0].headline).toBe('عرض حالي');
    });

    it('excludes inactive banners where isActive is false', async () => {
      const validBanner = await prisma.banner.create({
        data: {
          title: 'شريحة نشطة',
          headline: 'عرض نشط',
          imageUrl: 'https://example.com/banner-valid.png',
          actionType: 'NONE',
          sortOrder: 0,
          isActive: true,
          isDeleted: false,
          createdByAdminId: adminUser.admin.id,
        },
      });

      await prisma.banner.create({
        data: {
          title: 'شريحة معطلة يدوياً',
          headline: 'عرض معطل',
          imageUrl: 'https://example.com/banner-inactive.png',
          actionType: 'NONE',
          sortOrder: 1,
          isActive: false,
          isDeleted: false,
          createdByAdminId: adminUser.admin.id,
        },
      });

      const res = await request.get('/api/v1/banners/active');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(validBanner.id);
      expect(res.body[0].headline).toBe('عرض نشط');
    });

    it('excludes soft-deleted banners where isDeleted is true', async () => {
      const validBanner = await prisma.banner.create({
        data: {
          title: 'شريحة غير محذوفة',
          headline: 'عرض حي',
          imageUrl: 'https://example.com/banner-valid.png',
          actionType: 'NONE',
          sortOrder: 0,
          isActive: true,
          isDeleted: false,
          createdByAdminId: adminUser.admin.id,
        },
      });

      await prisma.banner.create({
        data: {
          title: 'شريحة محذوفة ناعماً',
          headline: 'عرض محذوف',
          imageUrl: 'https://example.com/banner-deleted.png',
          actionType: 'NONE',
          sortOrder: 1,
          isActive: true,
          isDeleted: true,
          createdByAdminId: adminUser.admin.id,
        },
      });

      const res = await request.get('/api/v1/banners/active');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(validBanner.id);
      expect(res.body[0].headline).toBe('عرض حي');
    });

    it('ensures ActiveBannerResponse strictly omits all administrative fields in JSON payload', async () => {
      await prisma.banner.create({
        data: {
          title: 'عنوان إداري سري جداً',
          headline: 'عنوان العرض للزبون',
          subtitle: 'وصف العرض للزبون',
          imageUrl: 'https://example.com/public-banner.png',
          actionType: 'EXTERNAL_URL',
          actionValue: 'https://forerun.app/deals',
          ctaLabel: 'شاهد العروض',
          sortOrder: 0,
          isActive: true,
          isDeleted: false,
          startsAt: new Date(Date.now() - 60000),
          endsAt: new Date(Date.now() + 60000),
          createdByAdminId: adminUser.admin.id,
        },
      });

      const res = await request.get('/api/v1/banners/active');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);

      const banner = res.body[0];
      const returnedKeys = Object.keys(banner);

      // Expected public contract keys
      const expectedPublicKeys = [
        'id',
        'headline',
        'subtitle',
        'imageUrl',
        'actionType',
        'actionValue',
        'ctaLabel',
        'sortOrder',
      ].sort();

      expect([...returnedKeys].sort()).toEqual(expectedPublicKeys);

      // Explicit assertions that administrative fields are never leaked
      expect(returnedKeys).not.toContain('title');
      expect(returnedKeys).not.toContain('isActive');
      expect(returnedKeys).not.toContain('isDeleted');
      expect(returnedKeys).not.toContain('createdByAdminId');
      expect(returnedKeys).not.toContain('createdAt');
      expect(returnedKeys).not.toContain('updatedAt');
      expect(returnedKeys).not.toContain('startsAt');
      expect(returnedKeys).not.toContain('endsAt');

      expect(banner.title).toBeUndefined();
      expect(banner.isActive).toBeUndefined();
      expect(banner.isDeleted).toBeUndefined();
      expect(banner.createdByAdminId).toBeUndefined();
      expect(banner.createdAt).toBeUndefined();
      expect(banner.updatedAt).toBeUndefined();
    });

    it('proves HTTP cache invalidation: admin PATCH immediately updates /banners/active without waiting for TTL', async () => {
      // 1. Create a banner via Admin HTTP endpoint
      const createRes = await request
        .post('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'شريحة أولية',
          headline: 'العنوان الأصلي',
          imageUrl: 'https://example.com/banner-init.png',
          actionType: 'NONE',
          sortOrder: 0,
          isActive: true,
        });

      expect(createRes.status).toBe(201);
      const bannerId = createRes.body.id;

      // 2. Request /banners/active to populate in-memory 30s cache
      const getRes1 = await request.get('/api/v1/banners/active');
      expect(getRes1.status).toBe(200);
      expect(getRes1.body).toHaveLength(1);
      expect(getRes1.body[0].headline).toBe('العنوان الأصلي');

      // 3. Update DB directly behind the scene to prove that cache is indeed active
      await prisma.banner.update({
        where: { id: bannerId },
        data: { headline: 'تعديل سري مباشر في القاعدة' },
      });

      // 4. Request /banners/active again: should still return the CACHED headline
      const getResCached = await request.get('/api/v1/banners/active');
      expect(getResCached.status).toBe(200);
      expect(getResCached.body[0].headline).toBe('العنوان الأصلي');

      // 5. Send PATCH via admin HTTP route to invalidate cache
      const patchRes = await request
        .patch(`/api/v1/admin/banners/${bannerId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          headline: 'العنوان المحدث بعد الباتش',
        });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.headline).toBe('العنوان المحدث بعد الباتش');

      // 6. Request /banners/active immediately via HTTP: must return new value immediately
      const getResAfterPatch = await request.get('/api/v1/banners/active');
      expect(getResAfterPatch.status).toBe(200);
      expect(getResAfterPatch.body[0].headline).toBe('العنوان المحدث بعد الباتش');
    });

    it('proves soft delete via admin DELETE endpoint removes banner and invalidates cache', async () => {
      // 1. Create a banner via Admin HTTP endpoint
      const createRes = await request
        .post('/api/v1/admin/banners')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'شريحة للحذف',
          headline: 'شريحة ستُحذف',
          imageUrl: 'https://example.com/banner-to-del.png',
          actionType: 'NONE',
          sortOrder: 0,
          isActive: true,
        });

      expect(createRes.status).toBe(201);
      const bannerId = createRes.body.id;

      // 2. Populate cache
      const getRes1 = await request.get('/api/v1/banners/active');
      expect(getRes1.status).toBe(200);
      expect(getRes1.body).toHaveLength(1);

      // 3. Admin DELETE via HTTP
      const deleteRes = await request
        .delete(`/api/v1/admin/banners/${bannerId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body).toEqual({ success: true });

      // 4. Check DB row is soft-deleted (NOT hard-deleted)
      const dbRow = await prisma.banner.findUnique({
        where: { id: bannerId },
      });
      expect(dbRow).not.toBeNull();
      expect(dbRow?.isDeleted).toBe(true);
      expect(dbRow?.isActive).toBe(false);

      // 5. Immediate GET /banners/active: must return empty array
      const getResAfterDelete = await request.get('/api/v1/banners/active');
      expect(getResAfterDelete.status).toBe(200);
      expect(getResAfterDelete.body).toHaveLength(0);
    });
  });
});
