/**
 * Master Runner - Executes all 5 Load Testing Scenarios in Sequence
 * 
 * Usage:
 *   node run-all.js
 *   TARGET_URL=https://... node run-all.js
 */

import { runConcurrentOrders } from './01-concurrent-orders.js';
import { runConcurrentDeliveries } from './02-concurrent-deliveries.js';
import { runConcurrentConflicts } from './03-concurrent-conflicts.js';
import { runWebsocketLoad } from './04-websocket-connections.js';
import { runReadBaseline } from './05-read-baseline.js';

async function main() {
  console.log(`\n======================================================`);
  console.log(`🚀 FAWRUN LOAD TESTING SUITE - FULL LOCAL VERIFICATION`);
  console.log(`======================================================\n`);

  const results = {};

  try {
    console.log(`\n>>> [1/5] Running Scenario 1 (Concurrent Orders)...`);
    results.scenario1 = await runConcurrentOrders(10);

    console.log(`\n>>> [2/5] Running Scenario 2 (Concurrent Deliveries)...`);
    results.scenario2 = await runConcurrentDeliveries(3);

    console.log(`\n>>> [3/5] Running Scenario 3 (Concurrent Conflicts)...`);
    results.scenario3 = await runConcurrentConflicts(10);

    console.log(`\n>>> [4/5] Running Scenario 4 (WebSocket Connections)...`);
    results.scenario4 = await runWebsocketLoad({ connections: 50, durationSeconds: 5 });

    console.log(`\n>>> [5/5] Running Scenario 5 (Read Baseline)...`);
    results.scenario5 = await runReadBaseline({ duration: 5, connections: 10 });

    console.log(`\n======================================================`);
    console.log(`🏁 ALL 5 LOAD TESTING SCENARIOS COMPLETED`);
    console.log(`======================================================`);
    console.log(`Scenario 1 (Concurrent Orders)     : ${results.scenario1.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Scenario 2 (Concurrent Deliveries)  : ${results.scenario2.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Scenario 3 (Concurrency Conflicts)  : ${results.scenario3.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Scenario 4 (WebSocket Load)         : ${results.scenario4.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Scenario 5 (Read Baseline)          : ${results.scenario5.success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`======================================================\n`);

    const allPassed = Object.values(results).every((r) => r.success);
    process.exit(allPassed ? 0 : 1);
  } catch (err) {
    console.error(`\n❌ Error during suite execution:`, err);
    process.exit(1);
  }
}

main();
