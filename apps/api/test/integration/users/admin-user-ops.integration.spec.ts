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
});
