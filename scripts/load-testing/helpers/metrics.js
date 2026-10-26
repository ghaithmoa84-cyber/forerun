/**
 * Performance and Response Metrics Aggregator
 */

export class MetricsCollector {
  constructor(name) {
    this.name = name;
    this.startTime = 0;
    this.endTime = 0;
    this.results = [];
  }

  start() {
    this.startTime = performance.now();
    this.results = [];
  }

  record(status, durationMs, error = null, extra = {}) {
    this.results.push({
      status,
      durationMs,
      error,
      ...extra,
      timestamp: performance.now(),
    });
  }

  finish() {
    this.endTime = performance.now();
  }

  summary() {
    const totalRequests = this.results.length;
    const totalWallDurationMs = this.endTime - this.startTime;
    const durations = this.results.map((r) => r.durationMs).sort((a, b) => a - b);

    const percentile = (p) => {
      if (durations.length === 0) return 0;
      const idx = Math.min(Math.floor((p / 100) * durations.length), durations.length - 1);
      return durations[idx];
    };

    const statusCounts = {};
    let successCount = 0;
    let clientErrors = 0;
    let serverErrors = 0;
    let networkErrors = 0;

    for (const r of this.results) {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
      if (r.status >= 200 && r.status < 300) {
        successCount++;
      } else if (r.status >= 400 && r.status < 500) {
        clientErrors++;
      } else if (r.status >= 500) {
        serverErrors++;
      } else if (r.status === 0 || r.error) {
        networkErrors++;
      }
    }

    const sumDuration = durations.reduce((acc, d) => acc + d, 0);
    const avgDuration = durations.length > 0 ? sumDuration / durations.length : 0;
    const rps = totalWallDurationMs > 0 ? (totalRequests / (totalWallDurationMs / 1000)) : 0;

    return {
      name: this.name,
      totalRequests,
      totalWallDurationMs: Number(totalWallDurationMs.toFixed(2)),
      rps: Number(rps.toFixed(2)),
      successCount,
      successRatePct: totalRequests > 0 ? Number(((successCount / totalRequests) * 100).toFixed(2)) : 0,
      clientErrors,
      serverErrors,
      networkErrors,
      statusCounts,
      latencies: {
        min: Number((durations[0] || 0).toFixed(2)),
        avg: Number(avgDuration.toFixed(2)),
        p50: Number(percentile(50).toFixed(2)),
        p90: Number(percentile(90).toFixed(2)),
        p95: Number(percentile(95).toFixed(2)),
        p99: Number(percentile(99).toFixed(2)),
        max: Number((durations[durations.length - 1] || 0).toFixed(2)),
      },
    };
  }

  printSummary() {
    const s = this.summary();
    const divider = '─'.repeat(55);

    console.log(`\n┌${divider}┐`);
    console.log(`│ LOAD TEST REPORT: ${s.name.padEnd(53 - 19)}│`);
    console.log(`├${divider}┤`);
    console.log(`│ Total Requests   : ${String(s.totalRequests).padEnd(35)}│`);
    console.log(`│ Wall Time        : ${(s.totalWallDurationMs + ' ms').padEnd(35)}│`);
    console.log(`│ Throughput       : ${(s.rps + ' req/sec').padEnd(35)}│`);
    console.log(`│ Success (2xx)    : ${(`${s.successCount} (${s.successRatePct}%)`).padEnd(35)}│`);
    console.log(`│ Client Err (4xx) : ${String(s.clientErrors).padEnd(35)}│`);
    console.log(`│ Server Err (5xx) : ${String(s.serverErrors).padEnd(35)}│`);
    console.log(`│ Network/Conn Err : ${String(s.networkErrors).padEnd(35)}│`);
    console.log(`├${divider}┤`);
    console.log(`│ Status Breakdown : ${JSON.stringify(s.statusCounts).padEnd(35)}│`);
    console.log(`├${divider}┤`);
    console.log(`│ Latency (ms):                                        │`);
    console.log(`│   Min : ${String(s.latencies.min).padEnd(10)} Avg : ${String(s.latencies.avg).padEnd(10)} Max : ${String(s.latencies.max).padEnd(10)}│`);
    console.log(`│   p50 : ${String(s.latencies.p50).padEnd(10)} p90 : ${String(s.latencies.p90).padEnd(10)} p95 : ${String(s.latencies.p95).padEnd(10)}│`);
    console.log(`│   p99 : ${String(s.latencies.p99).padEnd(45)}│`);
    console.log(`└${divider}┘\n`);

    return s;
  }
}
