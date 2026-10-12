import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import supertest from 'supertest';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { seedAdmin, loginAs } from '../helpers/seed.helper';
import { cleanDatabase } from '../setup';

describe('Audit: Double Suspend & PreviousStatus Overwrite Protection', () => {
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

  it('Scenario 1: VERIFIED -> suspend -> suspend (double) -> verify 422 & previousStatus preserved -> unsuspend restores to VERIFIED', async () => {
    await cleanDatabase();
    const admin = await seedAdmin(prisma);
    const adminToken = await loginAs(request, admin.whatsapp, 'Admin@12345');

    // 1. Create a VERIFIED user
    const customer = await prisma.user.create({
      data: {
        name: 'Verified Customer Test',
        whatsapp: '0999555111',
        passwordHash: 'dummy',
        role: UserRole.CUSTOMER,
        status: UserStatus.VERIFIED,
        customer: { create: {} },
      },
    });

    // 2. First suspend call
    const resSuspend1 = await request
      .put(`/api/v1/admin/users/${customer.id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`);

    console.log('[Scenario 1 - First Suspend] Status:', resSuspend1.status, resSuspend1.body);
    expect(resSuspend1.status).toBe(200);

    const userAfterFirstSuspend = await prisma.user.findUnique({ where: { id: customer.id } });
    expect(userAfterFirstSuspend?.status).toBe(UserStatus.SUSPENDED);
    expect(userAfterFirstSuspend?.previousStatus).toBe(UserStatus.VERIFIED);

    // 3. Second suspend call on already SUSPENDED user
    const resSuspend2 = await request
      .put(`/api/v1/admin/users/${customer.id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`);

    console.log('[Scenario 1 - Second Suspend] Status:', resSuspend2.status, resSuspend2.body);
    // Must be rejected with 422 Unprocessable Entity
    expect(resSuspend2.status).toBe(422);
    expect(resSuspend2.body.message).toMatch(/already suspended/i);

    // 4. Verify DB state: previousStatus was NOT overwritten or corrupted
    const userAfterSecondSuspend = await prisma.user.findUnique({ where: { id: customer.id } });
    expect(userAfterSecondSuspend?.status).toBe(UserStatus.SUSPENDED);
    expect(userAfterSecondSuspend?.previousStatus).toBe(UserStatus.VERIFIED);

    // 5. Unsuspend call: user must be restored cleanly to VERIFIED
    const resUnsuspend = await request
      .put(`/api/v1/admin/users/${customer.id}/unsuspend`)
      .set('Authorization', `Bearer ${adminToken}`);

    console.log('[Scenario 1 - Unsuspend] Status:', resUnsuspend.status, resUnsuspend.body);
    expect(resUnsuspend.status).toBe(200);

    const userAfterUnsuspend = await prisma.user.findUnique({ where: { id: customer.id } });
    expect(userAfterUnsuspend?.status).toBe(UserStatus.VERIFIED);
  });

  it('Scenario 2: REJECTED -> suspend -> suspend (double) -> verify 422 & previousStatus preserved -> unsuspend is strictly REJECTED (422)', async () => {
    await cleanDatabase();
    const admin = await seedAdmin(prisma);
    const adminToken = await loginAs(request, admin.whatsapp, 'Admin@12345');

    // 1. Create a PENDING user, then reject
    const customer = await prisma.user.create({
      data: {
        name: 'Rejected Customer Test',
        whatsapp: '0999555222',
        passwordHash: 'dummy',
        role: UserRole.CUSTOMER,
        status: UserStatus.PENDING_VERIFICATION,
        customer: { create: {} },
      },
    });

    const resReject = await request
      .put(`/api/v1/admin/users/${customer.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resReject.status).toBe(200);

    const userRejected = await prisma.user.findUnique({ where: { id: customer.id } });
    expect(userRejected?.status).toBe(UserStatus.REJECTED);

    // 2. First suspend call
    const resSuspend1 = await request
      .put(`/api/v1/admin/users/${customer.id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`);

    console.log('[Scenario 2 - First Suspend] Status:', resSuspend1.status, resSuspend1.body);
    expect(resSuspend1.status).toBe(200);

    const userAfterFirstSuspend = await prisma.user.findUnique({ where: { id: customer.id } });
    expect(userAfterFirstSuspend?.status).toBe(UserStatus.SUSPENDED);
    expect(userAfterFirstSuspend?.previousStatus).toBe(UserStatus.REJECTED);

    // 3. Second suspend call on already SUSPENDED user
    const resSuspend2 = await request
      .put(`/api/v1/admin/users/${customer.id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`);

    console.log('[Scenario 2 - Second Suspend] Status:', resSuspend2.status, resSuspend2.body);
    // Must be rejected with 422 Unprocessable Entity
    expect(resSuspend2.status).toBe(422);
    expect(resSuspend2.body.message).toMatch(/already suspended/i);

    // 4. Verify DB state: previousStatus remains REJECTED (never overwritten with SUSPENDED)
    const userAfterSecondSuspend = await prisma.user.findUnique({ where: { id: customer.id } });
    expect(userAfterSecondSuspend?.status).toBe(UserStatus.SUSPENDED);
    expect(userAfterSecondSuspend?.previousStatus).toBe(UserStatus.REJECTED);

    // 5. Unsuspend call: MUST be rejected with 422 because user was REJECTED prior to suspension
    const resUnsuspend = await request
      .put(`/api/v1/admin/users/${customer.id}/unsuspend`)
      .set('Authorization', `Bearer ${adminToken}`);

    console.log('[Scenario 2 - Unsuspend Attempt] Status:', resUnsuspend.status, resUnsuspend.body);
    expect(resUnsuspend.status).toBe(422);
    expect(resUnsuspend.body.message).toMatch(/Cannot unsuspend account that was rejected prior to suspension/i);

    // Final verify: user is STILL SUSPENDED, never activated
    const finalUser = await prisma.user.findUnique({ where: { id: customer.id } });
    expect(finalUser?.status).toBe(UserStatus.SUSPENDED);
    expect(finalUser?.previousStatus).toBe(UserStatus.REJECTED);
  });
});
