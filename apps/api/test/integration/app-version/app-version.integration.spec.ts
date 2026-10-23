import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { cleanDatabase, prisma } from '../setup';
import { createTestApp, closeTestApp, getRequest, getTestApp } from '../helpers/app.helper';
import { seedAdmin, seedCustomer, loginAs } from '../helpers/seed.helper';
import { AppVersionService } from '../../../src/modules/app-version/app-version.service.js';

describe('App Version API Integration Tests', () => {
  let request!: ReturnType<typeof getRequest>;
  let adminToken: string;
  let customerToken: string;

  beforeAll(async () => {
    await createTestApp();
    request = getRequest();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
    getTestApp().get(AppVersionService).clearCache();

    const [adminUser, customerUser] = await Promise.all([
      seedAdmin(prisma),
      seedCustomer(prisma),
    ]);

    [adminToken, customerToken] = await Promise.all([
      loginAs(request, adminUser.whatsapp, 'Admin@12345'),
      loginAs(request, customerUser.whatsapp, 'Customer@12345'),
    ]);

    // Seed default AppVersion row
    await prisma.appVersion.upsert({
      where: { platform: 'android' },
      create: {
        platform: 'android',
        latestVersionCode: 3,
        latestVersionName: '0.1.2',
        minSupportedVersionCode: 3,
        downloadUrl: 'https://faow.run/fawrun.apk',
        releaseNotes: 'الإصدار الأولي',
      },
      update: {
        latestVersionCode: 3,
        latestVersionName: '0.1.2',
        minSupportedVersionCode: 3,
        downloadUrl: 'https://faow.run/fawrun.apk',
        releaseNotes: 'الإصدار الأولي',
      },
    });
  });

  describe('GET /api/v1/app/version (Public)', () => {
    it('returns 200 with sanitized public DTO without authentication', async () => {
      const res = await request.get('/api/v1/app/version?platform=android');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        platform: 'android',
        latestVersionCode: 3,
        latestVersionName: '0.1.2',
        minSupportedVersionCode: 3,
        downloadUrl: 'https://faow.run/fawrun.apk',
        releaseNotes: 'الإصدار الأولي',
      });
      expect(res.body).not.toHaveProperty('id');
      expect(res.body).not.toHaveProperty('updatedByUserId');
      expect(res.body).not.toHaveProperty('updatedAt');
    });

    it('rejects unsupported platform with 400 Bad Request', async () => {
      const res = await request.get('/api/v1/app/version?platform=ios');

      expect(res.status).toBe(400);
    });

    it('returns 204 No Content when no version row exists for platform', async () => {
      await prisma.appVersion.deleteMany();
      getTestApp().get(AppVersionService).clearCache();

      const res = await request.get('/api/v1/app/version?platform=android');

      expect(res.status).toBe(204);
      expect(res.text).toBe('');
    });
  });

  describe('GET /api/v1/admin/app-version (Admin)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request.get('/api/v1/admin/app-version?platform=android');
      expect(res.status).toBe(401);
    });

    it('rejects non-admin users with 403 Forbidden', async () => {
      const res = await request
        .get('/api/v1/admin/app-version?platform=android')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(403);
    });

    it('returns full admin DTO with updatedAt for Admin', async () => {
      const res = await request
        .get('/api/v1/admin/app-version?platform=android')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.platform).toBe('android');
      expect(res.body.latestVersionCode).toBe(3);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('updatedAt');
    });
  });

  describe('PUT /api/v1/admin/app-version (Admin)', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request.put('/api/v1/admin/app-version').send({
        platform: 'android',
        latestVersionCode: 4,
        latestVersionName: '0.1.3',
        minSupportedVersionCode: 3,
        downloadUrl: 'https://faow.run/fawrun-new.apk',
      });
      expect(res.status).toBe(401);
    });

    it('rejects non-admin users with 403 Forbidden', async () => {
      const res = await request
        .put('/api/v1/admin/app-version')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          platform: 'android',
          latestVersionCode: 4,
          latestVersionName: '0.1.3',
          minSupportedVersionCode: 3,
          downloadUrl: 'https://faow.run/fawrun-new.apk',
        });
      expect(res.status).toBe(403);
    });

    it('rejects downloadUrl outside trusted origin (faow.run) with 400', async () => {
      const res = await request
        .put('/api/v1/admin/app-version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          platform: 'android',
          latestVersionCode: 4,
          latestVersionName: '0.1.3',
          minSupportedVersionCode: 3,
          downloadUrl: 'https://malicious.com/fake.apk',
        });

      expect(res.status).toBe(400);
    });

    it('rejects minSupportedVersionCode > latestVersionCode with 400', async () => {
      const res = await request
        .put('/api/v1/admin/app-version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          platform: 'android',
          latestVersionCode: 3,
          latestVersionName: '0.1.3',
          minSupportedVersionCode: 4, // Invalid: min > latest
          downloadUrl: 'https://faow.run/fawrun.apk',
        });

      expect(res.status).toBe(400);
    });

    it('updates version, records AuditLog, and updates public endpoint response', async () => {
      const getRes = await request
        .get('/api/v1/admin/app-version?platform=android')
        .set('Authorization', `Bearer ${adminToken}`);
      const currentUpdatedAt = getRes.body.updatedAt;

      const updateRes = await request
        .put('/api/v1/admin/app-version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          platform: 'android',
          latestVersionCode: 5,
          latestVersionName: '0.1.4',
          minSupportedVersionCode: 4,
          downloadUrl: 'https://faow.run/fawrun-v5.apk',
          releaseNotes: 'إصلاحات أمنية هامة',
          updatedAt: currentUpdatedAt,
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.latestVersionCode).toBe(5);
      expect(updateRes.body.minSupportedVersionCode).toBe(4);

      // Verify AuditLog record
      const auditLog = await prisma.auditLog.findFirst({
        where: { event: 'APP_VERSION_UPDATED' },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditLog).not.toBeNull();
      expect((auditLog?.meta as any)?.platform).toBe('android');

      // Verify public endpoint immediately reflects changes
      const publicRes = await request.get('/api/v1/app/version?platform=android');
      expect(publicRes.status).toBe(200);
      expect(publicRes.body.latestVersionCode).toBe(5);
      expect(publicRes.body.downloadUrl).toBe('https://faow.run/fawrun-v5.apk');
    });

    it('rejects request missing mandatory updatedAt with 400 Bad Request', async () => {
      const res = await request
        .put('/api/v1/admin/app-version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          platform: 'android',
          latestVersionCode: 5,
          latestVersionName: '0.1.4',
          minSupportedVersionCode: 4,
          downloadUrl: 'https://faow.run/fawrun-v5.apk',
          // updatedAt omitted intentionally
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('updatedAt');
    });

    it('simulates concurrent admins: Admin A reads T1, Admin B updates to T2, Admin A attempts update with stale T1 -> rejected with 409 Conflict', async () => {
      // 1. Admin A reads the current version state (T1)
      const getResA = await request
        .get('/api/v1/admin/app-version?platform=android')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getResA.status).toBe(200);
      const t1 = getResA.body.updatedAt;

      // 2. Admin B updates the version concurrently, advancing updatedAt to T2
      const updateResB = await request
        .put('/api/v1/admin/app-version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          platform: 'android',
          latestVersionCode: 10,
          latestVersionName: '0.2.0',
          minSupportedVersionCode: 4,
          downloadUrl: 'https://faow.run/fawrun-v10.apk',
          releaseNotes: 'تحديث الأدمن B',
          updatedAt: t1,
        });
      expect(updateResB.status).toBe(200);
      const t2 = updateResB.body.updatedAt;
      expect(new Date(t2).getTime()).toBeGreaterThan(new Date(t1).getTime());

      // 3. Admin A attempts to update using stale token T1 -> rejected with 409
      const updateResA = await request
        .put('/api/v1/admin/app-version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          platform: 'android',
          latestVersionCode: 9,
          latestVersionName: '0.1.9',
          minSupportedVersionCode: 4,
          downloadUrl: 'https://faow.run/fawrun-v9.apk',
          releaseNotes: 'تحديث الأدمن A المتأخر',
          updatedAt: t1,
        });

      expect(updateResA.status).toBe(409);
      expect(updateResA.body.message).toContain('تعارض في التحديث');

      // 4. Verify DB was not overwritten by Admin A (still has Admin B's version)
      const verifyRes = await request
        .get('/api/v1/admin/app-version?platform=android')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(verifyRes.body.latestVersionCode).toBe(10);
      expect(verifyRes.body.latestVersionName).toBe('0.2.0');
    });

    it('rejects update for unseeded platform with 404 NotFoundException', async () => {
      // Delete the seeded android row to simulate an unseeded platform state
      await prisma.appVersion.deleteMany();

      const res = await request
        .put('/api/v1/admin/app-version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          platform: 'android',
          latestVersionCode: 5,
          latestVersionName: '0.1.4',
          minSupportedVersionCode: 4,
          downloadUrl: 'https://faow.run/fawrun-v5.apk',
          updatedAt: new Date().toISOString(),
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('غير موجودة');
    });
  });
});
