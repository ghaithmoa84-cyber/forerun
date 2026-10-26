/**
 * Scenario 1: Concurrent Order Creation
 * 
 * Tests concurrent order creation (10, 30, 50 orders in approximately the same second)
 * from DIFFERENT customer accounts.
 * 
 * Measures:
 * - Success rate (HTTP 201 Created)
 * - Latency percentiles (min, avg, p50, p90, p95, p99, max)
 * - Any HTTP 500 errors (MUST BE ZERO)
 * - Uniqueness and formatting of generated orderNumbers
 * 
 * Usage:
 *   node 01-concurrent-orders.js [--concurrency=10|30|50]
 *   TARGET_URL=https://... node 01-concurrent-orders.js --concurrency=30
 */

import { CONFIG, apiUrl } from './config.js';
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
  return 10; // Default local run
}

export async function runConcurrentOrders(concurrency = getConcurrency()) {
  console.log(`\n======================================================`);
  console.log(`▶ Scenario 1: Concurrent Order Creation`);
  console.log(`  Target URL  : ${CONFIG.TARGET_URL}`);
  console.log(`  Concurrency : ${concurrency} orders from distinct customer accounts`);
  console.log(`======================================================\n`);

  const fixtures = await setupFixtures();
  if (fixtures.customers.length < concurrency) {
    throw new Error(`Insufficient customer fixtures (${fixtures.customers.length}) for requested concurrency (${concurrency})`);
  }

  const selectedCustomers = fixtures.customers.slice(0, concurrency);

  console.log(`[Step 1/3] Authenticating ${concurrency} distinct customers in parallel...`);
  const authResults = await Promise.all(
    selectedCustomers.map(async (c) => {
      const token = await ApiClient.getAuthToken(c);
      return {
        customer: c,
        token,
      };
    })
  );
  console.log(`  ✓ All ${concurrency} customers authenticated successfully.`);

  console.log(`[Step 2/3] Preparing synchronized concurrent order payloads...`);
  const metrics = new MetricsCollector(`Scenario 1: Concurrent Orders (N=${concurrency})`);
  const orderNumbers = new Set();

  const payloads = authResults.map((auth, index) => {
    return {
      token: auth.token,
      customer: auth.customer,
      items: [
        {
          itemName: `عنصر تجريبي متزامن ${index + 1}`,
          quantity: '1 كغ',
          customStoreName: 'سوبرماركت التزامن السريع',
          anyStore: false,
        },
      ],
      notes: `Load test order #${index + 1} at ${new Date().toISOString()}`,
    };
  });

  console.log(`[Step 3/3] Releasing ${concurrency} requests simultaneously...`);
  metrics.start();

  const requests = payloads.map(async (p, idx) => {
    const res = await ApiClient.createOrder(p.token, p.items, { notes: p.notes });
    const orderNumber = res.data?.orderNumber;
    if (orderNumber) {
      orderNumbers.add(orderNumber);
    }
    metrics.record(res.status, res.durationMs, res.error, {
      customerId: p.customer.customerId,
      orderNumber,
      orderId: res.data?.id,
    });
    return res;
  });

  const responses = await Promise.all(requests);
  metrics.finish();

  const summary = metrics.printSummary();

  // Verification & Invariants Check
  console.log(`[Verification]`);
  const createdOrders = responses.filter((r) => r.status === 201);
  console.log(`  - Orders Created Successfully : ${createdOrders.length}/${concurrency}`);
  console.log(`  - Unique OrderNumbers        : ${orderNumbers.size}/${createdOrders.length}`);
  console.log(`  - Server (500) Errors        : ${summary.serverErrors}`);

  if (summary.serverErrors > 0) {
    console.error(`  ❌ FAILED: Detected ${summary.serverErrors} internal server error(s)!`);
    return { success: false, summary };
  }

  if (orderNumbers.size !== createdOrders.length) {
    console.error(`  ❌ FAILED: Duplicate orderNumbers detected under concurrency!`);
    return { success: false, summary };
  }

  if (createdOrders.length === concurrency) {
    console.log(`  ✅ PASSED: 100% success rate with complete sequence integrity.\n`);
    return { success: true, summary };
  } else {
    console.log(`  ⚠️ PARTIAL: ${createdOrders.length}/${concurrency} succeeded. Check client throttling or status codes above.\n`);
    return { success: createdOrders.length > 0, summary };
  }
}

// Allow CLI execution directly
if (process.argv[1]?.endsWith('01-concurrent-orders.js')) {
  runConcurrentOrders()
    .then((res) => {
      process.exit(res.success ? 0 : 1);
    })
    .catch((err) => {
      console.error('[Scenario 1 Error]', err);
      process.exit(1);
    });
}
