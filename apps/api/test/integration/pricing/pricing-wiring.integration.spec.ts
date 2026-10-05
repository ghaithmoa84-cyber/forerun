import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { cleanDatabase, prisma } from '../setup';
import { createTestApp, closeTestApp, getRequest, getTestApp } from '../helpers/app.helper';
import {
  seedAdmin,
  seedRunner,
  seedCustomer,
  loginAs,
} from '../helpers/seed.helper';
import { PricingService } from '../../../src/modules/pricing/pricing.service';

/**
 * Sprint 6A-3.1b: Dynamic Pricing Wiring Integration Tests (S2)
 *
 * Proves that `PlatformPricing` is actually read by the production fee paths
 * after `getPricingConfig` is wired in (6A-3.1b):
 *   1. PUT /admin/pricing -> new order snapshot uses the new row (80/30/50).
 *   2. Order created BEFORE the change -> approval keeps its baseFee snapshot
 *      while peripheralFee/extraStoresFee follow the new row (D21).
 *   3. recalculateFee through the runner purchase path -> extraStoreFee x (n-1).
 *   4. customFee is still rejected on approval (MAX_CUSTOM_FEE = 0 guard).
 *   5. Missing row -> silent fallback to 60/20/40 on every path, no 5xx.
 *   6. GET /admin/pricing is consistent with the fees actually computed.
 */
describe('Sprint 6A-3.1b: Dynamic Pricing Wiring (S2)', () => {
  let request!: ReturnType<typeof getRequest>;
  let adminToken: string;
  let runnerToken: string;
  let customerToken: string;
  let adminUser: Awaited<ReturnType<typeof seedAdmin>>;
  let runnerUser: Awaited<ReturnType<typeof seedRunner>>;

  beforeAll(async () => {
    await createTestApp();
    request = getRequest();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
    // تفريغ كاش الإعدادات حتى لا تتسرّب أسعار من اختبار سابق
    getTestApp().get(PricingService).clearCache();

    adminUser = await seedAdmin(prisma);
    runnerUser = await seedRunner(prisma);
    const customerUser = await seedCustomer(prisma);

    [adminToken, runnerToken, customerToken] = await Promise.all([
      loginAs(request, adminUser.whatsapp, 'Admin@12345'),
      loginAs(request, runnerUser.whatsapp, 'Runner@12345'),
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
        notes: 'S2 pricing wiring order',
        preferredRunnerId: null,
        waitForPreferred: false,
        deliveryAddress: {
          lat: 33.5138,
          lng: 36.2765,
          description: 'Damascus S2 Address',
        },
      });
  }

  async function updatePricing(baseFee: number, extraStoreFee: number, peripheralFee: number) {
    const getRes = await request
      .get('/api/v1/admin/pricing')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);

    const putRes = await request
      .put('/api/v1/admin/pricing')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ baseFee, extraStoreFee, peripheralFee, updatedAt: getRes.body.updatedAt });

    expect(putRes.status).toBe(200);
    return putRes;
  }

  async function reviewAndApprove(orderId: string, body: Record<string, unknown>) {
    const reviewRes = await request
      .put(`/api/v1/admin/orders/${orderId}/start-review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(reviewRes.status).toBe(200);

    return request
      .put(`/api/v1/admin/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);
  }

  async function startRunnerFlow(orderId: string) {
    const assignRes = await request
      .put(`/api/v1/admin/orders/${orderId}/assign-runner`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ runnerId: runnerUser.runner!.id });
    expect(assignRes.status).toBe(200);

    const startRes = await request
      .put(`/api/v1/runner/orders/${orderId}/start`)
      .set('Authorization', `Bearer ${runnerToken}`);
    expect(startRes.status).toBe(200);

    return prisma.orderStore.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
  }

  it('1. a new order after PUT /admin/pricing (80/30/50) is priced from the new row', async () => {
    const putRes = await updatePricing(80, 30, 50);
    expect(putRes.body.baseFee).toBe(80);
    expect(putRes.body.extraStoreFee).toBe(30);
    expect(putRes.body.peripheralFee).toBe(50);

    const createRes = await createCustomerOrder(['Store A', 'Store B']);
    expect(createRes.status).toBe(201);

    // 2 stores -> extraStoresFee = (2 - 1) * 30 = 30، total = 80 + 0 + 30
    expect(createRes.body.estimatedFee).toMatchObject({
      baseFee: 80,
      peripheralFee: 0,
      extraStoresFee: 30,
      totalFee: 110,
    });

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: createRes.body.id },
    });
    expect(order.baseFee).toBe(80);
    expect(order.peripheralFee).toBe(0);
    expect(order.extraStoresFee).toBe(30);
    expect(order.totalFee).toBe(110);
  });

  it('2. approval of an order created BEFORE the change keeps baseFee snapshot but takes peripheral/extra from the new row (D21)', async () => {
    // الطلب يُنشأ على خط الأساس 60/20/40
    const createRes = await createCustomerOrder(['Store A', 'Store B']);
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.id;

    const before = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(before.baseFee).toBe(60);
    expect(before.extraStoresFee).toBe(20);
    expect(before.totalFee).toBe(80);

    // ثم تُرفع الأسعار إلى 80/30/50
    await updatePricing(80, 30, 50);

    const approveRes = await reviewAndApprove(orderId, { isPeripheral: true });
    expect(approveRes.status).toBe(200);

    // baseFee يبقى لقطة الطلب (60) — لا يُقرأ من الصف
    // peripheralFee = 50 من الصف، extraStoresFee = (2 - 1) * 30 = 30
    const after = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(after.baseFee).toBe(60);
    expect(after.peripheralFee).toBe(50);
    expect(after.extraStoresFee).toBe(30);
    expect(after.totalFee).toBe(140);

    // المعاينة العامة تعكس نفس القاعدة (baseFee من الطلب)
    const previewRes = await request
      .post(`/api/v1/admin/orders/${orderId}/fee-preview`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isPeripheral: true, customFee: 0 });
    expect(previewRes.status).toBe(200);
    expect(previewRes.body).toMatchObject({
      baseFee: 60,
      peripheralFee: 50,
      extraStoresFee: 30,
      totalFee: 140,
    });
  });

  it('3. recalculateFee through the runner purchase path uses extraStoreFee from the row', async () => {
    await updatePricing(80, 30, 50);

    const createRes = await createCustomerOrder(['S1', 'S2', 'S3']);
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.id;

    const approveRes = await reviewAndApprove(orderId, { isPeripheral: false });
    expect(approveRes.status).toBe(200);

    const stores = await startRunnerFlow(orderId);
    expect(stores).toHaveLength(3);

    for (const [index, store] of stores.entries()) {
      const purchaseRes = await request
        .put(`/api/v1/runner/orders/${orderId}/stores/${store.id}/purchase`)
        .set('Authorization', `Bearer ${runnerToken}`);
      expect(purchaseRes.status).toBe(200);

      // extraStoresFee = 30 * (purchasedCount - 1)، و baseFee يبقى لقطة 80
      const purchasedCount = index + 1;
      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(order.extraStoresFee).toBe(30 * (purchasedCount - 1));
      expect(order.baseFee).toBe(80);
      expect(order.totalFee).toBe(80 + 30 * (purchasedCount - 1));
    }

    const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(finalOrder.extraStoresFee).toBe(60);
    expect(finalOrder.totalFee).toBe(140);
  });

  it('4. customFee is still rejected on approval by the MAX_CUSTOM_FEE = 0 guard', async () => {
    await updatePricing(80, 30, 50);

    const createRes = await createCustomerOrder(['Store Guard']);
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.id;

    const approveRes = await request
      .put(`/api/v1/admin/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        isPeripheral: false,
        customFee: 50,
        customFeeReason: 'محاولة رسم إضافي بعد ربط الإعدادات',
      });

    expect(approveRes.status).toBe(400);
    expect(JSON.stringify(approveRes.body)).toContain('customFee');
  });

  it('5. with the PlatformPricing row deleted, every path falls back to 60/20/40 without a 5xx', async () => {
    // PUT أولًا لتفريغ الكاش، ثم حذف الصف
    await updatePricing(60, 20, 40);
    await prisma.platformPricing.deleteMany({ where: { id: 'default' } });
    getTestApp().get(PricingService).clearCache();

    // إنشاء طلب
    const createRes = await createCustomerOrder(['Store A', 'Store B']);
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.id;

    const created = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(created.baseFee).toBe(60);
    expect(created.extraStoresFee).toBe(20);
    expect(created.totalFee).toBe(80);

    // الاعتماد: peripheralFee يعود إلى 40
    const approveRes = await reviewAndApprove(orderId, { isPeripheral: true });
    expect(approveRes.status).toBe(200);
    const approved = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(approved.baseFee).toBe(60);
    expect(approved.peripheralFee).toBe(40);
    expect(approved.extraStoresFee).toBe(20);
    expect(approved.totalFee).toBe(120);

    // المعاينة
    const previewRes = await request
      .post(`/api/v1/admin/orders/${orderId}/fee-preview`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isPeripheral: true, customFee: 0 });
    expect(previewRes.status).toBe(200);
    expect(previewRes.body).toMatchObject({
      baseFee: 60,
      peripheralFee: 40,
      extraStoresFee: 20,
      totalFee: 120,
    });

    // إعادة الحساب عبر المندوب
    const stores = await startRunnerFlow(orderId);
    expect(stores).toHaveLength(2);
    const purchaseRes = await request
      .put(`/api/v1/runner/orders/${orderId}/stores/${stores[0].id}/purchase`)
      .set('Authorization', `Bearer ${runnerToken}`);
    expect(purchaseRes.status).toBe(200);
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: orderId } })).extraStoresFee,
    ).toBe(0);

    // GET /admin/pricing يعرض الافتراضي بلا خطأ
    const getRes = await request
      .get('/api/v1/admin/pricing')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.baseFee).toBe(60);
    expect(getRes.body.extraStoreFee).toBe(20);
    expect(getRes.body.peripheralFee).toBe(40);
  });

  it('6. GET /admin/pricing matches the fees actually computed on new orders', async () => {
    const putRes = await updatePricing(70, 25, 45);
    expect(putRes.body.baseFee).toBe(70);
    expect(putRes.body.extraStoreFee).toBe(25);
    expect(putRes.body.peripheralFee).toBe(45);

    const createRes = await createCustomerOrder(['S1', 'S2', 'S3']);
    expect(createRes.status).toBe(201);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: createRes.body.id },
    });

    // (3 - 1) * 25 = 50
    expect(order.baseFee).toBe(70);
    expect(order.extraStoresFee).toBe(50);
    expect(order.totalFee).toBe(120);

    const getRes = await request
      .get('/api/v1/admin/pricing')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.baseFee).toBe(order.baseFee);
    expect(getRes.body.extraStoreFee).toBe(25);
    expect(getRes.body.peripheralFee).toBe(45);

    // الاعتماد يقرأ peripheralFee من نفس الصف
    const approveRes = await reviewAndApprove(createRes.body.id, { isPeripheral: true });
    expect(approveRes.status).toBe(200);
    const approved = await prisma.order.findUniqueOrThrow({
      where: { id: createRes.body.id },
    });
    expect(approved.peripheralFee).toBe(getRes.body.peripheralFee);
    expect(approved.baseFee).toBe(getRes.body.baseFee);
    expect(approved.extraStoresFee).toBe(50);
    expect(approved.totalFee).toBe(70 + 45 + 50);
  });
});
