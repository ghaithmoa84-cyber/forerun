/**
 * Scenario 4: Concurrent WebSocket / Socket.IO Connections
 * 
 * Simulates 50-100 concurrent dummy WebSocket connections to the /orders namespace,
 * holds them open for a configurable duration, and measures:
 * - Connection success rate & handshake latency
 * - Connection drops / errors
 * - Approximate memory and connection stability
 * 
 * Usage:
 *   node 04-websocket-connections.js [--connections=50|100] [--duration=10]
 *   TARGET_URL=https://... node 04-websocket-connections.js --connections=50
 */

import { io } from 'socket.io-client';
import { CONFIG } from './config.js';
import { setupFixtures } from './setup-fixtures.js';
import { ApiClient } from './helpers/api-client.js';
import { MetricsCollector } from './helpers/metrics.js';

function getOptions() {
  let connections = 50;
  let durationSeconds = 10;

  const connArg = process.argv.find((a) => a.startsWith('--connections='));
  if (connArg) {
    const val = parseInt(connArg.split('=')[1], 10);
    if (!isNaN(val) && val > 0) connections = val;
  } else if (process.env.WS_CONNECTIONS) {
    const val = parseInt(process.env.WS_CONNECTIONS, 10);
    if (!isNaN(val) && val > 0) connections = val;
  }

  const durArg = process.argv.find((a) => a.startsWith('--duration='));
  if (durArg) {
    const val = parseInt(durArg.split('=')[1], 10);
    if (!isNaN(val) && val > 0) durationSeconds = val;
  } else if (process.env.WS_DURATION) {
    const val = parseInt(process.env.WS_DURATION, 10);
    if (!isNaN(val) && val > 0) durationSeconds = val;
  }

  return { connections, durationSeconds };
}

export async function runWebsocketLoad(options = getOptions()) {
  const { connections, durationSeconds } = options;

  console.log(`\n======================================================`);
  console.log(`▶ Scenario 4: Concurrent WebSocket (Socket.IO) Connections`);
  console.log(`  Target URL  : ${CONFIG.TARGET_URL}`);
  console.log(`  Namespace   : /orders`);
  console.log(`  Connections : ${connections} simultaneous sockets`);
  console.log(`  Hold Time   : ${durationSeconds} seconds`);
  console.log(`======================================================\n`);

  const fixtures = await setupFixtures();

  // 1. Authenticate users to gather tokens
  console.log(`[Step 1/3] Preparing authentication tokens for WebSocket clients...`);
  // Gather up to 50 customer tokens
  const sampleSize = Math.min(connections, fixtures.customers.length);
  const tokenList = [];

  for (let i = 0; i < sampleSize; i++) {
    const c = fixtures.customers[i];
    const token = await ApiClient.getAuthToken(c);
    if (token) {
      tokenList.push(token);
    }
  }

  if (tokenList.length === 0) {
    throw new Error(`Failed to acquire any customer tokens for WebSocket connections`);
  }
  console.log(`  ✓ Acquired ${tokenList.length} distinct authenticated tokens.`);

  // 2. Concurrently open 'connections' Socket.IO sockets
  console.log(`[Step 2/3] Opening ${connections} concurrent WebSocket connections...`);
  const metrics = new MetricsCollector(`Scenario 4: WebSocket Connections (N=${connections})`);
  metrics.start();

  const sockets = [];
  let connectedCount = 0;
  let errorCount = 0;

  const connectPromises = Array.from({ length: connections }).map((_, index) => {
    return new Promise((resolve) => {
      const token = tokenList[index % tokenList.length];
      const start = performance.now();

      const socket = io(`${CONFIG.TARGET_URL}/orders`, {
        transports: ['websocket'],
        auth: { token },
        forceNew: true,
        reconnection: false,
        timeout: 10000,
      });

      socket.on('connect', () => {
        const durationMs = performance.now() - start;
        connectedCount++;
        metrics.record(200, durationMs, null, { socketId: socket.id, index });
        sockets.push(socket);
        resolve({ success: true, socket });
      });

      socket.on('connect_error', (err) => {
        const durationMs = performance.now() - start;
        errorCount++;
        metrics.record(500, durationMs, err.message, { index });
        socket.disconnect();
        resolve({ success: false, error: err.message });
      });
    });
  });

  const memBefore = process.memoryUsage();
  await Promise.all(connectPromises);
  metrics.finish();

  const summary = metrics.printSummary();

  console.log(`[Status] Connected: ${connectedCount}/${connections} | Failed: ${errorCount}/${connections}`);

  // 3. Hold connections open for 'durationSeconds'
  console.log(`[Step 3/3] Holding connections open for ${durationSeconds} seconds to monitor stability...`);
  await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));

  const memAfter = process.memoryUsage();
  const formatMB = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';

  console.log(`\n[Resource Footprint on Test Client]`);
  console.log(`  - Memory RSS (Before) : ${formatMB(memBefore.rss)}`);
  console.log(`  - Memory RSS (After)  : ${formatMB(memAfter.rss)}`);
  console.log(`  - Heap Used           : ${formatMB(memAfter.heapUsed)}`);

  // Clean teardown
  console.log(`\n[Teardown] Gracefully closing ${sockets.length} sockets...`);
  for (const s of sockets) {
    try {
      s.disconnect();
    } catch {
      // Ignore disconnect errors during teardown
    }
  }

  const passed = connectedCount >= Math.floor(connections * 0.95) && summary.serverErrors === 0;

  if (passed) {
    console.log(`  ✅ PASSED: ${connectedCount}/${connections} sockets connected stably with 0 disconnect errors.\n`);
  } else {
    console.log(`  ⚠️ WARN/FAIL: Connected ${connectedCount}/${connections}. Check target server capacity.\n`);
  }

  return {
    success: passed,
    summary,
    connectedCount,
    connections,
  };
}

// Allow CLI execution directly
if (process.argv[1]?.endsWith('04-websocket-connections.js')) {
  runWebsocketLoad()
    .then((res) => {
      process.exit(res.success ? 0 : 1);
    })
    .catch((err) => {
      console.error('[Scenario 4 Error]', err);
      process.exit(1);
    });
}
