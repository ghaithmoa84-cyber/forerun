import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient, OrderStatus, OrderStoreStatus, UserRole, UserStatus } from '@prisma/client';
import supertest from 'supertest';
import * as bcrypt from 'bcrypt';
import { createTestApp, closeTestApp } from '../helpers/app.helper';
import { seedAdmin, seedRunner, seedCustomer, loginAs } from '../helpers/seed.helper';
import { cleanDatabase } from '../setup';

describe('Audit: Empirical IDOR Verification Across All Resource-Scoped Endpoints', () => {
  let app: INestApplication;
  let request: ReturnType<typeof supertest>;
  let prisma: PrismaClient;

  let customer1Token: string;
  let customer2Token: string;
  let runner1Token: string;
  let runner2Token: string;

  let customer1Id: string;
  let customer2Id: string;
  let runner1Id: string;
  let runner2Id: string;

  beforeAll(async () => {
    app = await createTestApp();
    request = supertest(app.getHttpServer());
    prisma = new PrismaClient({
      datasources: { db: { url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL } },
    });
    await prisma.$connect();
    await cleanDatabase();

    const hash = await bcrypt.hash('Password@12345', 12);

    // Seed Customer 1
    const uCust1 = await seedCustomer(prisma);
    customer1Id = uCust1.customer!.id;
    customer1Token = await loginAs(request, uCust1.whatsapp, 'Customer@12345');

    // Seed Customer 2
    const uCust2 = await prisma.user.create({
      data: {
        name: 'Customer Two',
        whatsapp: '0999000012',
        passwordHash: hash,
        role: UserRole.CUSTOMER,
        status: UserStatus.VERIFIED,
        customer: {
          create: {
            address: {
              create: { lat: 33.5, lng: 36.2, description: 'Addr 2' },
            },
          },
        },
      },
      include: { customer: true },
    });
    customer2Id = uCust2.customer!.id;
    customer2Token = await loginAs(request, '0999000012', 'Password@12345');

    // Seed Runner 1
    const uRun1 = await seedRunner(prisma, '0999000021');
    runner1Id = uRun1.runner!.id;
    runner1Token = await loginAs(request, '0999000021', 'Runner@12345');

    // Seed Runner 2 (On mission with another order to test IDOR when runner is actively on mission)
    const uRun2 = await seedRunner(prisma, '0999000022');
    runner2Id = uRun2.runner!.id;
    await prisma.runner.update({
      where: { id: runner2Id },
      data: { status: 'ON_MISSION' },
    });
    runner2Token = await loginAs(request, '0999000022', 'Runner@12345');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await closeTestApp();
  });

  describe('Customer Endpoints IDOR Checks', () => {
    it('1. GET /api/v1/customer/orders/:id — Customer 2 cannot access Customer 1 order', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: customer1Id,
          orderNumber: 'FW-IDOR-CUST-1',
          status: OrderStatus.DRAFT,
          deliveryLat: 33.5,
          deliveryLng: 36.2,
          deliveryDesc: 'Customer 1 Address',
          baseFee: 60,
          totalFee: 60,
        },
      });

      // Customer 2 requests Customer 1's order
      const res = await request
        .get(`/api/v1/customer/orders/${order.id}`)
        .set('Authorization', `Bearer ${customer2Token}`);

      console.log('[IDOR CHECK 1] GET /customer/orders/:id -> status:', res.status);
      expect(res.status).toBe(404);
    });

    it('2. DELETE /api/v1/customer/orders/:id — Customer 2 cannot cancel Customer 1 order', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: customer1Id,
          orderNumber: 'FW-IDOR-CUST-2',
          status: OrderStatus.DRAFT,
          deliveryLat: 33.5,
          deliveryLng: 36.2,
          deliveryDesc: 'Customer 1 Address',
          baseFee: 60,
          totalFee: 60,
        },
      });

      // Customer 2 tries to cancel Customer 1's order
      const res = await request
        .delete(`/api/v1/customer/orders/${order.id}`)
        .set('Authorization', `Bearer ${customer2Token}`);

      console.log('[IDOR CHECK 2] DELETE /customer/orders/:id -> status:', res.status);
      expect(res.status).toBe(404);

      // Verify order is still intact
      const freshOrder = await prisma.order.findUnique({ where: { id: order.id } });
      expect(freshOrder?.status).toBe(OrderStatus.DRAFT);
    });

    it('3. POST /api/v1/customer/orders/:id/ratings — Customer 2 cannot rate Customer 1 order', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: customer1Id,
          runnerId: runner1Id,
          orderNumber: 'FW-IDOR-CUST-3',
          status: OrderStatus.DELIVERED,
          deliveryLat: 33.5,
          deliveryLng: 36.2,
          deliveryDesc: 'Customer 1 Address',
          baseFee: 60,
          totalFee: 60,
          deliveredAt: new Date(),
        },
      });

      const res = await request
        .post(`/api/v1/customer/orders/${order.id}/ratings`)
        .set('Authorization', `Bearer ${customer2Token}`)
        .send({ stars: 5, note: 'Hacked rating' });

      console.log('[IDOR CHECK 3] POST /customer/orders/:id/ratings -> status:', res.status);
      expect(res.status).toBe(404);
    });

    it('4. PUT /api/v1/customer/orders/:id/ratings — Customer 2 cannot update rating on Customer 1 order', async () => {
      const order = await prisma.order.create({
        data: {
          customerId: customer1Id,
          runnerId: runner1Id,
          orderNumber: 'FW-IDOR-CUST-4',
          status: OrderStatus.DELIVERED,
          deliveryLat: 33.5,
          deliveryLng: 36.2,
          deliveryDesc: 'Customer 1 Address',
          baseFee: 60,
          totalFee: 60,
          deliveredAt: new Date(),
        },
      });

      await prisma.rating.create({
        data: {
          orderId: order.id,
          customerId: customer1Id,
          runnerId: runner1Id,
          stars: 4,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const res = await request
        .put(`/api/v1/customer/orders/${order.id}/ratings`)
        .set('Authorization', `Bearer ${customer2Token}`)
        .send({ stars: 1, note: 'Malicious update' });

      console.log('[IDOR CHECK 4] PUT /customer/orders/:id/ratings -> status:', res.status);
      expect(res.status).toBe(404);
    });
  });

  describe('Runner Endpoints IDOR Checks', () => {
    let orderAssignedToRunner1: any;
    let storeOfRunner1Order: any;

    beforeAll(async () => {
      orderAssignedToRunner1 = await prisma.order.create({
        data: {
          customerId: customer1Id,
          runnerId: runner1Id,
          orderNumber: 'FW-IDOR-RUNNER-1',
          status: OrderStatus.ASSIGNED,
          deliveryLat: 33.5,
          deliveryLng: 36.2,
          deliveryDesc: 'Test Address',
          baseFee: 60,
          totalFee: 60,
          assignedAt: new Date(),
        },
      });

      storeOfRunner1Order = await prisma.orderStore.create({
        data: {
          orderId: orderAssignedToRunner1.id,
          storeName: 'Bakery Al-Sham',
          status: OrderStoreStatus.PENDING,
        },
      });
    });

    it('5. GET /api/v1/runner/orders/:id/stores — Runner 2 cannot view stores for Runner 1 order', async () => {
      const res = await request
        .get(`/api/v1/runner/orders/${orderAssignedToRunner1.id}/stores`)
        .set('Authorization', `Bearer ${runner2Token}`);

      console.log('[IDOR CHECK 5] GET /runner/orders/:id/stores -> status:', res.status);
      expect(res.status).toBe(404);
    });

    it('6. POST /api/v1/runner/orders/:id/stores — Runner 2 cannot add store to Runner 1 order', async () => {
      const res = await request
        .post(`/api/v1/runner/orders/${orderAssignedToRunner1.id}/stores`)
        .set('Authorization', `Bearer ${runner2Token}`)
        .send({ storeName: 'Hacked Store' });

      console.log('[IDOR CHECK 6] POST /runner/orders/:id/stores -> status:', res.status);
      expect(res.status).toBe(404);
    });

    it('7. DELETE /api/v1/runner/orders/:id/stores/:storeId — Runner 2 cannot delete store from Runner 1 order', async () => {
      const res = await request
        .delete(`/api/v1/runner/orders/${orderAssignedToRunner1.id}/stores/${storeOfRunner1Order.id}`)
        .set('Authorization', `Bearer ${runner2Token}`);

      console.log('[IDOR CHECK 7] DELETE /runner/orders/:id/stores/:storeId -> status:', res.status);
      expect(res.status).toBe(404);
    });

    it('8. POST /api/v1/runner/orders/:id/items — Runner 2 cannot add item to Runner 1 order', async () => {
      const res = await request
        .post(`/api/v1/runner/orders/${orderAssignedToRunner1.id}/items`)
        .set('Authorization', `Bearer ${runner2Token}`)
        .send({ itemName: 'Illegal Item', quantity: '10', orderStoreId: storeOfRunner1Order.id });

      console.log('[IDOR CHECK 8] POST /runner/orders/:id/items -> status:', res.status);
      expect(res.status).toBe(404);
    });

    it('9. PUT /api/v1/runner/orders/:id/start — Runner 2 cannot start shopping for Runner 1 order', async () => {
      const res = await request
        .put(`/api/v1/runner/orders/${orderAssignedToRunner1.id}/start`)
        .set('Authorization', `Bearer ${runner2Token}`);

      console.log('[IDOR CHECK 9] PUT /runner/orders/:id/start -> status:', res.status);
      expect(res.status).toBe(404);
    });

    it('10. PUT /api/v1/runner/orders/:id/stores/:storeId/purchase — Runner 2 cannot mark purchase on Runner 1 order', async () => {
      const res = await request
        .put(`/api/v1/runner/orders/${orderAssignedToRunner1.id}/stores/${storeOfRunner1Order.id}/purchase`)
        .set('Authorization', `Bearer ${runner2Token}`);

      console.log('[IDOR CHECK 10] PUT .../purchase -> status:', res.status);
      expect(res.status).toBe(404);
    });

    it('11. PUT /api/v1/runner/orders/:id/stores/:storeId/skip — Runner 2 cannot skip store on Runner 1 order', async () => {
      const res = await request
        .put(`/api/v1/runner/orders/${orderAssignedToRunner1.id}/stores/${storeOfRunner1Order.id}/skip`)
        .set('Authorization', `Bearer ${runner2Token}`)
        .send({ reason: 'Malicious skip' });

      console.log('[IDOR CHECK 11] PUT .../skip -> status:', res.status);
      expect(res.status).toBe(404);
    });

    it('12. PUT /api/v1/runner/orders/:id/proceed-to-delivery — Runner 2 cannot proceed to delivery on Runner 1 order', async () => {
      const res = await request
        .put(`/api/v1/runner/orders/${orderAssignedToRunner1.id}/proceed-to-delivery`)
        .set('Authorization', `Bearer ${runner2Token}`);

      console.log('[IDOR CHECK 12] PUT .../proceed-to-delivery -> status:', res.status);
      expect(res.status).toBe(404);
    });

    it('13. PUT /api/v1/runner/orders/:id/deliver — Runner 2 cannot deliver Runner 1 order', async () => {
      const res = await request
        .put(`/api/v1/runner/orders/${orderAssignedToRunner1.id}/deliver`)
        .set('Authorization', `Bearer ${runner2Token}`)
        .send({ idempotencyKey: '00000000-0000-0000-0000-000000000001' });

      console.log('[IDOR CHECK 13] PUT .../deliver -> status:', res.status);
      expect(res.status).toBe(404);
    });

    it('14. POST /api/v1/runner/orders/:id/stores/:storeId/receipts/presigned-url — Runner 2 cannot get presigned receipt URL for Runner 1 order', async () => {
      const res = await request
        .post(`/api/v1/runner/orders/${orderAssignedToRunner1.id}/stores/${storeOfRunner1Order.id}/receipts/presigned-url`)
        .set('Authorization', `Bearer ${runner2Token}`)
        .send({ fileType: 'jpg', fileSize: 1024 });

      console.log('[IDOR CHECK 14] POST .../presigned-url -> status:', res.status);
      expect(res.status).toBe(404);
    });

    it('15. POST /api/v1/runner/orders/:id/stores/:storeId/receipts — Runner 2 cannot attach receipt to Runner 1 order', async () => {
      const res = await request
        .post(`/api/v1/runner/orders/${orderAssignedToRunner1.id}/stores/${storeOfRunner1Order.id}/receipts`)
        .set('Authorization', `Bearer ${runner2Token}`)
        .send({ imageUrl: 'https://r2.forerun.com/test.jpg', r2Key: 'receipts/test.jpg' });

      console.log('[IDOR CHECK 15] POST .../receipts -> status:', res.status);
      expect(res.status).toBe(404);
    });

    it('16. DELETE /api/v1/runner/orders/:id/stores/:storeId/receipts/:receiptId — Runner 2 cannot delete receipt from Runner 1 order', async () => {
      const receipt = await prisma.receipt.create({
        data: {
          orderStoreId: storeOfRunner1Order.id,
          imageUrl: 'https://r2.forerun.com/test.jpg',
          r2Key: 'receipts/test.jpg',
        },
      });

      const res = await request
        .delete(`/api/v1/runner/orders/${orderAssignedToRunner1.id}/stores/${storeOfRunner1Order.id}/receipts/${receipt.id}`)
        .set('Authorization', `Bearer ${runner2Token}`);

      console.log('[IDOR CHECK 16] DELETE .../receipts/:receiptId -> status:', res.status);
      expect(res.status).toBe(404);
    });
  });
});
