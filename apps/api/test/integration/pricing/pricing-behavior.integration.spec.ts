import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PRICING } from '@forerun/shared-constants';
import { cleanDatabase, prisma } from '../setup';
import { createTestApp, closeTestApp, getRequest } from '../helpers/app.helper';
import {
  seedAdmin,
  seedRunner,
  seedCustomer,
  loginAs,
} from '../helpers/seed.helper';
import { getOperationalDate } from '../../../src/modules/settlements/settlements.service';

/**
 * Sprint 6A - Baseline Pricing Behavior Integration Tests (S1)
 *
 * Freezes existing pricing behavior across:
 * 1. Order creation fee snapshot (single and multi-store).
 * 2. Peripheral zone fee on admin approval.
 * 3. Delivery ledger entries (100% total, 75% runner, 25% platform) and idempotency.
 * 4. Settlement consistency between Ledger, Settlement, and SettlementItem.
 * 5. V3 Verification: Settlement.runnerShare == sum(LedgerEntry[RUNNER_SHARE]).
 * 6. Financial invariant: runnerShare + platformShare === total across odd/even fees.
 * 7. recalculateFee behavior and documentation of live-recalculation bug (B2).
 */
describe('Sprint 6A: Pricing Behavior Baseline (S1)', () => {
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

  // Helper to create customer order with given store names
  async function createCustomerOrder(storeNames: string[]) {
    const items = storeNames.map((storeName, i) => ({
      itemName: `Item ${i + 1}`,
      quantity: '1',
      customStoreName: storeName,
      anyStore: false,
    }));

    const res = await request
      .post('/api/v1/customer/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        items,
        notes: 'Test order notes',
        preferredRunnerId: null,
        waitForPreferred: false,
        deliveryAddress: {
          lat: 33.5138,
          lng: 36.2765,
          description: 'Damascus Test Address',
        },
      });

    return res;
  }

  // Helper to transition order through review and approval
  async function reviewAndApproveOrder(orderId: string, isPeripheral = false) {
    const reviewRes = await request
      .put(`/api/v1/admin/orders/${orderId}/start-review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(reviewRes.status).toBe(200);

    const approveRes = await request
      .put(`/api/v1/admin/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isPeripheral });
    expect(approveRes.status).toBe(200);

    return approveRes;
  }

  // Helper to advance order through runner assignment, purchases, and delivery
  async function assignAndDeliverOrder(orderId: string, customIdempotencyKey?: string) {
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

    const idempotencyKey = customIdempotencyKey ?? randomUUID();
    const deliverRes = await request
      .put(`/api/v1/runner/orders/${orderId}/deliver`)
      .set('Authorization', `Bearer ${runnerToken}`)
      .send({ idempotencyKey });

    return { deliverRes, idempotencyKey };
  }

  // =========================================================================
  // 1. Order Creation Snapshot Tests
  // =========================================================================
  describe('1. Order Creation Snapshot', () => {
    it('1.1 should create order with correct fee snapshot for single store (base=60, peripheral=0, extraStores=0, total=60)', async () => {
      const res = await createCustomerOrder(['Store Alpha']);
      expect(res.status).toBe(201);

      const orderId = res.body.id;
      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

      // In DB: snapshot fields written explicitly
      expect(order.baseFee).toBe(60);
      expect(order.peripheralFee).toBe(0);
      expect(order.extraStoresFee).toBe(0);
      expect(order.totalFee).toBe(60);
      expect(order.isPeripheral).toBe(false);

      // In response: estimatedFee matches DB snapshot
      expect(res.body.estimatedFee).toMatchObject({
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 0,
        totalFee: 60,
      });
    });

    it('1.2 should create order with correct fee snapshot for multiple stores (3 stores: extraStores=40, total=100)', async () => {
      const res = await createCustomerOrder(['Store A', 'Store B', 'Store C']);
      expect(res.status).toBe(201);

      const orderId = res.body.id;
      const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

      // 3 stores = 1 base store + 2 extra stores * 20 = 40
      expect(order.baseFee).toBe(60);
      expect(order.peripheralFee).toBe(0);
      expect(order.extraStoresFee).toBe(40);
      expect(order.totalFee).toBe(100);

      expect(res.body.estimatedFee).toMatchObject({
        baseFee: 60,
        peripheralFee: 0,
        extraStoresFee: 40,
        totalFee: 100,
      });
    });
  });

  // =========================================================================
  // 2. Peripheral Zone Approval Test
  // =========================================================================
  describe('2. Peripheral Zone Approval', () => {
    it('should update peripheralFee to 40 and totalFee to 100 on admin approval with isPeripheral: true', async () => {
      const createRes = await createCustomerOrder(['Single Store']);
      expect(createRes.status).toBe(201);
      const orderId = createRes.body.id;

      // Approve order with isPeripheral: true
      const approveRes = await reviewAndApproveOrder(orderId, true);
      expect(approveRes.status).toBe(200);

      const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(updatedOrder.isPeripheral).toBe(true);
      expect(updatedOrder.baseFee).toBe(60);
      expect(updatedOrder.peripheralFee).toBe(40);
      expect(updatedOrder.extraStoresFee).toBe(0);
      expect(updatedOrder.totalFee).toBe(100);

      // Verify audit log for fee update
      const feeAudit = await prisma.auditLog.findFirst({
        where: {
          orderId,
          event: 'ORDER_FEE_UPDATED',
        },
      });
      expect(feeAudit).not.toBeNull();
      expect(feeAudit!.meta).toBeDefined();
    });
  });

  // =========================================================================
  // 3. Delivery Ledger Entries & Idempotency
  // =========================================================================
  describe('3. Delivery Ledger Entries & Idempotency', () => {
    it('should write 3 ledger entries (100%/75%/25%) on delivery and enforce idempotency', async () => {
      // Create order with 2 stores + peripheral = totalFee 120 (60 + 40 + 20)
      const createRes = await createCustomerOrder(['Store 1', 'Store 2']);
      expect(createRes.status).toBe(201);
      const orderId = createRes.body.id;

      await reviewAndApproveOrder(orderId, true);

      const idempotencyKey = randomUUID();
      const { deliverRes } = await assignAndDeliverOrder(orderId, idempotencyKey);
      expect(deliverRes.status).toBe(200);
      expect(deliverRes.body.idempotent).toBe(false);

      const deliveredOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(deliveredOrder.status).toBe('DELIVERED');
      expect(deliveredOrder.deliveredAt).not.toBeNull();
      expect(deliveredOrder.totalFee).toBe(120);

      // Verify exactly 3 ledger entries
      const entries = await prisma.ledgerEntry.findMany({ where: { orderId } });
      expect(entries).toHaveLength(3);

      const totalEntry = entries.find((e) => e.type === 'ORDER_FEE_TOTAL')!;
      const runnerEntry = entries.find((e) => e.type === 'RUNNER_SHARE')!;
      const platformEntry = entries.find((e) => e.type === 'PLATFORM_SHARE')!;

      expect(totalEntry).toBeDefined();
      expect(runnerEntry).toBeDefined();
      expect(platformEntry).toBeDefined();

      expect(totalEntry.amount).toBe(120);
      expect(runnerEntry.amount).toBe(90); // 120 * 0.75
      expect(platformEntry.amount).toBe(30); // 120 * 0.25
      expect(runnerEntry.amount + platformEntry.amount).toBe(totalEntry.amount);

      // Idempotent retry with same key: returns 200, idempotent: true, no duplicate entries
      const retryRes = await request
        .put(`/api/v1/runner/orders/${orderId}/deliver`)
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({ idempotencyKey });

      expect(retryRes.status).toBe(200);
      expect(retryRes.body.idempotent).toBe(true);

      const entriesAfterRetry = await prisma.ledgerEntry.findMany({ where: { orderId } });
      expect(entriesAfterRetry).toHaveLength(3);

      // Conflict retry with different key: returns 409 Conflict
      const mismatchRes = await request
        .put(`/api/v1/runner/orders/${orderId}/deliver`)
        .set('Authorization', `Bearer ${runnerToken}`)
        .send({ idempotencyKey: randomUUID() });

      expect(mismatchRes.status).toBe(409);

      const entriesAfterMismatch = await prisma.ledgerEntry.findMany({ where: { orderId } });
      expect(entriesAfterMismatch).toHaveLength(3);
    });
  });

  // =========================================================================
  // 4 & 5. Settlement & V3 Invariant Verification
  // =========================================================================
  describe('4 & 5. Settlement & V3 Verification', () => {
    it('should verify Settlement.runnerShare equals sum of Ledger RUNNER_SHARE entries for getCurrentSettlement and closeDay', async () => {
      // Order 1: 1 store, non-peripheral -> totalFee = 60
      // Ledger: total = 60, runnerShare = 45, platformShare = 15
      const createRes1 = await createCustomerOrder(['Store Normal']);
      expect(createRes1.status).toBe(201);
      const order1Id = createRes1.body.id;
      await reviewAndApproveOrder(order1Id, false);
      await assignAndDeliverOrder(order1Id);

      // Order 2: 2 stores, peripheral -> totalFee = 120
      // Ledger: total = 120, runnerShare = 90, platformShare = 30
      const createRes2 = await createCustomerOrder(['Store Peripheral 1', 'Store Peripheral 2']);
      expect(createRes2.status).toBe(201);
      const order2Id = createRes2.body.id;
      await reviewAndApproveOrder(order2Id, true);
      await assignAndDeliverOrder(order2Id);

      // Fetch all ledger entries for this runner's delivered orders
      const ledgerEntries = await prisma.ledgerEntry.findMany({
        where: { orderId: { in: [order1Id, order2Id] } },
      });

      const totalRunnerShareLedger = ledgerEntries
        .filter((e) => e.type === 'RUNNER_SHARE')
        .reduce((sum, e) => sum + e.amount, 0);

      const totalPlatformShareLedger = ledgerEntries
        .filter((e) => e.type === 'PLATFORM_SHARE')
        .reduce((sum, e) => sum + e.amount, 0);

      const totalFeeLedger = ledgerEntries
        .filter((e) => e.type === 'ORDER_FEE_TOTAL')
        .reduce((sum, e) => sum + e.amount, 0);

      expect(totalFeeLedger).toBe(180);
      expect(totalRunnerShareLedger).toBe(135); // 45 + 90
      expect(totalPlatformShareLedger).toBe(45); // 15 + 30
      expect(totalRunnerShareLedger + totalPlatformShareLedger).toBe(totalFeeLedger);

      // 5A: Verify getCurrentSettlement (live preview for runner)
      const currentSettlementRes = await request
        .get('/api/v1/runner/settlements/current')
        .set('Authorization', `Bearer ${runnerToken}`);

      expect(currentSettlementRes.status).toBe(200);
      const current = currentSettlementRes.body;

      expect(current.totalOrders).toBe(2);
      expect(current.totalFees).toBe(180);
      expect(current.estimatedRunnerShare).toBe(totalRunnerShareLedger); // V3 match!
      expect(current.estimatedPlatformShare).toBe(totalPlatformShareLedger);
      expect(current.estimatedRunnerShare + current.estimatedPlatformShare).toBe(current.totalFees);

      // 5B: Verify closeDay (admin daily settlement creation)
      const operationalDate = getOperationalDate();
      const closeDayRes = await request
        .post('/api/v1/admin/settlements/close-day')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          operationalDate,
          notes: 'Sprint 6A S1 settlement test',
        });

      expect(closeDayRes.status).toBe(201);
      expect(closeDayRes.body.settlements).toHaveLength(1);

      const createdSettlement = closeDayRes.body.settlements[0];
      expect(createdSettlement.totalOrders).toBe(2);
      expect(createdSettlement.totalFees).toBe(180);
      expect(createdSettlement.runnerShare).toBe(totalRunnerShareLedger); // V3 match!
      expect(createdSettlement.platformShare).toBe(totalPlatformShareLedger);
      expect(createdSettlement.runnerShare + createdSettlement.platformShare).toBe(createdSettlement.totalFees);

      // Verify SettlementItem breakdown in DB
      const settlementItems = await prisma.settlementItem.findMany({
        where: { settlementId: createdSettlement.id },
      });
      expect(settlementItems).toHaveLength(2);

      const sumItemsRunnerShare = settlementItems.reduce((sum, item) => sum + item.runnerShare, 0);
      const sumItemsPlatformShare = settlementItems.reduce((sum, item) => sum + item.platformShare, 0);
      const sumItemsOrderFee = settlementItems.reduce((sum, item) => sum + item.orderFee, 0);

      expect(sumItemsRunnerShare).toBe(createdSettlement.runnerShare);
      expect(sumItemsPlatformShare).toBe(createdSettlement.platformShare);
      expect(sumItemsOrderFee).toBe(createdSettlement.totalFees);

      // V3 Core Assertion:
      // Settlement.runnerShare === SUM(SettlementItem.runnerShare) === SUM(LedgerEntry[RUNNER_SHARE])
      expect(createdSettlement.runnerShare).toBe(sumItemsRunnerShare);
      expect(createdSettlement.runnerShare).toBe(totalRunnerShareLedger);
    });
  });

  // =========================================================================
  // 6. Mathematical Invariant: runnerShare + platformShare === total
  // =========================================================================
  describe('6. Mathematical Invariant: runnerShare + platformShare === total', () => {
    it('should satisfy the invariant runnerShare + platformShare === total for odd and even totals', () => {
      const testTotals = [60, 61, 80, 101, 125, 1, 2, 3, 999];

      expect(PRICING.RUNNER_SHARE).toBe(0.75);
      expect(PRICING.PLATFORM_SHARE).toBe(0.25);
      expect(PRICING.RUNNER_SHARE + PRICING.PLATFORM_SHARE).toBe(1);

      for (const total of testTotals) {
        const runnerShare = Math.floor(total * PRICING.RUNNER_SHARE);
        const platformShare = Math.ceil(total * PRICING.PLATFORM_SHARE);

        expect(
          runnerShare + platformShare,
          `Failed invariant for total=${total}: runnerShare=${runnerShare}, platformShare=${platformShare}`,
        ).toBe(total);
      }
    });
  });

  // =========================================================================
  // 7. recalculateFee Behavior & Snapshot Preservation
  // =========================================================================
  describe('7. recalculateFee Behavior & Snapshot Preservation', () => {
    it('7.1 should recalculate extraStoresFee dynamically as runner purchases stores', async () => {
      // Order with 2 stores: initially extraStoresFee=20, totalFee=80
      const createRes = await createCustomerOrder(['Store One', 'Store Two']);
      expect(createRes.status).toBe(201);
      const orderId = createRes.body.id;

      await reviewAndApproveOrder(orderId, false);

      const assignRes = await request
        .put(`/api/v1/admin/orders/${orderId}/assign-runner`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ runnerId: runnerUser.runner!.id });
      expect(assignRes.status).toBe(200);

      await request
        .put(`/api/v1/runner/orders/${orderId}/start`)
        .set('Authorization', `Bearer ${runnerToken}`);

      const stores = await prisma.orderStore.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      });

      // Runner purchases store 1: purchasedStoreCount is 1 -> extraStoresFee is 0
      const purchase1 = await request
        .put(`/api/v1/runner/orders/${orderId}/stores/${stores[0].id}/purchase`)
        .set('Authorization', `Bearer ${runnerToken}`);
      expect(purchase1.status).toBe(200);

      const orderAfterStore1 = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(orderAfterStore1.extraStoresFee).toBe(0);
      expect(orderAfterStore1.totalFee).toBe(60);

      // Runner purchases store 2: purchasedStoreCount is 2 -> extraStoresFee becomes 20
      const purchase2 = await request
        .put(`/api/v1/runner/orders/${orderId}/stores/${stores[1].id}/purchase`)
        .set('Authorization', `Bearer ${runnerToken}`);
      expect(purchase2.status).toBe(200);

      const orderAfterStore2 = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(orderAfterStore2.extraStoresFee).toBe(20);
      expect(orderAfterStore2.totalFee).toBe(80);
    });

    /**
     * TODO(6A-3.2): Current recalculateFee() overwrites baseFee with PRICING.BASE_FEE (60)
     * instead of preserving the order snapshot baseFee (Decision D6 / B2 in PRE_SPRINT_CHECKLIST).
     *
     * In this test:
     * - Order has a custom baseFee = 80 in its snapshot.
     * - When runner purchases a store, recalculateFee() runs.
     * - EXPECTED (Sprint 6A): order.baseFee remains 80.
     * - ACTUAL (Current code): recalculateFee() calls calculateFee() which reads static PRICING.BASE_FEE (60),
     *   resetting order.baseFee to 60.
     * Marked with it.fails to document and pin this current behavior defect without altering business code.
     */
    it.fails('7.2 (Defect B2) should preserve order snapshot baseFee when runner purchases store', async () => {
      const createRes = await createCustomerOrder(['Store One', 'Store Two']);
      expect(createRes.status).toBe(201);
      const orderId = createRes.body.id;

      await reviewAndApproveOrder(orderId, false);

      // Simulate an order snapshot with custom baseFee = 80
      await prisma.order.update({
        where: { id: orderId },
        data: { baseFee: 80, totalFee: 100 },
      });

      const assignRes = await request
        .put(`/api/v1/admin/orders/${orderId}/assign-runner`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ runnerId: runnerUser.runner!.id });
      expect(assignRes.status).toBe(200);

      await request
        .put(`/api/v1/runner/orders/${orderId}/start`)
        .set('Authorization', `Bearer ${runnerToken}`);

      const stores = await prisma.orderStore.findMany({
        where: { orderId },
        orderBy: { createdAt: 'asc' },
      });

      // Runner purchases store 1
      await request
        .put(`/api/v1/runner/orders/${orderId}/stores/${stores[0].id}/purchase`)
        .set('Authorization', `Bearer ${runnerToken}`);

      const orderAfterPurchase = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });

      // In the desired architecture (B2), the order snapshot baseFee of 80 must be preserved.
      // But in the current code, calculateFee() resets it to 60, causing this assertion to fail:
      expect(orderAfterPurchase.baseFee).toBe(80);
    });
  });
});
