import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient, OrderStatus, OrderStoreStatus, UserRole, UserStatus } from '@prisma/client';
import supertest from 'supertest';
import * as bcrypt from 'bcrypt';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { seedAdmin, seedRunner, seedCustomer, loginAs } from '../helpers/seed.helper';
import { cleanDatabase } from '../setup';

describe('Audit: Final Comprehensive E2E Verification & Concurrency Stress Test', () => {
  let app: INestApplication;
  let request: ReturnType<typeof supertest>;
  let prisma: PrismaClient;

  let adminToken: string;
  let customerToken: string;
  let runnerToken: string;
  let adminUser: any;
  let customerUser: any;
  let runnerUser: any;

  beforeAll(async () => {
    app = await createTestApp();
    request = supertest(app.getHttpServer());
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL } },
    });
    await prisma.$connect();
    await cleanDatabase();

    adminUser = await seedAdmin(prisma);
    adminToken = await loginAs(request, adminUser.whatsapp, 'Admin@12345');

    customerUser = await seedCustomer(prisma);
    customerToken = await loginAs(request, customerUser.whatsapp, 'Customer@12345');

    runnerUser = await seedRunner(prisma, '0999000002');
    runnerToken = await loginAs(request, '0999000002', 'Runner@12345');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await closeTestApp();
  });

  it('1. Complete Production Lifecycle (Order -> Delivery -> closeDay -> Settlement -> Zero Drift)', async () => {
    // 1. Customer creates order
    const resCreate = await request
      .post('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [
          {
            itemName: 'Milk 1L',
            quantity: '2',
            customStoreName: 'Sham Supermarket',
            anyStore: false,
          },
        ],
        notes: null,
        preferredRunnerId: null,
        waitForPreferred: false,
        deliveryAddress: {
          lat: 33.5138,
          lng: 36.2765,
          description: 'Malki, Damascus',
        },
      });
    expect(resCreate.status).toBe(201);
    const orderId = resCreate.body.id;

    // 2. Admin starts review & approves order
    const resReview = await request
      .put(`/api/v1/admin/orders/${orderId}/start-review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(resReview.status).toBe(200);

    const resApprove = await request
      .put(`/api/v1/admin/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isPeripheral: false });
    expect(resApprove.status).toBe(200);

    // 3. Admin assigns runner
    const resAssign = await request
      .put(`/api/v1/admin/orders/${orderId}/assign-runner`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ runnerId: runnerUser.runner.id });
    expect(resAssign.status).toBe(200);

    // 4. Runner starts shopping
    const resStart = await request
      .put(`/api/v1/runner/orders/${orderId}/start`)
      .set('Authorization', `Bearer ${runnerToken}`)
      .send();
    expect(resStart.status).toBe(200);

    // Get store ID
    const orderWithStores = await prisma.order.findUnique({
      where: { id: orderId },
      include: { orderStores: true },
    });
    const storeId = orderWithStores!.orderStores[0].id;

    // 5. Runner purchases store
    const resPurchase = await request
      .put(`/api/v1/runner/orders/${orderId}/stores/${storeId}/purchase`)
      .set('Authorization', `Bearer ${runnerToken}`)
      .send();
    expect(resPurchase.status).toBe(200);

    // 6. Runner proceeds to delivery
    const resProceed = await request
      .put(`/api/v1/runner/orders/${orderId}/proceed-to-delivery`)
      .set('Authorization', `Bearer ${runnerToken}`)
      .send();
    expect(resProceed.status).toBe(200);

    // 7. Runner delivers order
    const resDeliver = await request
      .put(`/api/v1/runner/orders/${orderId}/deliver`)
      .set('Authorization', `Bearer ${runnerToken}`)
      .send({ idempotencyKey: '11111111-2222-3333-4444-555555555555' });
    expect(resDeliver.status).toBe(200);

    // Verify order deliveredAt is set
    const freshOrder = await prisma.order.findUnique({ where: { id: orderId } });
    expect(freshOrder?.status).toBe(OrderStatus.DELIVERED);
    expect(freshOrder?.deliveredAt).not.toBeNull();

    // 8. Admin closes the day for today
    const operationalDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Damascus',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const resClose = await request
      .post('/api/v1/admin/settlements/close-day')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ operationalDate, notes: 'E2E Full batch' });

    expect(resClose.status).toBe(201);
    expect(resClose.body.runnerCount).toBe(1);
    const settlement = resClose.body.settlements[0];
    expect(settlement.totalOrders).toBe(1);
    expect(settlement.totalFees).toBe(60);

    // Verification per D26/D48:
    // Base fee: 60, Extra stores: 0, Total fee: 60
    // Settlement model tracks totalFees only (legacy share columns dropped in C-2 migration)
    expect(settlement.totalFees).toBe(60);

    // 9. Admin marks settlement as settled
    const resMarkSettled = await request
      .put(`/api/v1/admin/settlements/${settlement.id}/mark-settled`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    expect(resMarkSettled.status).toBe(200);

    const freshSettlement = await prisma.settlement.findUnique({ where: { id: settlement.id } });
    expect(freshSettlement?.status).toBe('SETTLED');
    expect(freshSettlement?.closedAt).not.toBeNull();
  });

  it('2. Financial Concurrency Stress Test: Two concurrent closeDay calls on same date are strictly serialized', async () => {
    const operationalDate = '2026-10-25';

    // Seed a delivered order for 2026-10-25
    await prisma.order.create({
      data: {
        customerId: customerUser.customer.id,
        runnerId: runnerUser.runner.id,
        orderNumber: 'FW-CONCURRENCY-001',
        status: OrderStatus.DELIVERED,
        deliveryLat: 33.5,
        deliveryLng: 36.2,
        deliveryDesc: 'Test',
        baseFee: 60,
        totalFee: 60,
        deliveredAt: new Date('2026-10-25T12:00:00.000Z'),
      },
    });

    // Fire 2 concurrent closeDay requests in parallel
    const [resA, resB] = await Promise.all([
      request
        .post('/api/v1/admin/settlements/close-day')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ operationalDate, notes: 'Concurrent batch A' }),
      request
        .post('/api/v1/admin/settlements/close-day')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ operationalDate, notes: 'Concurrent batch B' }),
    ]);

    console.log('[CONCURRENCY TEST] Concurrent closeDay statuses:', resA.status, resB.status);
    const statuses = [resA.status, resB.status].sort();

    // Exactly one succeeds with 201, the other is rejected with 409 Conflict!
    expect(statuses[0]).toBe(201);
    expect(statuses[1]).toBe(409);

    // Ensure database contains exactly 1 settlement for this date
    const settlementCount = await prisma.settlement.count({
      where: { operationalDate },
    });
    expect(settlementCount).toBe(1);
  });
});
