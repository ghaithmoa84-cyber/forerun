import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { cleanDatabase, prisma } from '../setup';
import { createTestApp, closeTestApp, getRequest } from '../helpers/app.helper';
import {
  seedAdmin,
  seedCustomer,
  loginAs,
} from '../helpers/seed.helper';
import { DEFAULT_PRICING_CONFIG } from '@forerun/shared-constants';

describe('Admin Pricing Endpoints Integration (Sprint 6A-7)', () => {
  let request!: ReturnType<typeof getRequest>;
  let adminToken: string;
  let adminUser: Awaited<ReturnType<typeof seedAdmin>>;
  let customerUser: Awaited<ReturnType<typeof seedCustomer>>;
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

    await prisma.platformPricing.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        baseFee: 60,
        extraStoreFee: 20,
        peripheralFee: 40,
      },
      update: {
        baseFee: 60,
        extraStoreFee: 20,
        peripheralFee: 40,
      },
    });

    adminUser = await seedAdmin(prisma);
    customerUser = await seedCustomer(prisma);

    [adminToken, customerToken] = await Promise.all([
      loginAs(request, adminUser.whatsapp, 'Admin@12345'),
      loginAs(request, customerUser.whatsapp, 'Customer@12345'),
    ]);
  });

  async function createCustomerOrder(storeNames: string[]) {
    const items = storeNames.map((storeName, i) => ({
      itemName: `Item ${i + 1}`,
      quantity: '1',
      customStoreName: storeName,
      anyStore: false,
    }));

    return request
      .post('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items,
        notes: 'Fee preview test order',
        preferredRunnerId: null,
        waitForPreferred: false,
        deliveryAddress: {
          lat: 33.5138,
          lng: 36.2765,
          description: 'Damascus Test Address',
        },
      });
  }

  describe('Cycle: GET -> PUT -> GET /admin/pricing', () => {
    it('reads defaults, updates pricing with valid values and updatedAt, and reads updated values', async () => {
      // 1. Initial GET /admin/pricing returns default row (or DEFAULT_PRICING_CONFIG)
      const initialGetRes = await request
        .get('/api/v1/admin/pricing')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(initialGetRes.status).toBe(200);
      expect(initialGetRes.body.baseFee).toBe(60);
      expect(initialGetRes.body.extraStoreFee).toBe(20);
      expect(initialGetRes.body.peripheralFee).toBe(40);

      const currentUpdatedAt = initialGetRes.body.updatedAt;

      // 2. PUT /admin/pricing with new values
      const putRes = await request
        .put('/api/v1/admin/pricing')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          baseFee: 80,
          extraStoreFee: 30,
          peripheralFee: 50,
          updatedAt: currentUpdatedAt,
        });

      expect(putRes.status).toBe(200);
      expect(putRes.body.baseFee).toBe(80);
      expect(putRes.body.extraStoreFee).toBe(30);
      expect(putRes.body.peripheralFee).toBe(50);
      expect(putRes.body.updatedByUserId).toBe(adminUser.id);
      expect(putRes.body.updatedAt).toBeDefined();

      const newUpdatedAt = putRes.body.updatedAt;

      // 3. Second GET /admin/pricing returns the newly saved values
      const secondGetRes = await request
        .get('/api/v1/admin/pricing')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(secondGetRes.status).toBe(200);
      expect(secondGetRes.body.baseFee).toBe(80);
      expect(secondGetRes.body.extraStoreFee).toBe(30);
      expect(secondGetRes.body.peripheralFee).toBe(50);
      expect(secondGetRes.body.updatedByUserId).toBe(adminUser.id);
      expect(new Date(secondGetRes.body.updatedAt).getTime()).toBe(
        new Date(newUpdatedAt).getTime(),
      );

      // Verify AuditLog was recorded
      const auditLog = await prisma.auditLog.findFirst({
        where: { event: 'PRICING_UPDATED' },
        orderBy: { createdAt: 'desc' },
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog?.actorId).toBe(adminUser.id);
      expect(auditLog?.actorRole).toBe('ADMIN');

      // Verify DEFAULT_PRICING_CONFIG constant was unchanged
      expect(DEFAULT_PRICING_CONFIG.baseFee).toBe(60);
      expect(DEFAULT_PRICING_CONFIG.extraStoreFee).toBe(20);
      expect(DEFAULT_PRICING_CONFIG.peripheralFee).toBe(40);
    });
  });

  describe('Concurrency: parallel PUT /admin/pricing', () => {
    it('one request succeeds and the other gets 409 Conflict', async () => {
      // 1. Get current updatedAt
      const getRes = await request
        .get('/api/v1/admin/pricing')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(getRes.status).toBe(200);
      const sharedUpdatedAt = getRes.body.updatedAt;

      // 2. Fire two parallel requests with the same updatedAt
      const [res1, res2] = await Promise.all([
        request
          .put('/api/v1/admin/pricing')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            baseFee: 70,
            extraStoreFee: 25,
            peripheralFee: 45,
            updatedAt: sharedUpdatedAt,
          }),
        request
          .put('/api/v1/admin/pricing')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            baseFee: 90,
            extraStoreFee: 35,
            peripheralFee: 55,
            updatedAt: sharedUpdatedAt,
          }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      const conflictRes = res1.status === 409 ? res1 : res2;
      expect(conflictRes.body.message).toContain('تعارض');
    });
  });

  describe('fee-preview: POST /api/v1/admin/orders/:id/fee-preview', () => {
    it('returns calculated fee for order in PENDING_REVIEW without writing to DB', async () => {
      // 1. Create order with 2 stores
      const createRes = await createCustomerOrder(['Store 1', 'Store 2']);
      expect(createRes.status).toBe(201);
      const orderId = createRes.body.id;

      // Initial DB snapshot
      const orderBefore = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
      });
      expect(orderBefore.status).toBe('PENDING_REVIEW');
      expect(orderBefore.totalFee).toBe(80); // base 60 + extraStore 20
      expect(orderBefore.customFee).toBe(0);

      const auditLogsCountBefore = await prisma.auditLog.count({
        where: { orderId },
      });

      // 2. Call fee-preview with isPeripheral=true and customFee=50
      const previewRes = await request
        .post(`/api/v1/admin/orders/${orderId}/fee-preview`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          isPeripheral: true,
          customFee: 50,
          customFeeReason: 'طرد ثقيل ومعقد',
        });

      expect(previewRes.status).toBe(200);
      // base=60, peripheral=40, extraStores=20 (2 stores), customFee=50 -> total=170
      // splitShares(170): runner=127, platform=43
      expect(previewRes.body).toEqual({
        baseFee: 60,
        peripheralFee: 40,
        extraStoresFee: 20,
        customFee: 50,
        customFeeReason: 'طرد ثقيل ومعقد',
        totalFee: 170,
        runnerShare: 127,
        platformShare: 43,
      });

      // 3. Verify order in DB was NOT modified at all
      const orderAfter = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
      });
      expect(orderAfter.totalFee).toBe(orderBefore.totalFee);
      expect(orderAfter.isPeripheral).toBe(orderBefore.isPeripheral);
      expect(orderAfter.customFee).toBe(orderBefore.customFee);
      expect(orderAfter.customFeeReason).toBe(orderBefore.customFeeReason);
      expect(orderAfter.status).toBe('PENDING_REVIEW');
      expect(orderAfter.updatedAt.getTime()).toBe(orderBefore.updatedAt.getTime());

      // Verify NO new AuditLog was recorded for preview
      const auditLogsCountAfter = await prisma.auditLog.count({
        where: { orderId },
      });
      expect(auditLogsCountAfter).toBe(auditLogsCountBefore);
    });

    it('returns 404 NotFound when order does not exist', async () => {
      const res = await request
        .post('/api/v1/admin/orders/non-existent-order-id/fee-preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          isPeripheral: false,
          customFee: 0,
        });

      expect(res.status).toBe(404);
    });

    it('returns 400 BadRequest when customFee > 0 without reason', async () => {
      const createRes = await createCustomerOrder(['Store A']);
      const orderId = createRes.body.id;

      const res = await request
        .post(`/api/v1/admin/orders/${orderId}/fee-preview`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          isPeripheral: false,
          customFee: 50,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('سبب');
    });
  });
});
