import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { cleanDatabase, prisma } from '../setup.js';
import { createTestApp, closeTestApp, getRequest, getTestApp } from '../helpers/app.helper.js';
import { seedAdmin, seedCustomer, seedRunner, loginAs } from '../helpers/seed.helper.js';
import { SchemaDriftService } from '../../../src/modules/system/schema-drift.service.js';

describe('Schema Drift Endpoint Integration (C-6)', () => {
  let request!: ReturnType<typeof getRequest>;
  let adminToken: string;
  let adminUser: Awaited<ReturnType<typeof seedAdmin>>;
  let customerToken: string;
  let runnerToken: string;

  beforeAll(async () => {
    await createTestApp();
    request = getRequest();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();

    adminUser = await seedAdmin(prisma);
    adminToken = await loginAs(request, adminUser.whatsapp, 'Admin@12345');

    const customerUser = await seedCustomer(prisma);
    customerToken = await loginAs(request, customerUser.whatsapp, 'Customer@12345');

    const runnerUser = await seedRunner(prisma);
    runnerToken = await loginAs(request, runnerUser.whatsapp, 'Runner@12345');
  });

  describe('Authorization and Access Control', () => {
    it('returns 401 Unauthorized when no auth token is provided', async () => {
      const res = await request
        .get('/api/v1/admin/system/schema-drift')
        .expect(401);

      expect(res.body.message).toBeDefined();
    });

    it('returns 403 Forbidden when called by a CUSTOMER role', async () => {
      const res = await request
        .get('/api/v1/admin/system/schema-drift')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      expect(res.body.message).toBeDefined();
    });

    it('returns 403 Forbidden when called by a RUNNER role', async () => {
      const res = await request
        .get('/api/v1/admin/system/schema-drift')
        .set('Authorization', `Bearer ${runnerToken}`)
        .expect(403);

      expect(res.body.message).toBeDefined();
    });
  });

  describe('Successful Diagnostic Execution for ADMIN', () => {
    it('returns 200 with schema inspection result and writes AuditLog', async () => {
      const res = await request
        .get('/api/v1/admin/system/schema-drift')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('status');
      expect(['IN_SYNC', 'DRIFT_DETECTED']).toContain(res.body.status);
      expect(res.body).toHaveProperty('checkedAt');
      expect(res.body).toHaveProperty('summary');
      expect(res.body.summary).toHaveProperty('expectedModels');
      expect(res.body.summary).toHaveProperty('actualTables');
      expect(Array.isArray(res.body.summary.missingTables)).toBe(true);
      expect(Array.isArray(res.body.summary.extraTables)).toBe(true);

      // Verify AuditLog record was created
      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          event: 'SYSTEM_SCHEMA_DRIFT_CHECK',
          actorId: adminUser.id,
        },
      });

      expect(auditEntry).not.toBeNull();
      expect(auditEntry?.actorRole).toBe('ADMIN');
      expect((auditEntry?.meta as any)?.status).toBe(res.body.status);
    });

    it('enforces 10-second per-admin rate limit on rapid consecutive calls', async () => {
      // First call succeeds
      await request
        .get('/api/v1/admin/system/schema-drift')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Second immediate call from same admin throws 429
      const secondRes = await request
        .get('/api/v1/admin/system/schema-drift')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(429);

      expect(secondRes.body.error).toBe('TOO_MANY_REQUESTS');
    });

    it('correctly reports DRIFT_DETECTED and logs audit when drift exists', async () => {
      // Create a second admin to bypass the 10-second rate limit
      const secondAdmin = await prisma.user.create({
        data: {
          name: 'Second Admin',
          whatsapp: '0999000099',
          passwordHash: adminUser.passwordHash,
          role: 'ADMIN',
          status: 'VERIFIED',
          admin: { create: {} },
        },
        include: { admin: true },
      });
      const secondAdminToken = await loginAs(request, secondAdmin.whatsapp, 'Admin@12345');

      const service = getTestApp().get(SchemaDriftService);
      // Spy on compareSchemas to simulate a drift scenario with a missing table
      const compareSpy = vi.spyOn(service, 'compareSchemas').mockReturnValueOnce({
        expectedModels: 19,
        actualTables: 18,
        missingTables: ['SimulatedMissingTable'],
        extraTables: [],
        missingColumns: [],
        extraColumns: [],
      });

      const res = await request
        .get('/api/v1/admin/system/schema-drift')
        .set('Authorization', `Bearer ${secondAdminToken}`)
        .expect(200);

      expect(res.body.status).toBe('DRIFT_DETECTED');
      expect(res.body.summary.missingTables).toContain('SimulatedMissingTable');

      // Verify audit log for the simulated drift
      const driftAudit = await prisma.auditLog.findFirst({
        where: {
          event: 'SYSTEM_SCHEMA_DRIFT_CHECK',
          actorId: secondAdmin.id,
        },
      });

      expect(driftAudit).not.toBeNull();
      expect((driftAudit?.meta as any)?.status).toBe('DRIFT_DETECTED');

      compareSpy.mockRestore();
    });
  });
});
