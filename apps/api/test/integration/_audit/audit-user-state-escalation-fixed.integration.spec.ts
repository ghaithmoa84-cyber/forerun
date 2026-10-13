import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import supertest from 'supertest';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { seedAdmin, loginAs } from '../helpers/seed.helper';
import { cleanDatabase } from '../setup';

describe('Audit: User Status Remediation & Escalation Prevention (Post-Fix Verification)', () => {
  let app: INestApplication;
  let request: ReturnType<typeof supertest>;
  let prisma: PrismaClient;

  beforeAll(async () => {
    app = await createTestApp();
    request = supertest(app.getHttpServer());
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL } },
    });
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await closeTestApp();
  });

  it('Case 1: Direct unsuspend on REJECTED user is strictly REJECTED (422)', async () => {
    await cleanDatabase();
    const admin = await seedAdmin(prisma);
    const adminToken = await loginAs(request, admin.whatsapp, 'Admin@12345');

    const customer = await prisma.user.create({
      data: {
        name: 'Rejected Customer',
        whatsapp: '0999111222',
        passwordHash: 'dummy',
        role: UserRole.CUSTOMER,
        status: UserStatus.PENDING_VERIFICATION,
        customer: { create: {} },
      },
    });

    // Reject customer
    const resReject = await request
      .put(`/api/v1/admin/users/${customer.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resReject.status).toBe(200);

    // Call unsuspend DIRECTLY on REJECTED customer
    const resDirectUnsuspend = await request
      .put(`/api/v1/admin/users/${customer.id}/unsuspend`)
      .set('Authorization', `Bearer ${adminToken}`);

    console.log('[POST-FIX Case 1] Direct unsuspend on REJECTED user status:', resDirectUnsuspend.status, resDirectUnsuspend.body);
    expect(resDirectUnsuspend.status).toBe(422);

    const userAfter = await prisma.user.findUnique({ where: { id: customer.id } });
    expect(userAfter?.status).toBe(UserStatus.REJECTED);
  });

  it('Case 2: PENDING_VERIFICATION user suspended then unsuspended restores to PENDING_VERIFICATION (NOT VERIFIED)', async () => {
    await cleanDatabase();
    const admin = await seedAdmin(prisma);
    const adminToken = await loginAs(request, admin.whatsapp, 'Admin@12345');

    const unverifiedCustomer = await prisma.user.create({
      data: {
        name: 'Pending Customer',
        whatsapp: '0999333444',
        passwordHash: 'dummy',
        role: UserRole.CUSTOMER,
        status: UserStatus.PENDING_VERIFICATION,
      },
    });

    // Suspend directly while pending
    const resSuspend = await request
      .put(`/api/v1/admin/users/${unverifiedCustomer.id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    expect(resSuspend.status).toBe(200);

    const userAfterSuspend = await prisma.user.findUnique({ where: { id: unverifiedCustomer.id } });
    expect(userAfterSuspend?.status).toBe(UserStatus.SUSPENDED);
    expect(userAfterSuspend?.previousStatus).toBe(UserStatus.PENDING_VERIFICATION);

    // Unsuspend
    const resUnsuspend = await request
      .put(`/api/v1/admin/users/${unverifiedCustomer.id}/unsuspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    expect(resUnsuspend.status).toBe(200);

    const userFinal = await prisma.user.findUnique({ where: { id: unverifiedCustomer.id } });
    console.log('[POST-FIX Case 2] Status of unverified customer after unsuspend:', userFinal?.status);
    // User is safely restored to PENDING_VERIFICATION, NOT VERIFIED!
    expect(userFinal?.status).toBe(UserStatus.PENDING_VERIFICATION);
  });

  it('Case 3: REJECTED user suspended cannot be unsuspended (prevents backdoor escalation)', async () => {
    await cleanDatabase();
    const admin = await seedAdmin(prisma);
    const adminToken = await loginAs(request, admin.whatsapp, 'Admin@12345');

    const rejectedUser = await prisma.user.create({
      data: {
        name: 'Suspended Rejected User',
        whatsapp: '0999555666',
        passwordHash: 'dummy',
        role: UserRole.CUSTOMER,
        status: UserStatus.REJECTED,
      },
    });

    // Suspend the rejected user
    const resSuspend = await request
      .put(`/api/v1/admin/users/${rejectedUser.id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    expect(resSuspend.status).toBe(200);

    // Attempting to unsuspend must be rejected
    const resUnsuspend = await request
      .put(`/api/v1/admin/users/${rejectedUser.id}/unsuspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();

    console.log('[POST-FIX Case 3] Unsuspend on user whose previousStatus was REJECTED:', resUnsuspend.status, resUnsuspend.body);
    expect(resUnsuspend.status).toBe(422);

    const userFinal = await prisma.user.findUnique({ where: { id: rejectedUser.id } });
    expect(userFinal?.status).toBe(UserStatus.SUSPENDED);
  });

  it('Case 4: Legitimate VERIFIED user suspended then unsuspended restores to VERIFIED', async () => {
    await cleanDatabase();
    const admin = await seedAdmin(prisma);
    const adminToken = await loginAs(request, admin.whatsapp, 'Admin@12345');

    const customer = await prisma.user.create({
      data: {
        name: 'Verified Customer',
        whatsapp: '0999888999',
        passwordHash: 'dummy',
        role: UserRole.CUSTOMER,
        status: UserStatus.VERIFIED,
      },
    });

    const resSuspend = await request
      .put(`/api/v1/admin/users/${customer.id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    expect(resSuspend.status).toBe(200);

    const resUnsuspend = await request
      .put(`/api/v1/admin/users/${customer.id}/unsuspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    expect(resUnsuspend.status).toBe(200);

    const userFinal = await prisma.user.findUnique({ where: { id: customer.id } });
    expect(userFinal?.status).toBe(UserStatus.VERIFIED);
    expect(userFinal?.previousStatus).toBeNull();
  });

  it('Case 5: Concurrent parallel suspend calls are protected against race conditions', async () => {
    await cleanDatabase();
    const admin = await seedAdmin(prisma);
    const adminToken = await loginAs(request, admin.whatsapp, 'Admin@12345');

    const customer = await prisma.user.create({
      data: {
        name: 'Concurrent Customer',
        whatsapp: '0999777888',
        passwordHash: 'dummy',
        role: UserRole.CUSTOMER,
        status: UserStatus.VERIFIED,
      },
    });

    const [res1, res2] = await Promise.all([
      request
        .put(`/api/v1/admin/users/${customer.id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(),
      request
        .put(`/api/v1/admin/users/${customer.id}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(),
    ]);

    console.log('[POST-FIX Case 5] Concurrent suspend statuses:', res1.status, res2.status);
    const statuses = [res1.status, res2.status].sort();
    // One succeeds (200), the other is rejected (409 or 422)
    expect(statuses[0]).toBe(200);
    expect([409, 422]).toContain(statuses[1]);

    const auditCount = await prisma.auditLog.count({
      where: { event: 'USER_SUSPENDED', meta: { path: ['userId'], equals: customer.id } },
    });
    expect(auditCount).toBe(1);
  });
});
