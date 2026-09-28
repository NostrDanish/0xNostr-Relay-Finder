/**
 * NIP-66 publisher — 0xRelayFinder's own monitor.
 *
 * When RELAYMON_NSEC is configured, the crawler publishes its direct-probe
 * results as signed kind:30166 relay discovery events (NIP-66) to the
 * NIP-66 meta-relays. This makes the project a first-class monitor on the
 * network, not just a consumer.
 */

import WebSocket from 'ws';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import { hexToBytes } from 'nostr-tools/utils';

import type { ProbeResult } from './net';
import type { SnapshotRelayState } from '../../src/lib/snapshot/types';

export interface PublishReport {
  attempted: number;
  succeeded: number;
  failed: number;
  errors: string[];
  pubkey: string;
}

const KIND_RELAY_DISCOVERY = 30166;

/** Build an unsigned kind:30166 event template for one probed relay. */
export function build30166(
  probe: ProbeResult,
  state: SnapshotRelayState | undefined,
  nowS: number,
): { kind: number; created_at: number; tags: string[][]; content: string } {
  const tags: string[][] = [
    ['d', probe.url],
    ['n', state?.network ?? 'clearnet'],
    ['R', probe.online ? 'open' : '!open'],
  ];

  if (probe.online && probe.rttOpen != null) {
    tags.push(['rtt-open', String(Math.round(probe.rttOpen))]);
  }

  const nip11 = probe.nip11 ?? state?.nip11;
  const nips = nip11?.supported_nips ?? state?.nips ?? [];
  for (const nip of [...new Set(nips)].sort((a, b) => a - b)) {
    tags.push(['N', String(nip)]);
  }

  const requirements = state?.requirements;
  if (requirements) {
    for (const key of ['auth', 'payment', 'pow'] as const) {
      tags.push(['R', requirements[key] ? key : `!${key}`]);
    }
    if (requirements.writes != null) {
      tags.push(['R', requirements.writes ? 'writes' : '!writes']);
    }
  }

  const software = nip11?.software ?? state?.software;
  if (software) tags.push(['s', software]);
  const geohash = state?.geohash;
  if (geohash) tags.push(['g', geohash]);
  const relayType = state?.relayType;
  if (relayType) tags.push(['T', relayType]);
  if (nip11?.pubkey) tags.push(['p', nip11.pubkey]);

  tags.push(['client', '0xrelayfinder-crawler']);
  tags.push(['alt', `Relay discovery observation for ${probe.url} by 0xRelayFinder monitor`]);

  return {
    kind: KIND_RELAY_DISCOVERY,
    created_at: nowS,
    tags,
    content: nip11 && probe.online ? JSON.stringify(nip11) : '',
  };
}

/** Publish one signed event to a relay, waiting for OK. Never throws. */
function publishToRelay(
  relayUrl: string,
  event: Record<string, unknown>,
  timeoutMs = 8_000,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (error?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* noop */ }
      resolve(error);
    };
    let ws: WebSocket;
    try {
      ws = new WebSocket(relayUrl, { handshakeTimeout: timeoutMs });
    } catch (err) {
      resolve(String(err));
      return;
    }
    const timer = setTimeout(() => finish('timeout'), timeoutMs);
    ws.on('open', () => ws.send(JSON.stringify(['EVENT', event])));
    ws.on('message', (data: WebSocket.RawData) => {
      let msg: unknown[];
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (Array.isArray(msg) && msg[0] === 'OK' && msg[1] === event.id) {
        finish(msg[2] === true ? undefined : `rejected: ${msg[3] ?? 'unknown'}`);
      }
    });
    ws.on('error', (err) => finish(err.message));
    ws.on('close', () => finish('connection closed'));
  });
}

/**
 * Publish probe results as kind:30166 to the given relays.
 * Returns a report — never throws.
 */
export async function publishObservations(
  probes: ProbeResult[],
  states: Map<string, SnapshotRelayState>,
  targetRelays: string[],
  nsecHex: string,
  nowS: number,
  log: (msg: string) => void = console.log,
): Promise<PublishReport> {
  const report: PublishReport = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
    pubkey: getPublicKey(hexToBytes(nsecHex)),
  };
  const secretKey = hexToBytes(nsecHex);

  for (const probe of probes) {
    const template = build30166(probe, states.get(probe.url), nowS);
    let signed: Record<string, unknown>;
    try {
      signed = finalizeEvent(template, secretKey) as unknown as Record<string, unknown>;
    } catch (err) {
      report.errors.push(`sign ${probe.url}: ${String(err)}`);
      continue;
    }

    report.attempted += 1;
    const results = await Promise.all(targetRelays.map((url) => publishToRelay(url, signed)));
    const okCount = results.filter((r) => r === undefined).length;
    if (okCount > 0) {
      report.succeeded += 1;
    } else {
      report.failed += 1;
      report.errors.push(`${probe.url}: ${results.filter(Boolean).slice(0, 2).join('; ')}`);
    }
  }

  log(`publish: ${report.succeeded}/${report.attempted} observations accepted by at least one meta-relay`);
  return report;
}
