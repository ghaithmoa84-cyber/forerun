/**
 * ⚠️ HISTORICAL PROOF OF CONCEPT (PoC) — DEFECT DEMONSTRATION
 *
 * الغرض: هذا الملف يثبت تاريخياً عيب تجميع التسويات بـ createdAt وضياع الطلبات المسلمة لاحقاً قبل الإصلاح.
 * فشل هذا الاختبار الآن متوقَّع ومطلوب كدليل سلبي (Negative Proof) على نجاح وسريان الإصلاح البرمجي بـ deliveredAt و 409 Conflict.
 * لا يُدرج هذا الملف ضمن مجموعة الاختبارات التي يجب أن تنجح في CI، ويُشغَّل يدوياً فقط عند تدقيق تاريخ الثغرات.
 * الاختبار المعتمد لإثبات نجاح الإصلاح هو: audit-close-day-fixed.integration.spec.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient, OrderStatus } from '@prisma/client';
import supertest from 'supertest';
import { createTestApp, closeTestApp } from '../../helpers/app.helper';
import { seedAdmin, seedRunner, seedCustomer, loginAs } from '../../helpers/seed.helper';
import { cleanDatabase } from '../../setup';

describe('Audit #12 & #13: Settlement closeDay Date Filtering & Re-closing Defect', () => {
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

  it('proves money omission: order created yesterday and delivered today is skipped in today settlement, and permanently lost if yesterday was closed', async () => {
    await cleanDatabase();
    const admin = await seedAdmin(prisma);
    const runner = await seedRunner(prisma);
    const customer = await seedCustomer(prisma);

    const yesterday = new Date('2026-10-10T12:00:00.000Z');
    const today = new Date('2026-10-11T12:00:00.000Z');

    // Order created yesterday, but completed/delivered today
    const order = await prisma.order.create({
      data: {
        customerId: customer.customer!.id,
        runnerId: runner.runner!.id,
        orderNumber: 'FW-AUDIT-13-001',
        status: OrderStatus.DELIVERED,
        deliveryLat: 33.5138,
        deliveryLng: 36.2765,
        deliveryDesc: 'Damascus Test Location',
        baseFee: 60,
        extraStoresFee: 0,
        totalFee: 60,
        createdAt: yesterday,
        deliveredAt: today,
      },
    });

    const adminToken = await loginAs(request, admin.whatsapp, 'Admin@12345');

    // 1. Run closeDay for TODAY (the actual completion date of the order)
    const resToday = await request
      .post('/api/v1/admin/settlements/close-day')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ operationalDate: '2026-10-11', notes: 'Closing today 2026-10-11' });

    console.log('[AUDIT #13] CLOSE-DAY FOR TODAY STATUS:', resToday.status, resToday.body);
    expect(resToday.status).toBe(201);

    // Verify whether this delivered order is included in today settlement
    const todayItems = await prisma.settlementItem.findMany({
      where: { orderId: order.id },
    });
    console.log('[AUDIT #13] SETTLEMENT ITEMS IN TODAY FOR ORDER:', todayItems.length);
    // Defect #13: Because closeDay filters by createdAt instead of deliveredAt, order is OMITTED from today!
    expect(todayItems.length).toBe(0);

    // 2. Now run closeDay for YESTERDAY
    const resYesterday = await request
      .post('/api/v1/admin/settlements/close-day')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ operationalDate: '2026-10-10', notes: 'Closing yesterday 2026-10-10' });

    console.log('[AUDIT #13] CLOSE-DAY FOR YESTERDAY STATUS:', resYesterday.status, resYesterday.body);
    expect(resYesterday.status).toBe(201);

    const yesterdayItems = await prisma.settlementItem.findMany({
      where: { orderId: order.id },
    });
    console.log('[AUDIT #13] SETTLEMENT ITEMS AFTER YESTERDAY CLOSE:', yesterdayItems.length);
    // The order was settled retroactively on yesterday settlement:
    expect(yesterdayItems.length).toBe(1);

    // 3. Re-run closeDay for YESTERDAY to test re-closing idempotency and silent skip (#12)
    const resYesterdayReclose = await request
      .post('/api/v1/admin/settlements/close-day')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ operationalDate: '2026-10-10', notes: 'Re-closing yesterday 2026-10-10' });

    console.log('[AUDIT #12] RE-CLOSE YESTERDAY RESULT:', resYesterdayReclose.status, resYesterdayReclose.body);
    expect(resYesterdayReclose.status).toBe(201);
    expect(resYesterdayReclose.body.settlements.length).toBe(0);

    const totalRunnerSettlements = await prisma.settlement.count({
      where: { runnerId: runner.runner!.id },
    });
    console.log('[AUDIT #12] TOTAL SETTLEMENTS COUNT FOR RUNNER:', totalRunnerSettlements);
    expect(totalRunnerSettlements).toBe(1);
  });
});
