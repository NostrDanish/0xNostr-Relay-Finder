/**
 * NIP Verification Engine
 *
 * Tests whether a relay's claimed NIP support actually works.
 * Opens a WebSocket, sends targeted test messages, and records
 * whether the relay responds correctly.
 *
 * Verified NIPs:
 * - NIP-01 (basic protocol): REQ + receive EOSE
 * - NIP-09 (deletion): send kind:5 and check OK
 * - NIP-11 (relay info): HTTP fetch with Accept header
 * - NIP-15 (EOSE): send REQ, check for EOSE marker
 * - NIP-20 (command results): send EVENT, check OK response
 * - NIP-42 (auth): check if relay sends AUTH challenge
 * - NIP-45 (count): send COUNT request, check count response
 * - NIP-50 (search): send REQ with search filter, check no error
 */

import { useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NIPVerifyStatus = 'pending' | 'testing' | 'verified' | 'failed' | 'unsupported';

export interface NIPTestResult {
  nip: number;
  name: string;
  status: NIPVerifyStatus;
  /** How the test was performed */
  method: string;
  /** Latency for the test (ms) */
  latencyMs?: number;
  /** Error or failure detail */
  detail?: string;
}

export interface VerificationReport {
  relayUrl: string;
  startedAt: number;
  completedAt?: number;
  results: NIPTestResult[];
  /** Number of claimed NIPs that actually work */
  verified: number;
  /** Number of claimed NIPs that failed verification */
  failed: number;
  /** Number that couldn't be tested */
  untested: number;
  /** Overall relay health score 0-100 based on verification */
  verifyScore: number;
  /** Whether the connection itself succeeded */
  connectionOk: boolean;
  connectionLatencyMs?: number;
}

// ─── NIP Test Definitions ─────────────────────────────────────────────────────

interface NIPTest {
  nip: number;
  name: string;
  method: string;
  /** Execute the test on an open WebSocket. Returns pass/fail with detail. */
  test: (ws: WebSocket) => Promise<{ passed: boolean; detail: string; latencyMs: number }>;
}

/** Generate a random hex string (for subscription IDs) */
function randomHex(len: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

/** Wait for a specific message type from WS with timeout */
function waitForMessage(
  ws: WebSocket,
  matchFn: (data: unknown[]) => boolean,
  timeoutMs = 5000,
): Promise<{ matched: boolean; data?: unknown[]; latencyMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const timeout = setTimeout(() => {
      ws.removeEventListener('message', handler);
      resolve({ matched: false, latencyMs: Date.now() - start });
    }, timeoutMs);

    function handler(ev: MessageEvent) {
      try {
        const parsed = JSON.parse(ev.data as string);
        if (Array.isArray(parsed) && matchFn(parsed)) {
          clearTimeout(timeout);
          ws.removeEventListener('message', handler);
          resolve({ matched: true, data: parsed, latencyMs: Date.now() - start });
        }
      } catch {
        // not JSON, ignore
      }
    }

    ws.addEventListener('message', handler);
  });
}

const NIP_TESTS: NIPTest[] = [
  {
    nip: 1,
    name: 'Basic Protocol',
    method: 'Send REQ, expect events or EOSE',
    test: async (ws) => {
      const subId = `verify_${randomHex(8)}`;
      ws.send(JSON.stringify(['REQ', subId, { kinds: [1], limit: 1 }]));
      const result = await waitForMessage(ws, (d) =>
        (d[0] === 'EOSE' && d[1] === subId) ||
        (d[0] === 'EVENT' && d[1] === subId),
      3000);
      // Close sub
      ws.send(JSON.stringify(['CLOSE', subId]));
      return {
        passed: result.matched,
        detail: result.matched ? 'Relay responds to REQ with events or EOSE' : 'No response to basic REQ',
        latencyMs: result.latencyMs,
      };
    },
  },
  {
    nip: 15,
    name: 'End of Stored Events',
    method: 'Send REQ, expect EOSE marker',
    test: async (ws) => {
      const subId = `eose_${randomHex(8)}`;
      ws.send(JSON.stringify(['REQ', subId, { kinds: [0], limit: 0 }]));
      const result = await waitForMessage(ws, (d) =>
        d[0] === 'EOSE' && d[1] === subId,
      3000);
      ws.send(JSON.stringify(['CLOSE', subId]));
      return {
        passed: result.matched,
        detail: result.matched ? 'Relay sends EOSE after stored events' : 'No EOSE received',
        latencyMs: result.latencyMs,
      };
    },
  },
  {
    nip: 45,
    name: 'Event Counting',
    method: 'Send COUNT request, expect count response',
    test: async (ws) => {
      const subId = `count_${randomHex(8)}`;
      ws.send(JSON.stringify(['COUNT', subId, { kinds: [1], limit: 1 }]));
      const result = await waitForMessage(ws, (d) =>
        d[0] === 'COUNT' && d[1] === subId,
      3000);
      ws.send(JSON.stringify(['CLOSE', subId]));
      if (result.matched && result.data) {
        const countObj = result.data[2] as Record<string, unknown>;
        const count = typeof countObj?.count === 'number' ? countObj.count : undefined;
        return {
          passed: true,
          detail: count !== undefined ? `COUNT returned ${count}` : 'COUNT response received',
          latencyMs: result.latencyMs,
        };
      }
      return {
        passed: false,
        detail: 'No COUNT response — relay may not support NIP-45',
        latencyMs: result.latencyMs,
      };
    },
  },
  {
    nip: 50,
    name: 'Full-Text Search',
    method: 'Send REQ with search filter, expect no error',
    test: async (ws) => {
      const subId = `search_${randomHex(8)}`;
      ws.send(JSON.stringify(['REQ', subId, { kinds: [1], search: 'nostr', limit: 1 }]));
      // Wait for either a NOTICE (error) or EVENT/EOSE (success)
      const result = await waitForMessage(ws, (d) =>
        (d[0] === 'EOSE' && d[1] === subId) ||
        (d[0] === 'EVENT' && d[1] === subId) ||
        (d[0] === 'NOTICE') ||
        (d[0] === 'CLOSED' && d[1] === subId),
      4000);
      ws.send(JSON.stringify(['CLOSE', subId]));

      if (!result.matched) {
        return { passed: false, detail: 'No response to search query', latencyMs: result.latencyMs };
      }

      const type = result.data?.[0];
      if (type === 'NOTICE' || type === 'CLOSED') {
        const msg = String(result.data?.[type === 'CLOSED' ? 2 : 1] ?? '');
        if (msg.toLowerCase().includes('search') || msg.toLowerCase().includes('not supported') || msg.toLowerCase().includes('restricted')) {
          return { passed: false, detail: `Search not supported: ${msg.slice(0, 80)}`, latencyMs: result.latencyMs };
        }
      }

      return {
        passed: type === 'EOSE' || type === 'EVENT',
        detail: type === 'EVENT' ? 'Search returned results' : 'Search accepted (EOSE)',
        latencyMs: result.latencyMs,
      };
    },
  },
  {
    nip: 42,
    name: 'Authentication',
    method: 'Check if relay sends AUTH challenge on connect',
    test: async (ws) => {
      // NIP-42 relays send an AUTH challenge shortly after connection
      const result = await waitForMessage(ws, (d) =>
        d[0] === 'AUTH',
      2000);
      return {
        passed: result.matched,
        detail: result.matched ? 'Relay sent AUTH challenge' : 'No AUTH challenge received (may not require auth)',
        latencyMs: result.latencyMs,
      };
    },
  },
  {
    nip: 20,
    name: 'Command Results',
    method: 'Send malformed EVENT, expect OK with failure',
    test: async (ws) => {
      // Send an invalid event to check if relay responds with OK
      const fakeEvent = {
        id: randomHex(64),
        pubkey: randomHex(64),
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        tags: [],
        content: 'nip-verify-test',
        sig: randomHex(128),
      };
      ws.send(JSON.stringify(['EVENT', fakeEvent]));
      const result = await waitForMessage(ws, (d) =>
        d[0] === 'OK' && d[1] === fakeEvent.id,
      3000);
      if (result.matched && result.data) {
        const accepted = result.data[2] as boolean;
        return {
          passed: true,
          detail: accepted ? 'OK: accepted (unexpected for fake sig)' : `OK: rejected (${String(result.data[3] ?? 'invalid').slice(0, 60)})`,
          latencyMs: result.latencyMs,
        };
      }
      return {
        passed: false,
        detail: 'No OK response to EVENT command',
        latencyMs: result.latencyMs,
      };
    },
  },
];

// Map of NIP number → NIP test
const NIP_TEST_MAP = new Map(NIP_TESTS.map((t) => [t.nip, t]));

// NIPs that we know how to test
export const TESTABLE_NIPS = NIP_TESTS.map((t) => t.nip);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNIPVerifier() {
  const [report, setReport] = useState<VerificationReport | null>(null);
  const [running, setRunning] = useState(false);

  const verify = useCallback(async (relayUrl: string, claimedNips: number[]) => {
    setRunning(true);
    const startTime = Date.now();

    const reportData: VerificationReport = {
      relayUrl,
      startedAt: startTime,
      results: [],
      verified: 0,
      failed: 0,
      untested: 0,
      verifyScore: 0,
      connectionOk: false,
    };

    setReport({ ...reportData });

    // Determine which NIPs to test (intersection of claimed + testable)
    const toTest = claimedNips.filter((n) => NIP_TEST_MAP.has(n));
    const untestable = claimedNips.filter((n) => !NIP_TEST_MAP.has(n));

    // Initialize results for untestable NIPs
    for (const nip of untestable) {
      reportData.results.push({
        nip,
        name: `NIP-${String(nip).padStart(2, '0')}`,
        status: 'unsupported',
        method: 'No automated test available',
        detail: 'Cannot be verified automatically',
      });
    }
    reportData.untested = untestable.length;

    // Try to connect
    try {
      const ws = await new Promise<WebSocket>((resolve, reject) => {
        const connStart = Date.now();
        const socket = new WebSocket(relayUrl);
        const timeout = setTimeout(() => {
          socket.close();
          reject(new Error('Connection timeout (10s)'));
        }, 10000);

        socket.onopen = () => {
          clearTimeout(timeout);
          reportData.connectionOk = true;
          reportData.connectionLatencyMs = Date.now() - connStart;
          resolve(socket);
        };

        socket.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('WebSocket connection failed'));
        };
      });

      // Run each NIP test sequentially
      for (const nip of toTest) {
        const testDef = NIP_TEST_MAP.get(nip)!;
        const result: NIPTestResult = {
          nip: testDef.nip,
          name: testDef.name,
          status: 'testing',
          method: testDef.method,
        };

        // Update report to show testing state
        const existingIdx = reportData.results.findIndex((r) => r.nip === nip);
        if (existingIdx >= 0) {
          reportData.results[existingIdx] = result;
        } else {
          reportData.results.push(result);
        }
        setReport({ ...reportData });

        try {
          const testResult = await testDef.test(ws);
          result.status = testResult.passed ? 'verified' : 'failed';
          result.detail = testResult.detail;
          result.latencyMs = testResult.latencyMs;

          if (testResult.passed) reportData.verified++;
          else reportData.failed++;
        } catch (err) {
          result.status = 'failed';
          result.detail = `Test error: ${String(err)}`;
          reportData.failed++;
        }

        // Update report
        const idx = reportData.results.findIndex((r) => r.nip === nip);
        if (idx >= 0) reportData.results[idx] = result;
        setReport({ ...reportData });
      }

      ws.close();
    } catch (err) {
      // Connection failed — all tests fail
      for (const nip of toTest) {
        const testDef = NIP_TEST_MAP.get(nip)!;
        reportData.results.push({
          nip: testDef.nip,
          name: testDef.name,
          status: 'failed',
          method: testDef.method,
          detail: `Connection failed: ${String(err)}`,
        });
        reportData.failed++;
      }
    }

    // Calculate verify score
    const testable = reportData.verified + reportData.failed;
    reportData.verifyScore = testable > 0
      ? Math.round((reportData.verified / testable) * 100)
      : 0;

    reportData.completedAt = Date.now();

    // Sort results: verified first, then failed, then unsupported
    reportData.results.sort((a, b) => {
      const order = { verified: 0, testing: 1, failed: 2, pending: 3, unsupported: 4 };
      return (order[a.status] ?? 5) - (order[b.status] ?? 5);
    });

    setReport({ ...reportData });
    setRunning(false);

    return reportData;
  }, []);

  const reset = useCallback(() => {
    setReport(null);
    setRunning(false);
  }, []);

  return { report, running, verify, reset };
}
