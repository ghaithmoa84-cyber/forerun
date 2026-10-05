import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { cleanDatabase, prisma } from '../setup';
import { createTestApp, closeTestApp, getRequest } from '../helpers/app.helper';
import {
  seedAdmin,
  seedRunner,
  seedCustomer,
  loginAs,
} from '../helpers/seed.helper';
import { AdminOrderCommandService } from '../../../src/modules/orders/services/admin-order-command.service';
import { getOperationalDate } from '../../../src/modules/settlements/settlements.service';
import { splitShares } from '../../../src/modules/pricing/split-shares';

describe('Sprint 6A-6: approveOrder Integration with customFee, baseFee, and Concurrency', () => {
  let request!: ReturnType<typeof getRequest>;
  let adminToken: string;
  let runnerToken: string;
  let customerToken: string;
  let adminUser: Awaited<ReturnType<typeof seedAdmin>>;
  let runnerUser: Awaited<ReturnType<typeof seedRunner>>;
  let customerUser: Awaited<ReturnType<typeof seedCustomer>>;
  let adminOrderCommandService: AdminOrderCommandService;

  beforeAll(async () => {
    const app = await createTestApp({ customFeeLimit: 500 });
    request = getRequest();
    adminOrderCommandService = app.get(AdminOrderCommandService);
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
        notes: 'Integration test order notes',
        preferredRunnerId: null,
        waitForPreferred: false,
        deliveryAddress: {
          lat: 33.5138,
          lng: 36.2765,
          description: 'Damascus Integration Address',
        },
      });
  }

  async function assignAndDeliverOrder(orderId: string) {
    const assignRes = await request
      .put(`/api/v1/admin/orders/${orderId}/assign-runner`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ runnerId: runnerUser.runner!.id });
    expect(assignRes.status).toBe(200);

    const startRes = await request
      .put(`/api/v1/runner/orders/${orderId}/start`)
      .set('Authorization', `Bearer ${runnerToken}`);
    expect(startRes.status).toBe(200);

    const orderStores = await prisma.orderStore.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });

    for (const store of orderStores) {
      const purchaseRes = await request
        .put(`/api/v1/runner/orders/${orderId}/stores/${store.id}/purchase`)
        .set('Authorization', `Bearer ${runnerToken}`);
      expect(purchaseRes.status).toBe(200);
    }

    const proceedRes = await request
      .put(`/api/v1/runner/orders/${orderId}/proceed-to-delivery`)
      .set('Authorization', `Bearer ${runnerToken}`);
    expect(proceedRes.status).toBe(200);

    const idempotencyKey = randomUUID();
    const deliverRes = await request
      .put(`/api/v1/runner/orders/${orderId}/deliver`)
      .set('Authorization', `Bearer ${runnerToken}`)
      .send({ idempotencyKey });
    expect(deliverRes.status).toBe(200);

    return { deliverRes, idempotencyKey };
  }

  it('9. Full lifecycle with customFee (50 and 1): preserves customFee, matches splitShares, and verifies 0 drift in settlements', async () => {
    // 1. Create Order A (single store, approved with customFee = 50)
    const createResA = await createCustomerOrder(['Store A']);
    expect(createResA.status).toBe(201);
    const orderAId = createResA.body.id;

    // Start review then approve with customFee: 50
    await request
      .put(`/api/v1/admin/orders/${orderAId}/start-review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const approveResA = await adminOrderCommandService.approveOrder(
      orderAId,
      adminUser.id,
      {
        isPeripheral: false,
        customFee: 50,
        customFeeReason: 'طلب توصيل مستعجل خاص',
      },
    );

    // Verify approved state & fees
    expect(approveResA.order.status).toBe('AWAITING_RUNNER');
    expect(approveResA.newFee.totalFee).toBe(110); // 60 + 50
    expect(approveResA.newFee.customFee).toBe(50);

    // Deliver Order A
    await assignAndDeliverOrder(orderAId);

    // 2. Create Order B (single store, approved with odd customFee = 1 -> total = 61 to test rounding per order)
    const createResB = await createCustomerOrder(['Store B']);
    expect(createResB.status).toBe(201);
    const orderBId = createResB.body.id;

    await request
      .put(`/api/v1/admin/orders/${orderBId}/start-review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    const approveResB = await adminOrderCommandService.approveOrder(
      orderBId,
      adminUser.id,
      {
        isPeripheral: false,
        customFee: 1,
        customFeeReason: 'رسم إضافي رمزي اختباري',
      },
    );

    expect(approveResB.newFee.totalFee).toBe(61); // 60 + 1
    expect(approveResB.newFee.customFee).toBe(1);

    // Deliver Order B
    await assignAndDeliverOrder(orderBId);

    // Verify Database Order records
    const dbOrderA = await prisma.order.findUniqueOrThrow({ where: { id: orderAId } });
    expect(dbOrderA.totalFee).toBe(110);
    expect(dbOrderA.customFee).toBe(50);
    expect(dbOrderA.customFeeReason).toBe('طلب توصيل مستعجل خاص');

    const dbOrderB = await prisma.order.findUniqueOrThrow({ where: { id: orderBId } });
    expect(dbOrderB.totalFee).toBe(61);
    expect(dbOrderB.customFee).toBe(1);
    expect(dbOrderB.customFeeReason).toBe('رسم إضافي رمزي اختباري');

    // Verify Ledger entries for Order A (total=110: runner=82, platform=28)
    const ledgerA = await prisma.ledgerEntry.findMany({ where: { orderId: orderAId } });
    const ledgerATotal = ledgerA.find((l) => l.type === 'ORDER_FEE_TOTAL')!;
    const ledgerARunner = ledgerA.find((l) => l.type === 'RUNNER_SHARE')!;
    const ledgerAPlatform = ledgerA.find((l) => l.type === 'PLATFORM_SHARE')!;

    const sharesA = splitShares(110);
    expect(ledgerATotal.amount).toBe(110);
    expect(ledgerARunner.amount).toBe(sharesA.runnerShare);
    expect(ledgerAPlatform.amount).toBe(sharesA.platformShare);
    expect(ledgerARunner.amount + ledgerAPlatform.amount).toBe(110);

    // Verify Ledger entries for Order B (total=61: runner=45, platform=16)
    const ledgerB = await prisma.ledgerEntry.findMany({ where: { orderId: orderBId } });
    const ledgerBTotal = ledgerB.find((l) => l.type === 'ORDER_FEE_TOTAL')!;
    const ledgerBRunner = ledgerB.find((l) => l.type === 'RUNNER_SHARE')!;
    const ledgerBPlatform = ledgerB.find((l) => l.type === 'PLATFORM_SHARE')!;

    const sharesB = splitShares(61);
    expect(ledgerBTotal.amount).toBe(61);
    expect(ledgerBRunner.amount).toBe(sharesB.runnerShare);
    expect(ledgerBPlatform.amount).toBe(sharesB.platformShare);
    expect(ledgerBRunner.amount + ledgerBPlatform.amount).toBe(61);

    // Total expected runner share from Ledger = 82 + 45 = 127
    const totalRunnerLedgerSum = ledgerARunner.amount + ledgerBRunner.amount;
    expect(totalRunnerLedgerSum).toBe(82 + 45); // 127

    // Verify Settlements: getCurrentSettlement vs ΣLedger
    const currentRes = await request
      .get('/api/v1/runner/settlements/current')
      .set('Authorization', `Bearer ${runnerToken}`);
    expect(currentRes.status).toBe(200);
    expect(currentRes.body.estimatedRunnerShare).toBe(totalRunnerLedgerSum);

    // Verify closeDay matches getCurrentSettlement and ΣLedger
    const operationalDate = getOperationalDate();
    const closeDayRes = await request
      .post('/api/v1/admin/settlements/close-day')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        operationalDate,
        notes: 'Sprint 6A-6 custom fee integration test',
      });
    expect(closeDayRes.status).toBe(201);
    const createdSettlement = closeDayRes.body.settlements[0];
    expect(createdSettlement.runnerShare).toBe(totalRunnerLedgerSum);
    expect(createdSettlement.runnerShare).toBe(currentRes.body.estimatedRunnerShare);
  });

  it('10. Concurrency: parallel approveOrder calls on the same order result in 1 success and 1 ConflictException', async () => {
    const createRes = await createCustomerOrder(['Store Concurrency']);
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.id;

    // Transition to UNDER_REVIEW
    await request
      .put(`/api/v1/admin/orders/${orderId}/start-review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    // Launch 2 parallel approvals
    const [res1, res2] = await Promise.allSettled([
      adminOrderCommandService.approveOrder(orderId, adminUser.id, { isPeripheral: false, customFee: 0 }),
      adminOrderCommandService.approveOrder(orderId, adminUser.id, { isPeripheral: false, customFee: 0 }),
    ]);

    const successes = [res1, res2].filter((r) => r.status === 'fulfilled');
    const failures = [res1, res2].filter((r) => r.status === 'rejected');

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const rejection = failures[0] as PromiseRejectedResult;
    expect(rejection.reason.name).toBe('ConflictException');
    expect(rejection.reason.message).toContain('ORDER_STATUS_CHANGED_CONCURRENTLY');

    // Exactly one ORDER_APPROVED audit log row
    const approvedLogs = await prisma.auditLog.findMany({
      where: {
        orderId,
        event: 'ORDER_APPROVED',
      },
    });
    expect(approvedLogs).toHaveLength(1);

    // Order is in exactly one correct target state
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe('AWAITING_RUNNER');
  });

  it('11. Production default guard: HTTP PUT approve with customFee = 50 returns 400 Bad Request via Zod pipe', async () => {
    const createRes = await createCustomerOrder(['Store Guard']);
    expect(createRes.status).toBe(201);
    const orderId = createRes.body.id;

    await request
      .put(`/api/v1/admin/orders/${orderId}/start-review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    // HTTP request with production pipe (MAX_CUSTOM_FEE = 0)
    const approveRes = await request
      .put(`/api/v1/admin/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        isPeripheral: false,
        customFee: 50,
        customFeeReason: 'محاولة إرسال رسم إضافي عبر HTTP في بيئة الإنتاج',
      });

    expect(approveRes.status).toBe(400);
    expect(JSON.stringify(approveRes.body)).toContain('customFee');
  });
});
