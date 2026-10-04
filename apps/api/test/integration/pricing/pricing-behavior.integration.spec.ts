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
import { getOperationalDate } from '../../../src/modules/settlements/settlements.service';

/**
 * ⚠️ WARNING: Hardcoded financial numbers in these tests (baseFee=60, peripheralFee=40, extraStoresFee=20)
 * reflect current frozen baseline behavior. They will be refactored to read from PlatformPricing / PricingConfig
 * dynamically in Sprint 6A-3.
 *
 * Sprint 6A - Baseline Pricing Behavior Integration Tests (S1)
 *
 * Freezes existing pricing behavior across:
 * 1. Order creation fee snapshot (single and multi-store).
 * 2. Peripheral zone fee on admin approval.
 * 3. Delivery ledger entries (100% total, 75% runner, 25% platform) and idempotency.
 * 4. V3 Settlement Verifications:
 *    - 4.1 Full Flow: Comprehensive E2E settlement lifecycle.
 *    - 4.2 (i): getCurrentSettlement vs ΣLedger[RUNNER_SHARE].
 *    - 4.3 (ii): closeDay vs ΣLedger[RUNNER_SHARE].
 *    - 4.4 (iii): ΣSettlementItem vs order ledger constraints.
 * 5. Rounding Defect Characterization & Future Invariant:
 *    - 5.1 (Characterization): Demonstrates 1 SYP drift (90 vs 91) on odd fees (61 + 61).
 *    - 5.2 (Future Invariant - it.skip): Equality requirement for 6A-5.
 * 6. recalculateFee behavior and documentation of live-recalculation bug (B2):
 *    - 6.1: Extra stores fee recalculated dynamically as runner purchases stores.
 *    - 6.2 (Mechanism B2 - it.skip): Snapshot preservation requirement for 6A-4.
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

  // Helper to setup two delivered orders (Order 1: 60 SYP, Order 2: 120 SYP)
  async function setupTwoDeliveredOrders() {
    const createRes1 = await createCustomerOrder(['Store Normal']);
    expect(createRes1.status).toBe(201);
    const order1Id = createRes1.body.id;
    await reviewAndApproveOrder(order1Id, false);
    await assignAndDeliverOrder(order1Id);

    const createRes2 = await createCustomerOrder(['Store Peripheral 1', 'Store Peripheral 2']);
    expect(createRes2.status).toBe(201);
    const order2Id = createRes2.body.id;
    await reviewAndApproveOrder(order2Id, true);
    await assignAndDeliverOrder(order2Id);

    return { order1Id, order2Id };
  }

  // Helper to setup two delivered orders with 61 SYP each (fabricated in test DB)
  async function setupTwoDeliveredOrdersWithOddFees() {
    const { order1Id, order2Id } = await setupTwoDeliveredOrders();

    // Fabricate totalFee: 61 for both orders in test DB (Order.totalFee only, zero ledger mutations)
    await prisma.order.update({ where: { id: order1Id }, data: { totalFee: 61 } });
    await prisma.order.update({ where: { id: order2Id }, data: { totalFee: 61 } });

    return { order1Id, order2Id };
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
  // 4. V3 Settlement Verifications (Full Flow + 3 Independent Tests)
  // =========================================================================
  describe('4. V3 Settlement Verifications', () => {
    it('4.1 Full Flow: should verify Settlement.runnerShare equals sum of Ledger RUNNER_SHARE entries across full lifecycle', async () => {
      const { order1Id, order2Id } = await setupTwoDeliveredOrders();

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

      // Verify getCurrentSettlement
      const currentSettlementRes = await request
        .get('/api/v1/runner/settlements/current')
        .set('Authorization', `Bearer ${runnerToken}`);

      expect(currentSettlementRes.status).toBe(200);
      const current = currentSettlementRes.body;
      expect(current.totalOrders).toBe(2);
      expect(current.totalFees).toBe(180);
      expect(current.estimatedRunnerShare).toBe(totalRunnerShareLedger);
      expect(current.estimatedPlatformShare).toBe(totalPlatformShareLedger);
      expect(current.estimatedRunnerShare + current.estimatedPlatformShare).toBe(current.totalFees);

      // Verify closeDay
      const operationalDate = getOperationalDate();
      const closeDayRes = await request
        .post('/api/v1/admin/settlements/close-day')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          operationalDate,
          notes: 'Sprint 6A S1 settlement full flow test',
        });

      expect(closeDayRes.status).toBe(201);
      const createdSettlement = closeDayRes.body.settlements[0];
      expect(createdSettlement.totalOrders).toBe(2);
      expect(createdSettlement.totalFees).toBe(180);
      expect(createdSettlement.runnerShare).toBe(totalRunnerShareLedger);
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
      expect(createdSettlement.runnerShare).toBe(totalRunnerShareLedger);
    });

    it('4.2 (i) should verify getCurrentSettlement runner share equals sum of Ledger RUNNER_SHARE entries', async () => {
      const { order1Id, order2Id } = await setupTwoDeliveredOrders();

      const ledgerEntries = await prisma.ledgerEntry.findMany({
        where: {
          orderId: { in: [order1Id, order2Id] },
          type: 'RUNNER_SHARE',
        },
      });
      const sumLedgerRunnerShare = ledgerEntries.reduce((sum, e) => sum + e.amount, 0);

      const res = await request
        .get('/api/v1/runner/settlements/current')
        .set('Authorization', `Bearer ${runnerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.estimatedRunnerShare).toBe(sumLedgerRunnerShare);
    });

    it('4.3 (ii) should verify closeDay created settlement runner share equals sum of Ledger RUNNER_SHARE entries', async () => {
      const { order1Id, order2Id } = await setupTwoDeliveredOrders();

      const ledgerEntries = await prisma.ledgerEntry.findMany({
        where: {
          orderId: { in: [order1Id, order2Id] },
          type: 'RUNNER_SHARE',
        },
      });
      const sumLedgerRunnerShare = ledgerEntries.reduce((sum, e) => sum + e.amount, 0);

      const operationalDate = getOperationalDate();
      const closeDayRes = await request
        .post('/api/v1/admin/settlements/close-day')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ operationalDate, notes: 'Independent closeDay test' });

      expect(closeDayRes.status).toBe(201);
      const createdSettlement = closeDayRes.body.settlements[0];
      expect(createdSettlement.runnerShare).toBe(sumLedgerRunnerShare);
    });

    it('4.4 (iii) should verify sum of SettlementItem shares matches Settlement totals and order ledger entries', async () => {
      const { order1Id, order2Id } = await setupTwoDeliveredOrders();

      const operationalDate = getOperationalDate();
      const closeDayRes = await request
        .post('/api/v1/admin/settlements/close-day')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ operationalDate, notes: 'Independent SettlementItem test' });

      expect(closeDayRes.status).toBe(201);
      const createdSettlement = closeDayRes.body.settlements[0];

      const settlementItems = await prisma.settlementItem.findMany({
        where: { settlementId: createdSettlement.id },
      });
      expect(settlementItems).toHaveLength(2);

      for (const item of settlementItems) {
        const orderLedger = await prisma.ledgerEntry.findMany({
          where: { orderId: item.orderId },
        });
        const orderTotal = orderLedger.find((e) => e.type === 'ORDER_FEE_TOTAL')!.amount;
        const orderRunner = orderLedger.find((e) => e.type === 'RUNNER_SHARE')!.amount;
        const orderPlatform = orderLedger.find((e) => e.type === 'PLATFORM_SHARE')!.amount;

        expect(item.orderFee).toBe(orderTotal);
        expect(item.runnerShare).toBe(orderRunner);
        expect(item.platformShare).toBe(orderPlatform);
      }

      const sumRunner = settlementItems.reduce((sum, item) => sum + item.runnerShare, 0);
      const sumPlatform = settlementItems.reduce((sum, item) => sum + item.platformShare, 0);
      const sumTotal = settlementItems.reduce((sum, item) => sum + item.orderFee, 0);

      expect(sumRunner).toBe(createdSettlement.runnerShare);
      expect(sumPlatform).toBe(createdSettlement.platformShare);
      expect(sumTotal).toBe(createdSettlement.totalFees);
    });
  });

  // =========================================================================
  // 5. Rounding Defect Characterization & Future Invariant
  // =========================================================================
  describe('5. Rounding Defect on Odd Fees (Characterization & Target Invariant)', () => {
    /**
     * Characterization test: documents the CURRENT behavior on odd order fees (e.g. 61 SYP).
     *
     * In current code:
     * - closeDay (settlements.service.ts:~158):
     *   Loops per order: Math.floor(61 * 0.75) + Math.floor(61 * 0.75) = 45 + 45 = 90
     * - getCurrentSettlement (settlements.service.ts:~522):
     *   Sums fees first: Math.floor((61 + 61) * 0.75) = Math.floor(122 * 0.75) = 91
     *
     * Result: 1 SYP drift between live preview and closed daily settlement.
     *
     * // TODO(6A-3.3): replace characterization with the equality assertion
     */
    it('5.1 (Characterization) should document current rounding drift (90 vs 91) between closeDay and getCurrentSettlement on odd fees', async () => {
      await setupTwoDeliveredOrdersWithOddFees();

      // Current settlement live preview calculates floor of sum: floor(122 * 0.75) = 91
      const currentRes = await request
        .get('/api/v1/runner/settlements/current')
        .set('Authorization', `Bearer ${runnerToken}`);

      expect(currentRes.status).toBe(200);
      const currentRunnerShare = currentRes.body.estimatedRunnerShare;
      expect(currentRunnerShare).toBe(91);

      // closeDay daily settlement calculates sum of floors: floor(61*0.75) + floor(61*0.75) = 90
      const operationalDate = getOperationalDate();
      const closeDayRes = await request
        .post('/api/v1/admin/settlements/close-day')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ operationalDate, notes: 'Rounding characterization test' });

      expect(closeDayRes.status).toBe(201);
      const closedRunnerShare = closeDayRes.body.settlements[0].runnerShare;
      expect(closedRunnerShare).toBe(90);

      // Characterization assertion: documents current 1 SYP difference explicitly (91 vs 90)
      expect(currentRunnerShare - closedRunnerShare).toBe(1);
    });

    /**
     * // TODO(6A-3.3): replace characterization with the equality assertion
     *
     * Desired invariant for Sprint 6A (after unifying SettlementsService share computation with RUNNER_SHARE_BP):
     * getCurrentSettlement and closeDay must match each other (zero drift on odd fees).
     */
    it.skip('5.2 (Desired Invariant) getCurrentSettlement estimatedRunnerShare must equal closeDay runnerShare on odd fees', async () => {
      await setupTwoDeliveredOrdersWithOddFees();

      const currentRes = await request
        .get('/api/v1/runner/settlements/current')
        .set('Authorization', `Bearer ${runnerToken}`);
      const currentRunnerShare = currentRes.body.estimatedRunnerShare;

      const operationalDate = getOperationalDate();
      const closeDayRes = await request
        .post('/api/v1/admin/settlements/close-day')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ operationalDate, notes: 'Rounding invariant target test' });
      const closedRunnerShare = closeDayRes.body.settlements[0].runnerShare;

      // Target invariant: 0 drift between live preview and closed daily settlement
      expect(currentRunnerShare).toBe(closedRunnerShare);
    });
  });

  // =========================================================================
  // 6. recalculateFee Behavior & Snapshot Preservation
  // =========================================================================
  describe('6. recalculateFee Behavior & Snapshot Preservation', () => {
    it('6.1 should recalculate extraStoresFee dynamically as runner purchases stores', async () => {
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
     * Demonstrates that recalculateFee() preserves the order snapshot baseFee (80)
     * instead of resetting to the live static constant PRICING.BASE_FEE (60)
     * (Decision D11 / B2 in PRE_SPRINT_CHECKLIST).
     *
     * State is fabricated via direct DB update to simulate an order created with a custom baseFee.
     */
    it('6.2 (Mechanism B2) should preserve order snapshot baseFee when runner purchases store (state fabricated via direct DB update)', async () => {
      const createRes = await createCustomerOrder(['Store One', 'Store Two']);
      expect(createRes.status).toBe(201);
      const orderId = createRes.body.id;

      await reviewAndApproveOrder(orderId, false);

      // Fabricate order snapshot with custom baseFee = 80 via direct DB update
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

      // Desired assertion for Sprint 6A (currently fails because recalculateFee resets baseFee to 60):
      expect(orderAfterPurchase.baseFee).toBe(80);
    });

    it('6.3 should preserve baseFee and peripheralFee across store purchases and delivery for approved peripheral order, matching ledger', async () => {
      // Create peripheral order with 2 stores
      const createRes = await createCustomerOrder(['Peripheral Store 1', 'Peripheral Store 2']);
      expect(createRes.status).toBe(201);
      const orderId = createRes.body.id;

      // Admin approves order as peripheral
      const approveRes = await reviewAndApproveOrder(orderId, true);
      expect(approveRes.status).toBe(200);

      const orderBeforeRun = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(orderBeforeRun.baseFee).toBe(60);
      expect(orderBeforeRun.peripheralFee).toBe(40);
      expect(orderBeforeRun.extraStoresFee).toBe(20);
      expect(orderBeforeRun.totalFee).toBe(120);

      // Advance through assignment, purchases of all stores, and delivery
      const { deliverRes } = await assignAndDeliverOrder(orderId);
      expect(deliverRes.status).toBe(200);

      // Verify order snapshots remain preserved
      const deliveredOrder = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
      expect(deliveredOrder.status).toBe('DELIVERED');
      expect(deliveredOrder.baseFee).toBe(60);
      expect(deliveredOrder.peripheralFee).toBe(40);
      expect(deliveredOrder.extraStoresFee).toBe(20);
      expect(deliveredOrder.totalFee).toBe(120);

      // Verify ledger entries match totalFee and 75/25 breakdown
      const entries = await prisma.ledgerEntry.findMany({ where: { orderId } });
      expect(entries).toHaveLength(3);

      const totalEntry = entries.find((e) => e.type === 'ORDER_FEE_TOTAL')!;
      const runnerEntry = entries.find((e) => e.type === 'RUNNER_SHARE')!;
      const platformEntry = entries.find((e) => e.type === 'PLATFORM_SHARE')!;

      expect(totalEntry.amount).toBe(deliveredOrder.totalFee); // 120
      expect(runnerEntry.amount).toBe(90); // 120 * 0.75
      expect(platformEntry.amount).toBe(30); // 120 * 0.25
      expect(runnerEntry.amount + platformEntry.amount).toBe(totalEntry.amount);
    });
  });
});
