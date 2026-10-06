import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanDatabase, prisma } from '../setup';
import { createTestApp, closeTestApp, getRequest } from '../helpers/app.helper';
import {
  seedAdmin,
  seedRunner,
  seedCustomer,
  loginAs,
} from '../helpers/seed.helper';

describe('deliverOrder — Integration', () => {
  let request!: ReturnType<typeof getRequest>;
  let adminToken: string;
  let runnerToken: string;
  let customerToken: string;
  let runnerUser: Awaited<ReturnType<typeof seedRunner>>;
  let customerUser: Awaited<ReturnType<typeof seedCustomer>>;
  let orderId: string;
  let storeId: string;

  beforeAll(async () => {
    await createTestApp();
    request = getRequest();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();

    const adminUser = await seedAdmin(prisma);
    runnerUser = await seedRunner(prisma);
    customerUser = await seedCustomer(prisma);

    [adminToken, runnerToken, customerToken] = await Promise.all([
      loginAs(request, adminUser.whatsapp, 'Admin@12345'),
      loginAs(request, runnerUser.whatsapp, 'Runner@12345'),
      loginAs(request, customerUser.whatsapp, 'Customer@12345'),
    ]);
  });

  async function prepareOrderForDelivery() {
    const createRes = await request
      .post('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items: [
          {
            itemName: 'Milk',
            quantity: '1 carton',
            customStoreName: 'Test Store',
            anyStore: false,
          },
        ],
        notes: null,
        preferredRunnerId: null,
        waitForPreferred: false,
        deliveryAddress: {
          lat: 33.5138,
          lng: 36.2765,
          description: 'Damascus Test Address',
        },
      });
    expect(createRes.status).toBe(201);

    orderId = createRes.body.id;
    const orderStore = await prisma.orderStore.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    expect(orderStore).not.toBeNull();
    storeId = orderStore!.id;

    const reviewRes = await request
      .put(`/api/v1/admin/orders/${orderId}/start-review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(reviewRes.status).toBe(200);

    const approveRes = await request
      .put(`/api/v1/admin/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isPeripheral: false });
    expect(approveRes.status).toBe(200);

    const assignRes = await request
      .put(`/api/v1/admin/orders/${orderId}/assign-runner`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ runnerId: runnerUser.runner!.id });
    expect(assignRes.status).toBe(200);

    const startRes = await request
      .put(`/api/v1/runner/orders/${orderId}/start`)
      .set('Authorization', `Bearer ${runnerToken}`);
    expect(startRes.status).toBe(200);

    const purchaseRes = await request
      .put(`/api/v1/runner/orders/${orderId}/stores/${storeId}/purchase`)
      .set('Authorization', `Bearer ${runnerToken}`);
    expect(purchaseRes.status).toBe(200);

    const proceedRes = await request
      .put(`/api/v1/runner/orders/${orderId}/proceed-to-delivery`)
      .set('Authorization', `Bearer ${runnerToken}`);
    expect(proceedRes.status).toBe(200);

    return { orderId, storeId };
  }

  it('should deliver order and create 1 ledger entry (ORDER_FEE_TOTAL)', async () => {
    await prepareOrderForDelivery();
    const idempotencyKey = randomUUID();

    const deliverRes = await request
      .put(`/api/v1/runner/orders/${orderId}/deliver`)
      .set('Authorization', `Bearer ${runnerToken}`)
      .send({ idempotencyKey });
    expect(deliverRes.status).toBe(200);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    expect(order).not.toBeNull();
    expect(order!.status).toBe('DELIVERED');
    expect(order!.deliveredAt).not.toBeNull();

    const entries = await prisma.ledgerEntry.findMany({ where: { orderId } });
    expect(entries).toHaveLength(1);
    const totalEntry = entries[0];
    expect(totalEntry.type).toBe('ORDER_FEE_TOTAL');
    expect(totalEntry.amount).toBe(60);
    const total = totalEntry.amount;

    const customer = await prisma.customer.findUnique({
      where: { userId: customerUser.id },
    });
    expect(customer).not.toBeNull();
    expect(customer!.completedOrders).toBe(1);
    expect(customer!.totalFeesPaid).toBe(total);

    const runner = await prisma.runner.findUnique({
      where: { userId: runnerUser.id },
    });
    expect(runner).not.toBeNull();
    expect(runner!.status).toBe('AVAILABLE');

    const audit = await prisma.auditLog.findFirst({
      where: { orderId, event: 'ORDER_DELIVERED' },
    });
    expect(audit).not.toBeNull();
  });

  it('should handle idempotent retry with same key and return 409 on key mismatch', async () => {
    await prepareOrderForDelivery();
    const idempotencyKey = randomUUID();

    const firstDeliverRes = await request
      .put(`/api/v1/runner/orders/${orderId}/deliver`)
      .set('Authorization', `Bearer ${runnerToken}`)
      .send({ idempotencyKey });
    expect(firstDeliverRes.status).toBe(200);
    expect(firstDeliverRes.body.idempotent).toBe(false);

    // Idempotent retry: same key should return 200 with idempotent: true and no duplicate ledger entries
    const duplicateDeliverRes = await request
      .put(`/api/v1/runner/orders/${orderId}/deliver`)
      .set('Authorization', `Bearer ${runnerToken}`)
      .send({ idempotencyKey });
    expect(duplicateDeliverRes.status).toBe(200);
    expect(duplicateDeliverRes.body.idempotent).toBe(true);

    // Mismatched idempotency key on delivered order should return 409 Conflict
    const mismatchRes = await request
      .put(`/api/v1/runner/orders/${orderId}/deliver`)
      .set('Authorization', `Bearer ${runnerToken}`)
      .send({ idempotencyKey: randomUUID() });
    expect(mismatchRes.status).toBe(409);

    const entries = await prisma.ledgerEntry.findMany({ where: { orderId } });
    expect(entries).toHaveLength(1);
  });

  it('should return 404 when wrong runner tries to deliver', async () => {
    await prepareOrderForDelivery();
    const otherRunner = await seedRunner(prisma, '0999000006');
    const otherToken = await loginAs(
      request,
      otherRunner.whatsapp,
      'Runner@12345',
    );

    const res = await request
      .put(`/api/v1/runner/orders/${orderId}/deliver`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ idempotencyKey: randomUUID() });
    expect(res.status).toBe(404);
  });
});
