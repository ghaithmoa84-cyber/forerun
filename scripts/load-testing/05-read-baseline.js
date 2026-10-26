/**
 * Scenario 5: Read Endpoints Baseline Benchmark
 * 
 * Measures baseline throughput (req/s), latency percentiles, and errors across
 * common read endpoints using autocannon:
 * 1. Public cached endpoint: GET /api/v1/banners/active
 * 2. Authenticated DB query: GET /api/v1/customer/orders?page=1&limit=10
 * 
 * Usage:
 *   node 05-read-baseline.js [--duration=5|10] [--connections=10|20]
 *   TARGET_URL=https://... node 05-read-baseline.js --duration=10
 */

import autocannon from 'autocannon';
import { CONFIG, apiUrl } from './config.js';
import { setupFixtures } from './setup-fixtures.js';
import { ApiClient } from './helpers/api-client.js';

function getOptions() {
  let duration = 5;
  let connections = 10;

  const durArg = process.argv.find((a) => a.startsWith('--duration='));
  if (durArg) {
    const val = parseInt(durArg.split('=')[1], 10);
    if (!isNaN(val) && val > 0) duration = val;
  } else if (process.env.BENCH_DURATION) {
    const val = parseInt(process.env.BENCH_DURATION, 10);
    if (!isNaN(val) && val > 0) duration = val;
  }

  const connArg = process.argv.find((a) => a.startsWith('--connections='));
  if (connArg) {
    const val = parseInt(connArg.split('=')[1], 10);
    if (!isNaN(val) && val > 0) connections = val;
  } else if (process.env.BENCH_CONNECTIONS) {
    const val = parseInt(process.env.BENCH_CONNECTIONS, 10);
    if (!isNaN(val) && val > 0) connections = val;
  }

  return { duration, connections };
}

function runAutocannonAsync(opts) {
  return new Promise((resolve, reject) => {
    autocannon(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

function printAutocannonResult(name, res) {
  const divider = '─'.repeat(55);
  console.log(`\n┌${divider}┐`);
  console.log(`│ BENCHMARK REPORT: ${name.padEnd(53 - 18)}│`);
  console.log(`├${divider}┤`);
  console.log(`│ Requests (Total) : ${String(res.requests.total).padEnd(35)}│`);
  console.log(`│ Duration         : ${(res.duration + ' sec').padEnd(35)}│`);
  console.log(`│ Req/Sec (Avg)    : ${(res.requests.average.toFixed(2) + ' req/s').padEnd(35)}│`);
  console.log(`│ Req/Sec (Max)    : ${(res.requests.max + ' req/s').padEnd(35)}│`);
  console.log(`│ Throughput (Avg) : ${((res.throughput.average / 1024).toFixed(2) + ' KB/s').padEnd(35)}│`);
  console.log(`│ 2xx Successes    : ${String(res['2xx']).padEnd(35)}│`);
  console.log(`│ Non-2xx / Errors : ${String(res.non2xx).padEnd(35)}│`);
  console.log(`├${divider}┤`);
  console.log(`│ Latency (ms):                                        │`);
  console.log(`│   Min : ${String(res.latency.min).padEnd(10)} Avg : ${String(res.latency.average.toFixed(2)).padEnd(10)} Max : ${String(res.latency.max).padEnd(10)}│`);
  console.log(`│   p50 : ${String(res.latency.p50).padEnd(10)} p90 : ${String(res.latency.p90).padEnd(10)} p97.5: ${String(res.latency.p97_5).padEnd(10)}│`);
  console.log(`│   p99 : ${String(res.latency.p99).padEnd(45)}│`);
  console.log(`└${divider}┘\n`);
}

export async function runReadBaseline(options = getOptions()) {
  const { duration, connections } = options;

  console.log(`\n======================================================`);
  console.log(`▶ Scenario 5: Read Endpoints Baseline Benchmark`);
  console.log(`  Target URL  : ${CONFIG.TARGET_URL}`);
  console.log(`  Connections : ${connections} concurrent connections`);
  console.log(`  Duration    : ${duration} seconds per endpoint`);
  console.log(`======================================================\n`);

  const fixtures = await setupFixtures();

  // 1. Authenticate Customer for Target 2
  console.log(`[Step 1/3] Authenticating customer for protected endpoint benchmark...`);
  const custFixture = fixtures.customers[0];
  const customerToken = await ApiClient.getAuthToken(custFixture);
  console.log(`  ✓ Authenticated as ${custFixture.whatsapp}`);

  // 2. Benchmark Target 1: Public cached endpoint GET /banners/active
  console.log(`\n[Step 2/3] Benchmarking Target 1: GET /api/v1/banners/active (Public / In-Memory Cache)...`);
  const bannersUrl = apiUrl('/banners/active');
  const bannersResult = await runAutocannonAsync({
    url: bannersUrl,
    method: 'GET',
    connections,
    duration,
    pipelining: 1,
  });
  printAutocannonResult('GET /banners/active', bannersResult);

  // 3. Benchmark Target 2: Protected DB query GET /customer/orders
  console.log(`[Step 3/3] Benchmarking Target 2: GET /api/v1/customer/orders (Protected / DB Query)...`);
  const ordersUrl = apiUrl('/customer/orders?page=1&limit=10');
  const ordersResult = await runAutocannonAsync({
    url: ordersUrl,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${customerToken}`,
    },
    connections,
    duration,
    pipelining: 1,
  });
  printAutocannonResult('GET /customer/orders', ordersResult);

  // Evaluation
  const bannersOk = bannersResult.non2xx === 0 || bannersResult['2xx'] > 0;
  const ordersOk = ordersResult.non2xx === 0 || ordersResult['2xx'] > 0;

  console.log(`[Baseline Summary]`);
  console.log(`  - /banners/active : ${bannersResult.requests.average.toFixed(0)} req/s (p50: ${bannersResult.latency.p50}ms, p99: ${bannersResult.latency.p99}ms)`);
  console.log(`  - /customer/orders: ${ordersResult.requests.average.toFixed(0)} req/s (p50: ${ordersResult.latency.p50}ms, p99: ${ordersResult.latency.p99}ms)`);

  const passed = bannersOk && ordersOk && bannersResult.errors === 0 && ordersResult.errors === 0;

  if (passed) {
    console.log(`  ✅ PASSED: Both read endpoints responded with clean baseline metrics.\n`);
  } else {
    console.log(`  ⚠️ WARN/FAIL: Errors detected during read baseline test.\n`);
  }

  return {
    success: passed,
    banners: bannersResult,
    orders: ordersResult,
  };
}

// Allow CLI execution directly
if (process.argv[1]?.endsWith('05-read-baseline.js')) {
  runReadBaseline()
    .then((res) => {
      process.exit(res.success ? 0 : 1);
    })
    .catch((err) => {
      console.error('[Scenario 5 Error]', err);
      process.exit(1);
    });
}
