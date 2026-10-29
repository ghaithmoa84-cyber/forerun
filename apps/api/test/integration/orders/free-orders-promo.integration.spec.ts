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

describe('Free Orders Promo Integration Tests (Decision D59)', () => {
  let request!: ReturnType<typeof getRequest>;
  let adminToken: string;
  let runnerToken: string;
  let customerToken: string;
  let adminUser: Awaited<ReturnType<typeof seedAdmin>>;
  let runnerUser: Awaited<ReturnType<typeof seedRunner>>;
  let customerUser: Awaited<ReturnType<typeof seedCustomer>>;

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
    runnerUser = await seedRunner(prisma);
    customerUser = await seedCustomer(prisma);

    [adminToken, runnerToken, customerToken] = await Promise.all([
      loginAs(request, adminUser.whatsapp, 'Admin@12345'),
      loginAs(request, runnerUser.whatsapp, 'Runner@12345'),
      loginAs(request, customerUser.whatsapp, 'Customer@12345'),
    ]);
  });

  function makeOrderPayload(overrides: Record<string, unknown> = {}) {
    return {
      items: [
        {
          itemName: 'Milk',
          quantity: '1 carton',
          customStoreName: 'Promo Store',
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
      ...overrides,
    };
  }

  describe('1. Registration Seeding', () => {
    it('seeds freeOrdersRemaining = 0 when promo is disabled', async () => {
      const regRes = await request.post('/api/v1/auth/register').send({
        name: 'Promo Customer Off',
        whatsapp: '0999111222',
        password: 'Password@12345',
        address: {
          lat: 33.5138,
          lng: 36.2765,
          description: 'Damascus Address',
        },
      });
      expect(regRes.status).toBe(201);

      const user = await prisma.user.findUnique({
        where: { whatsapp: '0999111222' },
      });
      expect(user).not.toBeNull();
      expect(user!.freeOrdersRemaining).toBe(0);
    });

    it('seeds freeOrdersRemaining = freeOrdersCount when promo is enabled', async () => {
      const pricingRes = await request
        .put('/api/v1/admin/pricing')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          baseFee: 60,
          extraStoreFee: 20,
          peripheralFee: 40,
          freeOrdersPromoEnabled: true,
          freeOrdersCount: 5,
        });
      expect(pricingRes.status).toBe(200);

      const regRes = await request.post('/api/v1/auth/register').send({
        name: 'Promo Customer On',
        whatsapp: '0999111333',
        password: 'Password@12345',
        address: {
          lat: 33.5138,
          lng: 36.2765,
          description: 'Damascus Address',
        },
      });
      expect(regRes.status).toBe(201);

      const user = await prisma.user.findUnique({
        where: { whatsapp: '0999111333' },
      });
      expect(user).not.toBeNull();
      expect(user!.freeOrdersRemaining).toBe(5);
    });
  });

  describe('2. Order Creation & Atomic Deduction', () => {
    it('applies free promo atomically when customer has slots and promo is enabled', async () => {
      await request
        .put('/api/v1/admin/pricing')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          baseFee: 60,
          extraStoreFee: 20,
          peripheralFee: 40,
          freeOrdersPromoEnabled: true,
          freeOrdersCount: 3,
        });

      await prisma.user.update({
        where: { id: customerUser.id },
        data: { freeOrdersRemaining: 3 },
      });

      const createRes = await request
        .post('/api/v1/customer/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(makeOrderPayload());

      expect(createRes.status).toBe(201);
      expect(createRes.body.wasFreeOrderSlot).toBe(true);
      expect(createRes.body.estimatedFee.totalFee).toBe(0);
      expect(createRes.body.estimatedFee.isFreeOrder).toBe(true);

      // Verify DB deduction
      const updatedUser = await prisma.user.findUniqueOrThrow({
        where: { id: customerUser.id },
      });
      expect(updatedUser.freeOrdersRemaining).toBe(2);

      const orderInDb = await prisma.order.findUniqueOrThrow({
        where: { id: createRes.body.id },
      });
      expect(orderInDb.wasFreeOrderSlot).toBe(true);
      expect(orderInDb.totalFee).toBe(0);

      // Verify AuditLog
      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          orderId: createRes.body.id,
          event: 'ORDER_FREE_PROMO_APPLIED',
        },
      });
      expect(auditEntry).not.toBeNull();
      expect(auditEntry!.actorRole).toBe('CUSTOMER');
    });

    it('idempotency key resend does not deduct a second slot (precedes deduction)', async () => {
      await request
        .put('/api/v1/admin/pricing')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          baseFee: 60,
          extraStoreFee: 20,
          peripheralFee: 40,
          freeOrdersPromoEnabled: true,
          freeOrdersCount: 3,
        });

      await prisma.user.update({
        where: { id: customerUser.id },
        data: { freeOrdersRemaining: 2 },
      });

      const idempotencyKey = randomUUID();
      const payload = makeOrderPayload({ idempotencyKey });

      const firstRes = await request
        .post('/api/v1/customer/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(payload);
      expect(firstRes.status).toBe(201);
      expect(firstRes.body.wasFreeOrderSlot).toBe(true);
      expect(firstRes.body.idempotent).toBe(false);

      let user = await prisma.user.findUniqueOrThrow({
        where: { id: customerUser.id },
      });
      expect(user.freeOrdersRemaining).toBe(1);

      // Resend with same idempotencyKey
      const retryRes = await request
        .post('/api/v1/customer/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(payload);
      expect(retryRes.status).toBe(201);
      expect(retryRes.body.idempotent).toBe(true);
      expect(retryRes.body.id).toBe(firstRes.body.id);
      expect(retryRes.body.wasFreeOrderSlot).toBe(true);

      // Slots must remain 1 (not decremented to 0)
      user = await prisma.user.findUniqueOrThrow({
        where: { id: customerUser.id },
      });
      expect(user.freeOrdersRemaining).toBe(1);
    });
  });

  describe('3. Three Cancellation Paths (Slot Restoration)', () => {
    beforeEach(async () => {
      await request
        .put('/api/v1/admin/pricing')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          baseFee: 60,
          extraStoreFee: 20,
          peripheralFee: 40,
          freeOrdersPromoEnabled: true,
          freeOrdersCount: 3,
        });

      await prisma.user.update({
        where: { id: customerUser.id },
        data: { freeOrdersRemaining: 2 },
      });
    });

    async function createFreeOrder(): Promise<string> {
      const res = await request
        .post('/api/v1/customer/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(makeOrderPayload());
      expect(res.status).toBe(201);
      return res.body.id;
    }

    it('Path A: Customer cancels order -> slot is restored and logged', async () => {
      const orderId = await createFreeOrder();

      let user = await prisma.user.findUniqueOrThrow({
        where: { id: customerUser.id },
      });
      expect(user.freeOrdersRemaining).toBe(1);

      const cancelRes = await request
        .delete(`/api/v1/customer/orders/${orderId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({});
      expect(cancelRes.status).toBe(200);

      user = await prisma.user.findUniqueOrThrow({
        where: { id: customerUser.id },
      });
      expect(user.freeOrdersRemaining).toBe(2);

      const restoreAudit = await prisma.auditLog.findFirst({
        where: {
          orderId,
          event: 'ORDER_FREE_PROMO_RESTORED',
        },
      });
      expect(restoreAudit).not.toBeNull();
      expect(restoreAudit!.actorRole).toBe('CUSTOMER');
      expect((restoreAudit!.meta as { reason?: string })?.reason).toBe(
        'CUSTOMER_CANCELLED',
      );
    });

    it('Path B: Admin rejects order -> slot is restored and logged', async () => {
      const orderId = await createFreeOrder();

      const rejectRes = await request
        .put(`/api/v1/admin/orders/${orderId}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelReason: 'Store closed today' });
      expect(rejectRes.status).toBe(200);

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: customerUser.id },
      });
      expect(user.freeOrdersRemaining).toBe(2);

      const restoreAudit = await prisma.auditLog.findFirst({
        where: {
          orderId,
          event: 'ORDER_FREE_PROMO_RESTORED',
        },
      });
      expect(restoreAudit).not.toBeNull();
      expect(restoreAudit!.actorRole).toBe('ADMIN');
      expect((restoreAudit!.meta as { reason?: string })?.reason).toBe(
        'ADMIN_REJECTED',
      );
    });

    it('Path C: Admin force cancels order (D39) -> slot is restored and logged', async () => {
      const orderId = await createFreeOrder();

      // Advance order to ASSIGNED
      await request
        .put(`/api/v1/admin/orders/${orderId}/start-review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      await request
        .put(`/api/v1/admin/orders/${orderId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPeripheral: false });
      await request
        .put(`/api/v1/admin/orders/${orderId}/assign-runner`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ runnerId: runnerUser.runner!.id });

      const forceCancelRes = await request
        .put(`/api/v1/admin/orders/${orderId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelReason: 'Emergency force cancel by admin' });
      expect(forceCancelRes.status).toBe(200);

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: customerUser.id },
      });
      expect(user.freeOrdersRemaining).toBe(2);

      const restoreAudit = await prisma.auditLog.findFirst({
        where: {
          orderId,
          event: 'ORDER_FREE_PROMO_RESTORED',
        },
      });
      expect(restoreAudit).not.toBeNull();
      expect(restoreAudit!.actorRole).toBe('ADMIN');
      expect((restoreAudit!.meta as { reason?: string })?.reason).toBe(
        'ADMIN_FORCE_CANCELLED',
      );
    });
  });

  describe('4. Delivery & Financial Invariant (D53 compliance)', () => {
    it('delivering a free order (totalFee = 0) creates 0 LedgerEntry records', async () => {
      await request
        .put('/api/v1/admin/pricing')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          baseFee: 60,
          extraStoreFee: 20,
          peripheralFee: 40,
          freeOrdersPromoEnabled: true,
          freeOrdersCount: 3,
        });

      await prisma.user.update({
        where: { id: customerUser.id },
        data: { freeOrdersRemaining: 1 },
      });

      // 1. Create free order
      const createRes = await request
        .post('/api/v1/customer/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send(makeOrderPayload());
      expect(createRes.status).toBe(201);
      const orderId = createRes.body.id;
      expect(createRes.body.estimatedFee.totalFee).toBe(0);

      const store = await prisma.orderStore.findFirstOrThrow({
        where: { orderId },
      });

      // 2. Review, Approve, Assign
      await request
        .put(`/api/v1/admin/orders/${orderId}/start-review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      await request
        .put(`/api/v1/admin/orders/${orderId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPeripheral: false });
      await request
        .put(`/api/v1/admin/orders/${orderId}/assign-runner`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ runnerId: runnerUser.runner!.id });

      // 3. Runner lifecycle
      await request
        .put(`/api/v1/runner/orders/${orderId}/start`)
        .set('Authorization', `Bearer ${runnerToken}`);
      await request
        .put(`/api/v1/runner/orders/${orderId}/stores/${store.id}/purchase`)
        .set('Authorization', `Bearer ${runnerToken}`);
      await request
        .put(`/api/v1/runner/orders/${orderId}/proceed-to-delivery`)
        .set('Authorization', `Bearer ${runnerToken}`);

      // 4. Deliver
      const idempotencyKey = randomUUID();
      const deliverRes = await request
        .put(`/api/v1/runner/orders/${orderId}/deliver`)
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({ idempotencyKey });
      expect(deliverRes.status).toBe(200);

      const deliveredOrder = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
      });
      expect(deliveredOrder.status).toBe('DELIVERED');
      expect(deliveredOrder.totalFee).toBe(0);

      // 5. Verify 0 LedgerEntry records created for this order (D53 compliance)
      const ledgerCount = await prisma.ledgerEntry.count({
        where: { orderId },
      });
      expect(ledgerCount).toBe(0);
    });
  });
});
