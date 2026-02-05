/**
 * Test script: Validate server handles 15+ concurrent WebSocket connections
 * Run with: npx tsx packages/server/src/test-connections.ts
 */

import { io, type Socket } from "socket.io-client";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3010";
const NUM_CLIENTS = 20;
const TIMEOUT_MS = 10000;

interface TestResult {
  connected: number;
  failed: number;
  latencies: number[];
}

async function testConnections(): Promise<TestResult> {
  const clients: Socket[] = [];
  const result: TestResult = { connected: 0, failed: 0, latencies: [] };

  console.log(`\n🔌 Testing ${NUM_CLIENTS} concurrent connections to ${SERVER_URL}\n`);

  const connectionPromises = Array.from({ length: NUM_CLIENTS }, (_, i) => {
    return new Promise<void>((resolve) => {
      const startTime = Date.now();
      const client = io(SERVER_URL, {
        timeout: TIMEOUT_MS,
        forceNew: true,
      });

      clients.push(client);

      client.on("connect", () => {
        const latency = Date.now() - startTime;
        result.latencies.push(latency);
        result.connected++;
        console.log(`  ✅ Client ${i + 1} connected (${latency}ms)`);
        resolve();
      });

      client.on("connect_error", (err) => {
        result.failed++;
        console.log(`  ❌ Client ${i + 1} failed: ${err.message}`);
        resolve();
      });

      // Timeout fallback
      setTimeout(() => {
        if (!client.connected) {
          result.failed++;
          console.log(`  ⏱️ Client ${i + 1} timed out`);
          resolve();
        }
      }, TIMEOUT_MS);
    });
  });

  await Promise.all(connectionPromises);

  // Cleanup
  clients.forEach((c) => c.close());

  return result;
}

async function testStateLatency(): Promise<number[]> {
  console.log("\n⚡ Testing state change latency\n");

  const latencies: number[] = [];
  const client = io(SERVER_URL, { forceNew: true });

  await new Promise<void>((resolve) => {
    client.on("connect", resolve);
  });

  // Measure 5 state changes
  for (const state of ["alert", "normal", "active", "damaged", "normal"] as const) {
    const start = Date.now();

    await new Promise<void>((resolve) => {
      client.once("state", () => {
        const latency = Date.now() - start;
        latencies.push(latency);
        console.log(`  State → ${state}: ${latency}ms`);
        resolve();
      });
      client.emit("stateChange", state);
    });

    // Small delay between tests
    await new Promise((r) => setTimeout(r, 100));
  }

  client.close();
  return latencies;
}

async function main() {
  console.log("═".repeat(60));
  console.log("  LCARS Display System - Acceptance Criteria Validation");
  console.log("═".repeat(60));

  // Test 1: Connection capacity
  const connResult = await testConnections();
  const avgConnLatency =
    connResult.latencies.length > 0
      ? Math.round(connResult.latencies.reduce((a, b) => a + b, 0) / connResult.latencies.length)
      : 0;

  // Test 2: State latency
  const stateLatencies = await testStateLatency();
  const avgStateLatency =
    stateLatencies.length > 0
      ? Math.round(stateLatencies.reduce((a, b) => a + b, 0) / stateLatencies.length)
      : 0;
  const maxStateLatency = Math.max(...stateLatencies, 0);

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("  RESULTS SUMMARY");
  console.log("═".repeat(60));

  console.log("\n📊 Connection Test:");
  console.log(`   Connected: ${connResult.connected}/${NUM_CLIENTS}`);
  console.log(`   Failed: ${connResult.failed}`);
  console.log(`   Avg latency: ${avgConnLatency}ms`);
  const connPass = connResult.connected >= 15;
  console.log(`   ${connPass ? "✅ PASS" : "❌ FAIL"}: Server accepts 15+ connections`);

  console.log("\n📊 State Latency Test:");
  console.log(`   Avg latency: ${avgStateLatency}ms`);
  console.log(`   Max latency: ${maxStateLatency}ms`);
  const latencyPass = maxStateLatency < 100;
  console.log(`   ${latencyPass ? "✅ PASS" : "❌ FAIL"}: State changes < 100ms`);

  console.log("\n" + "═".repeat(60));
  const allPass = connPass && latencyPass;
  console.log(`  OVERALL: ${allPass ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`);
  console.log("═".repeat(60) + "\n");

  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
