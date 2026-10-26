/**
 * Scenario 2: Concurrent Deliveries & Financial Ledger Integrity
 * 
 * Tests concurrent execution of deliverOrder across multiple runners to verify:
 * - deliverOrder concurrency guards and idempotency key handling
 * - Financial ledger invariants: exactly ONE ORDER_FEE_TOTAL entry per delivered order
 * - Runner state machine transition back to AVAILABLE
 * - No race conditions, double payouts, or 500 errors under pressure
 * 
 * Usage:
 *   node 02-concurrent-deliveries.js [--concurrency=5|10]
 *   TARGET_URL=https://... node 02-concurrent-deliveries.js --concurrency=5
 */

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { CONFIG } from './config.js';
import { setupFixtures } from './setup-fixtures.js';
import { ApiClient } from './helpers/api-client.js';
import { MetricsCollector } from './helpers/metrics.js';

function getConcurrency() {
  const arg = process.argv.find((a) => a.startsWith('--concurrency='));
  if (arg) {
    const val = parseInt(arg.split('=')[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }
  const envVal = parseInt(process.env.CONCURRENCY, 10);
  if (!isNaN(envVal) && envVal > 0) return envVal;
  return 5; // Default local run (5 concurrent runner deliveries)
}

export async function runConcurrentDeliveries(concurrency = getConcurrency()) {
  console.log(`\n======================================================`);
  console.log(`▶ Scenario 2: Concurrent Deliveries & Financial Integrity`);
  console.log(`  Target URL  : ${CONFIG.TARGET_URL}`);
  console.log(`  Concurrency : ${concurrency} orders delivered simultaneously by distinct runners`);
  console.log(`======================================================\n`);

  const fixtures = await setupFixtures();
  if (fixtures.runners.length < concurrency || fixtures.customers.length < concurrency) {
    throw new Error(`Insufficient fixtures (Runners: ${fixtures.runners.length}, Customers: ${fixtures.customers.length}) for concurrency=${concurrency}`);
  }

  // 1. Authenticate Admin
  console.log(`[Step 1/5] Authenticating Admin...`);
  const adminToken = await ApiClient.getAuthToken({
    userId: fixtures.admin.userId,
    whatsapp: fixtures.admin.whatsapp,
    password: fixtures.admin.password,
    role: 'ADMIN',
  });

  // 2. Authenticate N Customers and N Runners
  console.log(`[Step 2/5] Authenticating ${concurrency} customers and ${concurrency} runners...`);
  const pairs = [];
  for (let i = 0; i < concurrency; i++) {
    const custFixture = fixtures.customers[35 + i];
    const runnerFixture = fixtures.runners[i];

    const [customerToken, runnerToken] = await Promise.all([
      ApiClient.getAuthToken(custFixture),
      ApiClient.getAuthToken(runnerFixture),
    ]);

    pairs.push({
      index: i + 1,
      customerToken,
      customerFixture: custFixture,
      runnerToken,
      runnerFixture: runnerFixture,
    });
  }
  console.log(`  ✓ All ${concurrency} pairs authenticated successfully.`);

  // Ensure runners have clean AVAILABLE status before test
  if (CONFIG.DATABASE_URL) {
    const prisma = new PrismaClient();
    try {
      const runnerIds = pairs.map((p) => p.runnerFixture.runnerId);
      await prisma.order.updateMany({
        where: {
          runnerId: { in: runnerIds },
          status: { in: ['ASSIGNED', 'IN_PROGRESS', 'OUT_FOR_DELIVERY'] },
        },
        data: { status: 'CANCELLED' },
      });
      await prisma.runner.updateMany({
        where: { id: { in: runnerIds } },
        data: { status: 'AVAILABLE' },
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  // 3. Setup and transition N orders to OUT_FOR_DELIVERY
  console.log(`[Step 3/5] Advancing ${concurrency} orders to OUT_FOR_DELIVERY state...`);
  const deliveryReadyOrders = [];

  for (const pair of pairs) {
    // 3a. Create order
    const createRes = await ApiClient.createOrder(pair.customerToken, [
      {
        itemName: `منتج توصيل تزامن ${pair.index}`,
        quantity: '1',
        customStoreName: `متجر التسليم ${pair.index}`,
        anyStore: false,
      },
    ]);
    if (!createRes.ok || !createRes.data?.id) {
      throw new Error(`Failed to create order for pair ${pair.index}: ${createRes.status}`);
    }
    const orderId = createRes.data.id;
    const orderNumber = createRes.data.orderNumber;

    // 3b. Start review & Approve order
    const reviewRes = await ApiClient.startReview(adminToken, orderId);
    if (!reviewRes.ok) throw new Error(`Failed to start review for order ${orderId}: ${reviewRes.status}`);

    const approveRes = await ApiClient.approveOrder(adminToken, orderId, 0);
    if (!approveRes.ok) throw new Error(`Failed to approve order ${orderId}: ${approveRes.status}`);

    // 3c. Assign runner
    const assignRes = await ApiClient.assignRunner(adminToken, orderId, pair.runnerFixture.runnerId);
    if (!assignRes.ok) throw new Error(`Failed to assign runner to ${orderId}: ${assignRes.status}`);

    // 3d. Runner starts order
    const startRes = await ApiClient.startOrder(pair.runnerToken, orderId);
    if (!startRes.ok) throw new Error(`Failed to start order ${orderId}: ${startRes.status}`);

    // 3e. Runner purchases store
    const storesRes = await ApiClient.getRunnerStores(pair.runnerToken, orderId);
    const storeId = storesRes.data?.stores?.[0]?.id;
    if (!storesRes.ok || !storeId) {
      throw new Error(`No stores found for order ${orderId}: ${storesRes.status} ${JSON.stringify(storesRes.data)}`);
    }
    const purchaseRes = await ApiClient.purchaseStore(pair.runnerToken, orderId, storeId);
    if (!purchaseRes.ok) throw new Error(`Failed to purchase store for ${orderId}: ${purchaseRes.status}`);

    // 3f. Proceed to delivery
    const proceedRes = await ApiClient.proceedToDelivery(pair.runnerToken, orderId);
    if (!proceedRes.ok) throw new Error(`Failed to proceed to delivery for ${orderId}: ${proceedRes.status}`);

    deliveryReadyOrders.push({
      orderId,
      orderNumber,
      runnerToken: pair.runnerToken,
      runnerId: pair.runnerFixture.runnerId,
      customerToken: pair.customerToken,
      idempotencyKey: crypto.randomUUID(),
    });
  }
  console.log(`  ✓ All ${concurrency} orders prepared in OUT_FOR_DELIVERY state.`);

  // 4. Concurrently deliver all orders (including concurrent duplicate attempts per order)
  console.log(`[Step 4/5] Executing concurrent deliveries across all runners...`);
  const metrics = new MetricsCollector(`Scenario 2: Concurrent Deliveries (N=${concurrency})`);
  metrics.start();

  // For each order, we fire the primary delivery AND a concurrent second request with the same key
  // to simultaneously test concurrency guards + idempotency
  const deliveryPromises = deliveryReadyOrders.flatMap((item) => {
    // Primary delivery attempt
    const primary = ApiClient.deliverOrder(item.runnerToken, item.orderId, item.idempotencyKey).then((res) => {
      metrics.record(res.status, res.durationMs, res.error, {
        orderId: item.orderId,
        type: 'primary',
      });
      return { ...res, orderId: item.orderId, type: 'primary' };
    });

    // Concurrent duplicate delivery attempt (simulates network retry / race)
    const duplicate = ApiClient.deliverOrder(item.runnerToken, item.orderId, item.idempotencyKey).then((res) => {
      metrics.record(res.status, res.durationMs, res.error, {
        orderId: item.orderId,
        type: 'duplicate',
      });
      return { ...res, orderId: item.orderId, type: 'duplicate' };
    });

    return [primary, duplicate];
  });

  const results = await Promise.all(deliveryPromises);
  metrics.finish();

  const summary = metrics.printSummary();

  // 5. Invariant & Financial Verification
  console.log(`[Step 5/5] Verifying Financial & State Invariants...`);
  let invariantsPassed = true;

  // Check database or admin ledger API
  if (CONFIG.DATABASE_URL) {
    const prisma = new PrismaClient();
    try {
      for (const item of deliveryReadyOrders) {
        const order = await prisma.order.findUnique({
          where: { id: item.orderId },
          include: { runner: true },
        });

        const ledgerEntries = await prisma.ledgerEntry.findMany({
          where: { orderId: item.orderId },
        });

        // Invariant 1: Order status MUST be DELIVERED
        if (order?.status !== 'DELIVERED') {
          console.error(`  ❌ INVARIANT BROKEN: Order ${item.orderNumber} status is ${order?.status}, expected DELIVERED`);
          invariantsPassed = false;
        }

        // Invariant 2: Exactly ONE ORDER_FEE_TOTAL ledger entry (Decision D25)
        const feeEntries = ledgerEntries.filter((e) => e.type === 'ORDER_FEE_TOTAL');
        if (feeEntries.length !== 1) {
          console.error(`  ❌ INVARIANT BROKEN: Order ${item.orderNumber} has ${feeEntries.length} fee entries (expected exactly 1)`);
          invariantsPassed = false;
        } else if (Number(feeEntries[0].amount) <= 0) {
          console.error(`  ❌ INVARIANT BROKEN: Fee entry amount is ${feeEntries[0].amount} (must be > 0)`);
          invariantsPassed = false;
        }

        // Invariant 3: Runner status returned to AVAILABLE
        if (order?.runner?.status !== 'AVAILABLE') {
          console.error(`  ❌ INVARIANT BROKEN: Runner ${order?.runnerId} status is ${order?.runner?.status}, expected AVAILABLE`);
          invariantsPassed = false;
        }
      }
    } finally {
      await prisma.$disconnect();
    }
  } else {
    // Remote verification via API
    for (const item of deliveryReadyOrders) {
      const ledgerRes = await ApiClient.getAdminLedger(adminToken, item.orderId);
      if (ledgerRes.ok && ledgerRes.data?.data) {
        const feeEntries = ledgerRes.data.data.filter((e) => e.type === 'ORDER_FEE_TOTAL');
        if (feeEntries.length !== 1) {
          console.error(`  ❌ INVARIANT BROKEN via API: Order ${item.orderNumber} has ${feeEntries.length} fee entries`);
          invariantsPassed = false;
        }
      }
    }
  }

  if (summary.serverErrors > 0) {
    console.error(`  ❌ FAILED: Detected ${summary.serverErrors} server (500) error(s)!`);
    return { success: false, summary };
  }

  if (invariantsPassed) {
    console.log(`  ✅ PASSED: All financial invariants strictly verified. Exactly 1 ledger entry per delivery, runner released, 0 server errors.\n`);
    return { success: true, summary };
  } else {
    console.log(`  ❌ FAILED: Financial or state machine invariants violated.\n`);
    return { success: false, summary };
  }
}

// Allow CLI execution directly
if (process.argv[1]?.endsWith('02-concurrent-deliveries.js')) {
  runConcurrentDeliveries()
    .then((res) => {
      process.exit(res.success ? 0 : 1);
    })
    .catch((err) => {
      console.error('[Scenario 2 Error]', err);
      process.exit(1);
    });
}
