/**
 * Crawler networking — raw Nostr WebSocket queries, NIP-11 HTTP fetches,
 * and direct relay probes. Runs in Node (GitHub Actions) using the `ws`
 * package. No Nostrify, no browser APIs.
 */

import WebSocket from 'ws';
import type { NostrEventLike } from '../../src/lib/nip66';
import { relayHttpUrl } from '../../src/lib/relayUrl';
import type { SnapshotNip11 } from '../../src/lib/snapshot/types';

export interface QueryResult {
  relay: string;
  events: NostrEventLike[];
  error?: string;
  durationMs: number;
}

/**
 * Query one relay with one filter, collecting events until EOSE or timeout.
 * Never throws — errors land on the result.
 */
export function queryRelay(
  relayUrl: string,
  filter: Record<string, unknown>,
  timeoutMs = 20_000,
): Promise<QueryResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const events: NostrEventLike[] = [];
    let done = false;
    const finish = (error?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* noop */ }
      resolve({ relay: relayUrl, events, error, durationMs: Date.now() - start });
    };

    let ws: WebSocket;
    try {
      ws = new WebSocket(relayUrl, { handshakeTimeout: Math.min(timeoutMs, 10_000) });
    } catch (err) {
      resolve({ relay: relayUrl, events, error: String(err), durationMs: Date.now() - start });
      return;
    }

    const timer = setTimeout(() => finish(events.length ? undefined : 'timeout'), timeoutMs);
    const subId = `crawl-${Math.random().toString(36).slice(2, 10)}`;

    ws.on('open', () => {
      ws.send(JSON.stringify(['REQ', subId, filter]));
    });
    ws.on('message', (data: WebSocket.RawData) => {
      let msg: unknown[];
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!Array.isArray(msg)) return;
      if (msg[0] === 'EVENT' && msg[1] === subId && msg[2] && typeof msg[2] === 'object') {
        events.push(msg[2] as NostrEventLike);
      } else if (msg[0] === 'EOSE' && msg[1] === subId) {
        finish();
      } else if (msg[0] === 'CLOSED' && msg[1] === subId) {
        finish(`closed: ${msg[2] ?? 'unknown'}`);
      } else if (msg[0] === 'NOTICE') {
        // ignore notices — some relays chatter
      }
    });
    ws.on('error', (err) => finish(err.message));
    ws.on('close', () => finish(events.length ? undefined : 'connection closed'));
  });
}

/**
 * Query several relays with the same filter, merging events (deduped by id).
 * Each relay result's error is tolerated — partial success is fine.
 */
export async function queryRelays(
  relayUrls: string[],
  filter: Record<string, unknown>,
  timeoutMs = 20_000,
): Promise<{ events: NostrEventLike[]; perRelay: QueryResult[] }> {
  const results = await Promise.all(relayUrls.map((url) => queryRelay(url, filter, timeoutMs)));
  const byId = new Map<string, NostrEventLike>();
  for (const result of results) {
    for (const event of result.events) {
      const key = event.id ?? `${event.pubkey}:${event.kind}:${event.created_at}:${event.content.length}`;
      if (!byId.has(key)) byId.set(key, event);
    }
  }
  return { events: [...byId.values()], perRelay: results };
}

/** Direct probe result for one relay. */
export interface ProbeResult {
  url: string;
  online: boolean;
  /** WebSocket open RTT in ms */
  rttOpen?: number;
  nip11?: SnapshotNip11;
  error?: string;
}

/** Trim a wild NIP-11 doc to the fields the snapshot keeps. */
export function trimNip11(raw: Record<string, unknown>): SnapshotNip11 {
  const str = (v: unknown) => (typeof v === 'string' ? v.slice(0, 500) : undefined);
  const nips = Array.isArray(raw.supported_nips)
    ? raw.supported_nips.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
    : undefined;
  const limitation = raw.limitation && typeof raw.limitation === 'object'
    ? (raw.limitation as Record<string, unknown>)
    : undefined;
  const strArr = (v: unknown) =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string').slice(0, 20) : undefined;

  return {
    name: str(raw.name),
    description: str(raw.description),
    pubkey: str(raw.pubkey),
    contact: str(raw.contact),
    software: str(raw.software),
    version: str(raw.version),
    supported_nips: nips,
    limitation: limitation
      ? {
          auth_required: limitation.auth_required === true ? true : undefined,
          payment_required: limitation.payment_required === true ? true : undefined,
          restricted_writes: limitation.restricted_writes === true ? true : undefined,
          min_pow_difficulty:
            typeof limitation.min_pow_difficulty === 'number' ? limitation.min_pow_difficulty : undefined,
        }
      : undefined,
    relay_countries: strArr(raw.relay_countries),
    language_tags: strArr(raw.language_tags),
    tags: strArr(raw.tags),
    payments_url: str(raw.payments_url),
    icon: str(raw.icon),
  };
}

/** Fetch a relay's NIP-11 document over HTTP(S). Never throws. */
export async function fetchNip11(relayUrl: string, timeoutMs = 8_000): Promise<SnapshotNip11 | undefined> {
  const httpUrl = relayHttpUrl(relayUrl);
  if (!httpUrl) return undefined;
  try {
    const res = await fetch(httpUrl, {
      headers: { Accept: 'application/nostr+json' },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    if (!res.ok) return undefined;
    const json = await res.json();
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      return trimNip11(json as Record<string, unknown>);
    }
  } catch {
    // offline / bad JSON / TLS — all fine, undefined means "no doc"
  }
  return undefined;
}

/**
 * Directly probe a relay: open a WebSocket (measuring RTT) and fetch its
 * NIP-11 doc in parallel. Never throws.
 */
export async function probeRelay(relayUrl: string, timeoutMs = 10_000): Promise<ProbeResult> {
  const start = Date.now();

  const wsProbe = new Promise<Pick<ProbeResult, 'online' | 'rttOpen' | 'error'>>((resolve) => {
    let done = false;
    const finish = (online: boolean, error?: string) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* noop */ }
      resolve({ online, rttOpen: online ? Date.now() - start : undefined, error });
    };
    let ws: WebSocket;
    try {
      ws = new WebSocket(relayUrl, { handshakeTimeout: timeoutMs });
    } catch (err) {
      resolve({ online: false, error: String(err) });
      return;
    }
    const timer = setTimeout(() => finish(false, 'timeout'), timeoutMs);
    ws.on('open', () => finish(true));
    ws.on('error', (err) => finish(false, err.message));
  });

  const [wsResult, nip11] = await Promise.all([wsProbe, fetchNip11(relayUrl, timeoutMs)]);
  return { url: relayUrl, ...wsResult, nip11 };
}

/** Run an async worker over items with bounded concurrency. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await worker(items[i]);
    }
  });
  await Promise.all(lanes);
  return results;
}
