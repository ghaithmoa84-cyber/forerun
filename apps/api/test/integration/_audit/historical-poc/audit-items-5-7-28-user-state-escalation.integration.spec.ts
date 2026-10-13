/**
 * ⚠️ HISTORICAL PROOF OF CONCEPT (PoC) — DEFECT DEMONSTRATION
 *
 * الغرض: هذا الملف يثبت تاريخياً وجود ثغرة ترقية الصلاحيات وغياب آلة حالة المستخدم قبل الإصلاح.
 * فشل هذا الاختبار الآن متوقَّع ومطلوب كدليل سلبي (Negative Proof) على نجاح وسريان الإصلاح البرمجي.
 * لا يُدرج هذا الملف ضمن مجموعة الاختبارات التي يجب أن تنجح في CI، ويُشغَّل يدوياً فقط عند تدقيق تاريخ الثغرات.
 * الاختبار المعتمد لإثبات نجاح الإصلاح هو: audit-user-state-escalation-fixed.integration.spec.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';
import supertest from 'supertest';
import { createTestApp, closeTestApp } from '../../helpers/app.helper';
import { seedAdmin, seedRunner, seedCustomer, loginAs } from '../../helpers/seed.helper';
import { cleanDatabase } from '../../setup';

describe('Audit #5, #7, #28: User State Machine Absence & Privilege Escalation Matrix', () => {
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

  it('Case 1: Direct unsuspend() on REJECTED user escalates directly to VERIFIED without suspend', async () => {
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
      },
    });

    // Reject customer
    const resReject = await request
      .put(`/api/v1/admin/users/${customer.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resReject.status).toBe(200);

    const userAfterReject = await prisma.user.findUnique({ where: { id: customer.id } });
    expect(userAfterReject?.status).toBe(UserStatus.REJECTED);
    console.log('[AUDIT #5-7-28 Case 1] Customer status after reject:', userAfterReject?.status);

    // Call unsuspend DIRECTLY on REJECTED customer (without suspend)
    const resDirectUnsuspend = await request
      .put(`/api/v1/admin/users/${customer.id}/unsuspend`)
      .set('Authorization', `Bearer ${adminToken}`);

    console.log('[AUDIT #5-7-28 Case 1] Direct unsuspend on REJECTED user status:', resDirectUnsuspend.status, resDirectUnsuspend.body);
    expect(resDirectUnsuspend.status).toBe(200);

    const userAfterDirectUnsuspend = await prisma.user.findUnique({ where: { id: customer.id } });
    console.log('[AUDIT #5-7-28 Case 1] Final status after direct unsuspend:', userAfterDirectUnsuspend?.status);
    // Directly promoted from REJECTED to VERIFIED!
    expect(userAfterDirectUnsuspend?.status).toBe(UserStatus.VERIFIED);
  });

  it('Case 2: PENDING_VERIFICATION user escalated to VERIFIED via suspend -> unsuspend', async () => {
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
    console.log('[AUDIT #5-7-28 Case 2] Status after suspend from pending:', userAfterSuspend?.status);

    // Unsuspend
    const resUnsuspend = await request
      .put(`/api/v1/admin/users/${unverifiedCustomer.id}/unsuspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    expect(resUnsuspend.status).toBe(200);

    const userFinal = await prisma.user.findUnique({ where: { id: unverifiedCustomer.id } });
    console.log('[AUDIT #5-7-28 Case 2] Final status of pending customer:', userFinal?.status);
    // Unverified customer promoted to VERIFIED bypassing verification checks!
    expect(userFinal?.status).toBe(UserStatus.VERIFIED);
  });

  it('Case 3: RUNNER in PENDING_VERIFICATION promoted to VERIFIED via unsuspend (no role check in unsuspend)', async () => {
    await cleanDatabase();
    const admin = await seedAdmin(prisma);
    const adminToken = await loginAs(request, admin.whatsapp, 'Admin@12345');

    const pendingRunnerUser = await prisma.user.create({
      data: {
        name: 'Pending Runner User',
        whatsapp: '0999555666',
        passwordHash: 'dummy',
        role: UserRole.RUNNER,
        status: UserStatus.PENDING_VERIFICATION,
        runner: { create: { status: 'UNAVAILABLE' } },
      },
    });

    // Verify endpoint rejects RUNNER role
    const resVerify = await request
      .put(`/api/v1/admin/users/${pendingRunnerUser.id}/verify`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    console.log('[AUDIT #5-7-28 Case 3] verify() on RUNNER returns:', resVerify.status);
    expect(resVerify.status).toBe(404); // role: CUSTOMER check in verify() blocks runners

    // BUT suspend works on RUNNER!
    const resSuspend = await request
      .put(`/api/v1/admin/users/${pendingRunnerUser.id}/suspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    expect(resSuspend.status).toBe(200);

    // AND unsuspend works on RUNNER and promotes to VERIFIED!
    const resUnsuspend = await request
      .put(`/api/v1/admin/users/${pendingRunnerUser.id}/unsuspend`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    expect(resUnsuspend.status).toBe(200);

    const runnerFinal = await prisma.user.findUnique({ where: { id: pendingRunnerUser.id } });
    console.log('[AUDIT #5-7-28 Case 3] Runner status after unsuspend backdoor:', runnerFinal?.status);
    expect(runnerFinal?.status).toBe(UserStatus.VERIFIED);
  });

  it('Case 4: Double parallel suspend calls succeed without idempotency or transition guards', async () => {
    await cleanDatabase();
    const admin = await seedAdmin(prisma);
    const adminToken = await loginAs(request, admin.whatsapp, 'Admin@12345');

    const customer = await prisma.user.create({
      data: {
        name: 'Parallel Suspend Customer',
        whatsapp: '0999777888',
        passwordHash: 'dummy',
        role: UserRole.CUSTOMER,
        status: UserStatus.VERIFIED,
      },
    });

    // Fire 2 parallel suspend requests
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

    console.log('[AUDIT #5-7-28 Case 4] Parallel suspend results:', res1.status, res2.status);
    // Both return 200 OK because tx.user.update has no WHERE on current status!
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const auditLogs = await prisma.auditLog.findMany({
      where: { event: 'USER_SUSPENDED' },
    });
    console.log('[AUDIT #5-7-28 Case 4] USER_SUSPENDED AuditLog count:', auditLogs.length);
    // Produces duplicate audit events
    expect(auditLogs.length).toBe(2);
  });
});
