import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { cleanDatabase, prisma } from '../setup';
import { createTestApp, closeTestApp, getRequest } from '../helpers/app.helper';
import { seedAdmin, seedCustomer, seedRunner, loginAs } from '../helpers/seed.helper';

describe('Admin User Operations Integration Tests (feature/admin-support-ops)', () => {
  let request!: ReturnType<typeof getRequest>;
  let adminToken: string;
  let customerToken: string;
  let adminUser: any;
  let customerUser: any;
  let runnerUser: any;

  beforeAll(async () => {
    await createTestApp();
    request = getRequest();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();

    [adminUser, customerUser, runnerUser] = await Promise.all([
      seedAdmin(prisma),
      seedCustomer(prisma),
      seedRunner(prisma),
    ]);

    [adminToken, customerToken] = await Promise.all([
      loginAs(request, adminUser.whatsapp, 'Admin@12345'),
      loginAs(request, customerUser.whatsapp, 'Customer@12345'),
    ]);
  });

  describe('PUT /api/v1/admin/users/:id/reset-password (AS-2)', () => {
    it('successfully resets password, revokes active sessions, and writes AuditLog', async () => {
      // Customer has active refresh token from loginAs
      const tokensBefore = await prisma.refreshToken.findMany({
        where: { userId: customerUser.id, isRevoked: false },
      });
      expect(tokensBefore.length).toBeGreaterThan(0);

      const res = await request
        .put(`/api/v1/admin/users/${customerUser.id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'NewSecurePass@2026' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        statusCode: 200,
        message: expect.any(String),
      });

      // Old refresh tokens revoked
      const tokensAfter = await prisma.refreshToken.findMany({
        where: { userId: customerUser.id, isRevoked: false },
      });
      expect(tokensAfter.length).toBe(0);

      // Old login fails
      const oldLoginRes = await request.post('/api/v1/auth/login').send({
        whatsapp: customerUser.whatsapp,
        password: 'Customer@12345',
      });
      expect(oldLoginRes.status).toBe(401);

      // New login succeeds
      const newLoginRes = await request.post('/api/v1/auth/login').send({
        whatsapp: customerUser.whatsapp,
        password: 'NewSecurePass@2026',
      });
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.accessToken).toBeDefined();

      // AuditLog verified
      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          event: 'USER_PASSWORD_RESET_BY_ADMIN',
          actorId: adminUser.id,
        },
      });
      expect(auditEntry).toBeDefined();
      expect((auditEntry?.meta as any)?.targetUserId).toBe(customerUser.id);
      expect((auditEntry?.meta as any)?.targetRole).toBe('CUSTOMER');
      expect((auditEntry?.meta as any)?.wasLocked).toBe(false);
    });

    it('unlocks a locked user when password is reset by admin, allowing immediate login with new credentials (BF-3)', async () => {
      // 1. Lock the customer account
      await prisma.user.update({
        where: { id: customerUser.id },
        data: {
          failedLoginAttempts: 5,
          loginLockedAt: new Date(),
        },
      });

      // 2. Verify account is locked upon login attempt (even with valid or invalid password)
      const lockedLoginRes = await request.post('/api/v1/auth/login').send({
        whatsapp: customerUser.whatsapp,
        password: 'Customer@12345',
      });
      expect(lockedLoginRes.status).toBe(403);
      expect(lockedLoginRes.body.message).toContain('لقد تجاوزت الحد المسموح من محاولات تسجيل الدخول');

      // 3. Admin resets password
      const resetRes = await request
        .put(`/api/v1/admin/users/${customerUser.id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'UnlockedPass@2026' });

      expect(resetRes.status).toBe(200);

      // 4. Verify user in DB has reset attempts and null loginLockedAt
      const updatedUser = await prisma.user.findUnique({
        where: { id: customerUser.id },
        select: { failedLoginAttempts: true, loginLockedAt: true },
      });
      expect(updatedUser?.failedLoginAttempts).toBe(0);
      expect(updatedUser?.loginLockedAt).toBeNull();

      // 5. Verify audit log recorded wasLocked: true
      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          event: 'USER_PASSWORD_RESET_BY_ADMIN',
          actorId: adminUser.id,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditEntry).toBeDefined();
      expect((auditEntry?.meta as any)?.wasLocked).toBe(true);

      // 6. Immediate login with new password succeeds with 200 OK
      const newLoginRes = await request.post('/api/v1/auth/login').send({
        whatsapp: customerUser.whatsapp,
        password: 'UnlockedPass@2026',
      });
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.accessToken).toBeDefined();
    });

    it('rejects attempt to reset password of an ADMIN account with 403 Forbidden', async () => {
      const anotherAdmin = await prisma.user.create({
        data: {
          name: 'Super Admin',
          whatsapp: '0999000099',
          passwordHash: 'hash',
          role: 'ADMIN',
          status: 'VERIFIED',
          admin: { create: {} },
        },
      });

      const res = await request
        .put(`/api/v1/admin/users/${anotherAdmin.id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'BrandNewPass@2026' });

      expect(res.status).toBe(403);
    });

    it('rejects non-admin caller with 403 Forbidden', async () => {
      const res = await request
        .put(`/api/v1/admin/users/${customerUser.id}/reset-password`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ password: 'BrandNewPass@2026' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/admin/users/:id (AS-3)', () => {
    it('rejects attempt to soft delete an ADMIN account with 403 Forbidden', async () => {
      const res = await request
        .delete(`/api/v1/admin/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(403);
    });

    it('rejects soft delete for customer with active in-progress order with 409 Conflict', async () => {
      await prisma.order.create({
        data: {
          customerId: customerUser.customer.id,
          status: 'IN_PROGRESS',
          deliveryLat: 33.5,
          deliveryLng: 36.3,
          deliveryDesc: 'Test Address',
          baseFee: 60,
          totalFee: 60,
        },
      });

      const res = await request
        .delete(`/api/v1/admin/users/${customerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Closing account' });

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('Cannot delete customer with active');
    });

    it('rejects soft delete for runner with active delivery assignments with 409 Conflict', async () => {
      await prisma.order.create({
        data: {
          customerId: customerUser.customer.id,
          runnerId: runnerUser.runner.id,
          status: 'ASSIGNED',
          deliveryLat: 33.5,
          deliveryLng: 36.3,
          deliveryDesc: 'Test Address',
          baseFee: 60,
          totalFee: 60,
        },
      });

      const res = await request
        .delete(`/api/v1/admin/users/${runnerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('active delivery assignments');
    });

    it('rejects soft delete for runner with delivered orders awaiting settlement closure with 409 Conflict', async () => {
      await prisma.order.create({
        data: {
          customerId: customerUser.customer.id,
          runnerId: runnerUser.runner.id,
          status: 'DELIVERED',
          deliveryLat: 33.5,
          deliveryLng: 36.3,
          deliveryDesc: 'Test Address',
          baseFee: 60,
          totalFee: 60,
        },
      });

      const res = await request
        .delete(`/api/v1/admin/users/${runnerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('awaiting daily settlement closure');
    });

    it('rejects soft delete for runner with pending settlement with 409 Conflict', async () => {
      await prisma.settlement.create({
        data: {
          runnerId: runnerUser.runner.id,
          operationalDate: '2026-10-29',
          status: 'PENDING',
          totalOrders: 1,
          totalFees: 100,
        },
      });

      const res = await request
        .delete(`/api/v1/admin/users/${runnerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.message).toContain('unsettled operational day settlements');
    });

    it('successfully soft deletes customer without active blockers and revokes login', async () => {
      // Completed order is allowed
      await prisma.order.create({
        data: {
          customerId: customerUser.customer.id,
          status: 'DELIVERED',
          deliveryLat: 33.5,
          deliveryLng: 36.3,
          deliveryDesc: 'Test Address',
          baseFee: 60,
          totalFee: 60,
        },
      });

      const res = await request
        .delete(`/api/v1/admin/users/${customerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'User requested deletion' });

      expect(res.status).toBe(200);

      // Verify DB status
      const updatedUser = await prisma.user.findUnique({
        where: { id: customerUser.id },
      });
      expect(updatedUser?.isDeleted).toBe(true);

      // Verify login fails
      const loginRes = await request.post('/api/v1/auth/login').send({
        whatsapp: customerUser.whatsapp,
        password: 'Customer@12345',
      });
      expect(loginRes.status).toBe(401);

      // Verify AuditLog
      const audit = await prisma.auditLog.findFirst({
        where: {
          event: 'USER_SOFT_DELETED',
          actorId: adminUser.id,
        },
      });
      expect(audit).toBeDefined();
      expect((audit?.meta as any)?.targetUserId).toBe(customerUser.id);
      expect((audit?.meta as any)?.reason).toBe('User requested deletion');
    });

    it('successfully soft deletes runner, deactivates status to UNAVAILABLE & isVisible to false', async () => {
      const res = await request
        .delete(`/api/v1/admin/users/${runnerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(200);

      const [updatedUser, updatedRunner] = await Promise.all([
        prisma.user.findUnique({ where: { id: runnerUser.id } }),
        prisma.runner.findUnique({ where: { id: runnerUser.runner.id } }),
      ]);

      expect(updatedUser?.isDeleted).toBe(true);
      expect(updatedRunner?.status).toBe('UNAVAILABLE');
      expect(updatedRunner?.isVisible).toBe(false);
    });
  });

  describe('GET /api/v1/admin/users/:id/audit-logs (CD-3)', () => {
    it('successfully retrieves user audit logs mapped with actorName and event history', async () => {
      // Trigger an audit log for customer
      await request
        .put(`/api/v1/admin/users/${customerUser.id}/reset-password`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ password: 'NewSecurePass@2026' });

      const res = await request
        .get(`/api/v1/admin/users/${customerUser.id}/audit-logs`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);

      const resetLog = res.body.find((l: any) => l.event === 'USER_PASSWORD_RESET_BY_ADMIN');
      expect(resetLog).toBeDefined();
      expect(resetLog.actorId).toBe(adminUser.id);
      expect(resetLog.actorRole).toBe('ADMIN');
      expect(resetLog.actorName).toBe(adminUser.name);
      expect(resetLog.meta?.targetUserId).toBe(customerUser.id);
    });

    it('successfully retrieves historical audit logs recorded with legacy meta.userId pattern (e.g. USER_SUSPENDED)', async () => {
      // Seed a historical audit entry created with meta: { userId: ... }
      await prisma.auditLog.create({
        data: {
          actorId: adminUser.id,
          actorRole: 'ADMIN',
          event: 'USER_SUSPENDED',
          fromStatus: 'VERIFIED',
          toStatus: 'SUSPENDED',
          meta: { userId: customerUser.id, previousStatus: 'VERIFIED' },
        },
      });

      const res = await request
        .get(`/api/v1/admin/users/${customerUser.id}/audit-logs`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const suspendedLog = res.body.find((l: any) => l.event === 'USER_SUSPENDED');
      expect(suspendedLog).toBeDefined();
      expect(suspendedLog.actorId).toBe(adminUser.id);
      expect(suspendedLog.fromStatus).toBe('VERIFIED');
      expect(suspendedLog.toStatus).toBe('SUSPENDED');
      expect(suspendedLog.meta?.userId).toBe(customerUser.id);
    });

    it('rejects attempt to retrieve audit logs of an ADMIN account with 403 Forbidden', async () => {
      const res = await request
        .get(`/api/v1/admin/users/${adminUser.id}/audit-logs`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it('rejects non-admin caller with 403 Forbidden', async () => {
      const res = await request
        .get(`/api/v1/admin/users/${customerUser.id}/audit-logs`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 404 NotFound if user does not exist', async () => {
      const res = await request
        .get('/api/v1/admin/users/cuidnotexist00000000000000/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/admin/users/:id (CD-2)', () => {
    it('successfully retrieves customer details with aggregated stats and recent orders', async () => {
      // Create a test order for customer
      const order = await prisma.order.create({
        data: {
          customerId: customerUser.customer.id,
          status: 'DELIVERED',
          deliveryLat: 33.5138,
          deliveryLng: 36.2765,
          deliveryDesc: 'Customer Test Address',
          baseFee: 60,
          totalFee: 100,
        },
      });

      const res = await request
        .get(`/api/v1/admin/users/${customerUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(customerUser.id);
      expect(res.body.name).toBe(customerUser.name);
      expect(res.body.whatsapp).toBe(customerUser.whatsapp);
      expect(res.body.customer).toBeDefined();
      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.totalOrders).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.recentOrders)).toBe(true);
      expect(res.body.recentOrders.length).toBeGreaterThanOrEqual(1);

      const foundOrder = res.body.recentOrders.find((o: any) => o.id === order.id);
      expect(foundOrder).toBeDefined();
      expect(foundOrder.status).toBe('DELIVERED');
      expect(foundOrder.totalFee).toBe(100);

      // Verify Least Privilege: no passwordHash or tokens
      expect(res.body.passwordHash).toBeUndefined();
      expect(res.body.refreshTokens).toBeUndefined();
    });

    it('rejects attempt to inspect an ADMIN account with 403 Forbidden', async () => {
      const res = await request
        .get(`/api/v1/admin/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it('rejects non-admin caller with 403 Forbidden', async () => {
      const res = await request
        .get(`/api/v1/admin/users/${customerUser.id}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 404 NotFound if user does not exist', async () => {
      const res = await request
        .get('/api/v1/admin/users/cuidnotexist00000000000000')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/admin/users/:id/profile (CD-1)', () => {
    it('successfully updates customer name and altPhone and logs USER_PROFILE_UPDATED_BY_ADMIN', async () => {
      const res = await request
        .put(`/api/v1/admin/users/${customerUser.id}/profile`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Customer Updated By Admin',
          altPhone: '0988776655',
        });

      expect(res.status).toBe(200);
      expect(res.body.statusCode).toBe(200);
      expect(res.body.user.name).toBe('Customer Updated By Admin');
      expect(res.body.user.altPhone).toBe('0988776655');

      // Verify DB update
      const dbUser = await prisma.user.findUnique({
        where: { id: customerUser.id },
      });
      expect(dbUser?.name).toBe('Customer Updated By Admin');
      expect(dbUser?.altPhone).toBe('0988776655');

      // Verify AuditLog
      const audit = await prisma.auditLog.findFirst({
        where: {
          event: 'USER_PROFILE_UPDATED_BY_ADMIN',
          actorId: adminUser.id,
        },
      });
      expect(audit).toBeDefined();
      expect((audit?.meta as any)?.targetUserId).toBe(customerUser.id);
      expect((audit?.meta as any)?.newName).toBe('Customer Updated By Admin');
      expect((audit?.meta as any)?.newAltPhone).toBe('0988776655');
    });

    it('rejects attempt to update profile of an ADMIN account with 403 Forbidden', async () => {
      const res = await request
        .put(`/api/v1/admin/users/${adminUser.id}/profile`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Hacked Admin' });

      expect(res.status).toBe(403);
    });

    it('rejects attempt to update profile of a non-customer account with 400 BadRequest', async () => {
      const res = await request
        .put(`/api/v1/admin/users/${runnerUser.id}/profile`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Runner' });

      expect(res.status).toBe(400);
    });

    it('rejects non-admin caller with 403 Forbidden', async () => {
      const res = await request
        .put(`/api/v1/admin/users/${customerUser.id}/profile`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ name: 'Unauthorized Update' });

      expect(res.status).toBe(403);
    });

    it('rejects payload when neither name nor altPhone is provided with 400 BadRequest', async () => {
      const res = await request
        .put(`/api/v1/admin/users/${customerUser.id}/profile`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
