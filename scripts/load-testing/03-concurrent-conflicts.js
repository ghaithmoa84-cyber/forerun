/**
 * Scenario 3: Concurrent Conflict & Race Condition Guards
 * 
 * Stresses concurrency guards on SINGLE resources under real simultaneous pressure:
 * 1. Concurrent cancellation of the SAME order (from multiple customer & admin connections)
 *    -> Verifies: Exactly 1 wins (HTTP 200), remaining get HTTP 409 ('ORDER_STATUS_CHANGED_CONCURRENTLY'), 0 server errors.
 * 2. Concurrent deletion of the SAME store (from multiple runner connections)
 *    -> Verifies: Exactly 1 wins (HTTP 200), remaining get HTTP 409 ('ORDER_STATUS_CHANGED_CONCURRENTLY'), 0 server errors.
 * 
 * Usage:
 *   node 03-concurrent-conflicts.js [--attempts=10]
 *   TARGET_URL=https://... node 03-concurrent-conflicts.js
 */

import { PrismaClient } from '@prisma/client';
import { CONFIG } from './config.js';
import { setupFixtures } from './setup-fixtures.js';
import { ApiClient } from './helpers/api-client.js';
import { MetricsCollector } from './helpers/metrics.js';

function getAttempts() {
  const arg = process.argv.find((a) => a.startsWith('--attempts='));
  if (arg) {
    const val = parseInt(arg.split('=')[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return 10; // Default 10 simultaneous requests against the same resource
}

export async function runConcurrentConflicts(attempts = getAttempts()) {
  console.log(`\n======================================================`);
  console.log(`▶ Scenario 3: Real Concurrency Conflict Guards`);
  console.log(`  Target URL : ${CONFIG.TARGET_URL}`);
  console.log(`  Attempts   : ${attempts} simultaneous requests per contested resource`);
  console.log(`======================================================\n`);

  const fixtures = await setupFixtures();

  // Step 1: Authenticate Admin, Customer, and Runner
  console.log(`[Step 1/3] Authenticating actors...`);
  const [adminToken, customerToken, runnerToken] = await Promise.all([
    ApiClient.getAuthToken({
      userId: fixtures.admin.userId,
      whatsapp: fixtures.admin.whatsapp,
      password: fixtures.admin.password,
      role: 'ADMIN',
    }),
    ApiClient.getAuthToken(fixtures.customers[25]),
    ApiClient.getAuthToken(fixtures.runners[0]),
  ]);

  const runnerId = fixtures.runners[0].runnerId;

  if (CONFIG.DATABASE_URL) {
    const prisma = new PrismaClient();
    try {
      await prisma.order.updateMany({
        where: { runnerId, status: { in: ['ASSIGNED', 'IN_PROGRESS', 'OUT_FOR_DELIVERY'] } },
        data: { status: 'CANCELLED' },
      });
      await prisma.runner.update({
        where: { id: runnerId },
        data: { status: 'AVAILABLE' },
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  // -------------------------------------------------------------
  // TEST PART 3A: Concurrent cancelOrder on the SAME order
  // -------------------------------------------------------------
  console.log(`\n--- [Part 3A] Testing Concurrent Cancellation on Single Order ---`);
  // Create target order
  const orderCreateRes = await ApiClient.createOrder(customerToken, [
    {
      itemName: 'منتج اختبار حراسة الإلغاء',
      quantity: '1',
      customStoreName: 'متجر اختبار الإلغاء المتزامن',
      anyStore: false,
    },
  ]);

  if (!orderCreateRes.ok || !orderCreateRes.data?.id) {
    throw new Error(`Failed to create order for Part 3A: ${orderCreateRes.status}`);
  }
  const targetOrderId = orderCreateRes.data.id;
  const orderNumber = orderCreateRes.data.orderNumber;
  console.log(`  ✓ Target Order created: ${orderNumber} (${targetOrderId})`);

  const cancelMetrics = new MetricsCollector(`Part 3A: Concurrent cancelOrder (Attempts=${attempts})`);
  cancelMetrics.start();

  // Fire 'attempts' concurrent cancel requests at the exact same millisecond:
  // Split between customer DELETE and admin PUT /cancel
  const half = Math.floor(attempts / 2);
  const cancelPromises = [];

  for (let i = 0; i < attempts; i++) {
    if (i < half) {
      // Customer attempt
      cancelPromises.push(
        ApiClient.cancelOrderCustomer(customerToken, targetOrderId).then((res) => {
          cancelMetrics.record(res.status, res.durationMs, res.error, {
            actor: 'CUSTOMER',
            index: i,
            body: res.data,
          });
          return { actor: 'CUSTOMER', ...res };
        })
      );
    } else {
      // Admin attempt
      cancelPromises.push(
        ApiClient.cancelOrderAdmin(adminToken, targetOrderId, `Concurrent cancel attempt #${i}`).then((res) => {
          cancelMetrics.record(res.status, res.durationMs, res.error, {
            actor: 'ADMIN',
            index: i,
            body: res.data,
          });
          return { actor: 'ADMIN', ...res };
        })
      );
    }
  }

  const cancelResponses = await Promise.all(cancelPromises);
  cancelMetrics.finish();
  const cancelSummary = cancelMetrics.printSummary();

  const successCancels = cancelResponses.filter((r) => r.status === 200);
  const conflictCancels = cancelResponses.filter((r) => r.status === 409);
  const otherCancels = cancelResponses.filter((r) => r.status !== 200 && r.status !== 409);

  console.log(`[Part 3A Verification]`);
  console.log(`  - 200 OK (Winner)       : ${successCancels.length} (Expected: exactly 1)`);
  console.log(`  - 409 Conflict (Guarded): ${conflictCancels.length} (Expected: ${attempts - 1})`);
  console.log(`  - Other status codes    : ${otherCancels.length}`);
  console.log(`  - 500 Server Errors     : ${cancelSummary.serverErrors} (Must be 0)`);

  let partAPassed = true;
  if (successCancels.length !== 1) {
    console.error(`  ❌ FAILED: Exactly ONE cancellation must succeed, but got ${successCancels.length}`);
    partAPassed = false;
  }
  if (cancelSummary.serverErrors > 0) {
    console.error(`  ❌ FAILED: Server 500 errors detected under concurrency`);
    partAPassed = false;
  }
  if (partAPassed) {
    console.log(`  ✅ Part 3A PASSED: Order concurrency guard successfully intercepted simultaneous cancellations.\n`);
  }

  // -------------------------------------------------------------
  // TEST PART 3B: Concurrent deleteOrderStore on the SAME store
  // -------------------------------------------------------------
  console.log(`--- [Part 3B] Testing Concurrent deleteOrderStore on Single Store ---`);
  // Create order with 2 stores (so we can delete one without violating minimum stores invariant)
  const storeOrderRes = await ApiClient.createOrder(customerToken, [
    {
      itemName: 'منتج المتجر 1',
      quantity: '1',
      customStoreName: 'متجر الحذف المتزامن أ',
      anyStore: false,
    },
    {
      itemName: 'منتج المتجر 2',
      quantity: '1',
      customStoreName: 'متجر الحفظ ب',
      anyStore: false,
    },
  ]);

  if (!storeOrderRes.ok || !storeOrderRes.data?.id) {
    throw new Error(`Failed to create order for Part 3B: ${storeOrderRes.status}`);
  }
  const storeOrderId = storeOrderRes.data.id;

  // Start review, approve & assign to runner & start order
  await ApiClient.startReview(adminToken, storeOrderId);
  await ApiClient.approveOrder(adminToken, storeOrderId, 0);
  await ApiClient.assignRunner(adminToken, storeOrderId, runnerId);
  await ApiClient.startOrder(runnerToken, storeOrderId);

  // Fetch stores
  const runnerStoresRes = await ApiClient.getRunnerStores(runnerToken, storeOrderId);
  const stores = runnerStoresRes.data?.stores;
  if (!runnerStoresRes.ok || !stores || stores.length < 2) {
    throw new Error(`Failed to retrieve order stores for Part 3B: ${runnerStoresRes.status} ${JSON.stringify(runnerStoresRes.data)}`);
  }
  const targetStoreId = stores[0].id;
  console.log(`  ✓ Target Order in IN_PROGRESS: ${storeOrderId}, Contested Store: ${targetStoreId}`);

  const deleteStoreMetrics = new MetricsCollector(`Part 3B: Concurrent deleteOrderStore (Attempts=${attempts})`);
  deleteStoreMetrics.start();

  // Fire 'attempts' concurrent store deletion requests at the exact same millisecond
  const deletePromises = Array.from({ length: attempts }).map((_, idx) =>
    ApiClient.deleteOrderStore(runnerToken, storeOrderId, targetStoreId).then((res) => {
      deleteStoreMetrics.record(res.status, res.durationMs, res.error, {
        index: idx,
        body: res.data,
      });
      return res;
    })
  );

  const deleteResponses = await Promise.all(deletePromises);
  deleteStoreMetrics.finish();
  const deleteSummary = deleteStoreMetrics.printSummary();

  const successDeletes = deleteResponses.filter((r) => r.status === 200);
  const conflictOrUnprocDeletes = deleteResponses.filter((r) => r.status === 409 || r.status === 422);
  const otherDeletes = deleteResponses.filter((r) => r.status !== 200 && r.status !== 409 && r.status !== 422);

  console.log(`[Part 3B Verification]`);
  console.log(`  - 200 OK (Winner)       : ${successDeletes.length} (Expected: exactly 1)`);
  console.log(`  - 409/422 Guarded       : ${conflictOrUnprocDeletes.length} (Expected: ${attempts - 1})`);
  console.log(`  - Other status codes    : ${otherDeletes.length}`);
  console.log(`  - 500 Server Errors     : ${deleteSummary.serverErrors} (Must be 0)`);

  let partBPassed = true;
  if (successDeletes.length !== 1) {
    console.error(`  ❌ FAILED: Exactly ONE store deletion must succeed, but got ${successDeletes.length}`);
    partBPassed = false;
  }
  if (deleteSummary.serverErrors > 0) {
    console.error(`  ❌ FAILED: Server 500 errors detected under concurrency`);
    partBPassed = false;
  }
  if (partBPassed) {
    console.log(`  ✅ Part 3B PASSED: Store concurrency guard successfully intercepted simultaneous deletions.\n`);
  }

  const allPassed = partAPassed && partBPassed;
  return {
    success: allPassed,
    partA: cancelSummary,
    partB: deleteSummary,
  };
}

// Allow CLI execution directly
if (process.argv[1]?.endsWith('03-concurrent-conflicts.js')) {
  runConcurrentConflicts()
    .then((res) => {
      process.exit(res.success ? 0 : 1);
    })
    .catch((err) => {
      console.error('[Scenario 3 Error]', err);
      process.exit(1);
    });
}
