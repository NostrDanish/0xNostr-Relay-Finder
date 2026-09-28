/**
 * Shared NIP-66 parsing — framework-free.
 *
 * Single source of truth for parsing kind:30166 (relay discovery) and
 * kind:10166 (monitor announcement) events. Used by BOTH:
 *
 * 1. The frontend hooks (src/hooks/useNIP66Monitor.ts)
 * 2. The GitHub Actions crawler (scripts/crawl/) that builds the snapshot
 *
 * Nothing in this file may import React, Nostrify, or any browser-only API —
 * it must run identically in the browser and in Node (tsx).
 */

import type { NIP11Info } from '../types/relay';
import { normalizeRelayUrl } from './relayUrl';

/**
 * Minimal structural event type — compatible with Nostrify's NostrEvent,
 * nostr-tools' Event, and raw relay JSON. Avoids a hard dependency on any
 * client library so the crawler can use this module standalone.
 */
export interface NostrEventLike {
  id?: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig?: string;
}

/** Parse an integer tag value, guarding against NaN/garbage. */
export function parseIntTag(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Safely extract string values for a tag name — skips tags with missing
 * or non-string values (common in wild NIP-66 events from random monitors).
 */
export function tagValues(event: NostrEventLike, name: string): string[] {
  return event.tags
    .filter((tag) => tag[0] === name && typeof tag[1] === 'string' && tag[1].length > 0)
    .map((tag) => tag[1]);
}

/** Safely get the first string value of a tag. */
export function tagValue(event: NostrEventLike, name: string): string | undefined {
  return tagValues(event, name)[0];
}

// ─── NIP-66 parsed event data ─────────────────────────────────────────────
export interface NIP66Observation {
  /** Relay URL (from d-tag, normalized) */
  relayUrl: string;
  /** Monitor pubkey who published this */
  monitorPubkey: string;
  /** When the check was performed (unix seconds) */
  checkedAt: number;
  /** WebSocket open round-trip time in ms */
  rttOpen?: number;
  /** Read round-trip time in ms */
  rttRead?: number;
  /** Write round-trip time in ms */
  rttWrite?: number;
  /** Network type: clearnet, tor, i2p, loki */
  network?: string;
  /** Relay type: PrivateInbox, PublicOutbox, etc */
  relayType?: string;
  /** Supported NIP numbers from N tags */
  supportedNips: number[];
  /** Requirements from R tags: auth, payment, pow, writes.
   * `writes` is null when the monitor published no `writes`/`!writes` R tag
   * (absence means "unknown", not "writes allowed"). */
  requirements: { auth: boolean; payment: boolean; pow: boolean; writes: boolean | null };
  /** Capability checks from R tags: open/read/write/ssl pass/fail */
  checks: { open?: boolean; read?: boolean; write?: boolean; ssl?: boolean };
  /** Geohash from g tag (highest precision) */
  geohash?: string;
  /** All geohashes at all precisions */
  geohashes: string[];
  /** Language tags */
  languages: string[];
  /** Topic tags */
  topics: string[];
  /** Accepted event kinds (from k tags without ! prefix) */
  acceptedKinds: number[];
  /** Rejected event kinds (from k tags with ! prefix) */
  rejectedKinds: number[];
  /** Relay software (from s tag) */
  software?: string;
  /** Operator pubkey (from p tag) */
  operatorPubkey?: string;
  /** SSL certificate valid-until (unix seconds, if monitor reported) */
  sslValidTo?: number;
  /** SSL issuer */
  sslIssuer?: string;
  /** ISP name (from monitor dns/geo checks) */
  isp?: string;
  /** AS number */
  asNumber?: string;
  /** AS name */
  asName?: string;
  /** NIP-11 JSON parsed from content (if present) */
  nip11?: NIP11Info;
  /** Raw event for reference */
  rawEvent?: NostrEventLike;
}

// ─── Monitor announcement (kind:10166) ────────────────────────────────────
export interface MonitorAnnouncement {
  pubkey: string;
  /** Check frequency in seconds */
  frequency?: number;
  /** Check types performed (open, read, write, ssl, dns, geo, nip11, auth) */
  checks: string[];
  /** Timeout per check type */
  timeouts: Record<string, number>;
  /** Monitor's geohash */
  geohash?: string;
  /** Networks monitored */
  networks: string[];
  /** Kinds published by this monitor */
  publishedKinds: number[];
  /** Client identifier (e.g. @nostrwatch/relaymon) */
  client?: string;
  /** When announced */
  announcedAt: number;
  rawEvent?: NostrEventLike;
}

export function parseMonitorAnnouncement(event: NostrEventLike): MonitorAnnouncement | null {
  try {
    const checks = tagValues(event, 'c');
    const networks = tagValues(event, 'n');
    const publishedKinds = tagValues(event, 'k')
      .map((v) => parseInt(v))
      .filter((n) => !isNaN(n));

    const frequency = tagValue(event, 'frequency');
    const geohash = tagValue(event, 'g');
    const client = tagValue(event, 'client');

    const timeouts: Record<string, number> = {};
    for (const tag of event.tags) {
      if (tag[0] !== 'timeout') continue;
      const [, a, b] = tag;
      // ["timeout", "open", "5000"] or ["timeout", "5000", "open"]
      if (typeof a === 'string' && typeof b === 'string') {
        const aNum = parseIntTag(a);
        const bNum = parseIntTag(b);
        if (aNum === undefined && bNum !== undefined) timeouts[a] = bNum;
        else if (aNum !== undefined) timeouts[b] = aNum;
      } else if (typeof a === 'string') {
        const aNum = parseIntTag(a);
        if (aNum !== undefined) timeouts.all = aNum;
      }
    }

    return {
      pubkey: event.pubkey,
      frequency: parseIntTag(frequency),
      checks,
      timeouts,
      geohash,
      networks,
      publishedKinds,
      client,
      announcedAt: event.created_at,
      rawEvent: event,
    };
  } catch {
    return null;
  }
}

/**
 * Parse a kind:30166 event into a structured NIP66Observation.
 * Defensive: wild network data may contain malformed tags — never throw.
 */
export function parseNIP66Event(event: NostrEventLike): NIP66Observation | null {
  try {
    const dTag = tagValue(event, 'd');
    // Must be a real ws:// or wss:// URL (startsWith('ws') also matches 'wsx://…')
    const normalized = dTag ? normalizeRelayUrl(dTag) : null;
    if (!normalized) return null;

    // Parse RTT values
    const rttOpen = tagValue(event, 'rtt-open');
    const rttRead = tagValue(event, 'rtt-read');
    const rttWrite = tagValue(event, 'rtt-write');

    // Parse network/type
    const network = tagValue(event, 'n');
    const relayType = tagValue(event, 'T');

    // Parse supported NIPs from N tags
    const supportedNips = tagValues(event, 'N')
      .map((v) => parseInt(v))
      .filter((n) => !isNaN(n));

    // Parse R tags — both requirements and capability checks
    const rTags = tagValues(event, 'R');
    const rHas = (key: string) => rTags.includes(key) && !rTags.includes(`!${key}`);
    const requirements = {
      auth: rHas('auth'),
      payment: rHas('payment'),
      pow: rHas('pow'),
      // Absence of a writes/!writes R tag means "unknown" — not "writes allowed"
      writes: rTags.includes('!writes') ? false : rTags.includes('writes') ? true : null,
    };
    const checks: NIP66Observation['checks'] = {};
    if (rTags.includes('open') || rTags.includes('!open')) checks.open = rHas('open');
    if (rTags.includes('read') || rTags.includes('!read')) checks.read = rHas('read');
    if (rTags.includes('write') || rTags.includes('!write')) checks.write = rHas('write');
    if (rTags.includes('ssl') || rTags.includes('!ssl')) checks.ssl = rHas('ssl');

    // Parse geohashes (all precisions; keep longest as primary)
    const geohashes = tagValues(event, 'g');
    const geohash = [...geohashes].sort((a, b) => b.length - a.length)[0];

    // Parse language tags — only those with ISO-639-1 namespace or bare values
    const languages = event.tags
      .filter((tag) => tag[0] === 'l' && typeof tag[1] === 'string' && tag[1].length > 0 && (!tag[2] || tag[2] === 'ISO-639-1'))
      .map((tag) => tag[1]);

    // Parse topic tags
    const topics = tagValues(event, 't');

    // Parse accepted/rejected kinds from k tags
    const kTags = tagValues(event, 'k');
    const acceptedKinds = kTags
      .filter((v) => !v.startsWith('!'))
      .map((v) => parseInt(v))
      .filter((n) => !isNaN(n));
    const rejectedKinds = kTags
      .filter((v) => v.startsWith('!'))
      .map((v) => parseInt(v.slice(1)))
      .filter((n) => !isNaN(n));

    // Parse software, operator pubkey
    const software = tagValue(event, 's');
    const operatorPubkey = tagValue(event, 'p');

    // Parse SSL / ISP / AS fields (monitors that run ssl/dns/geo checks include these)
    const sslValidTo = tagValue(event, 'sslValidTo') ?? tagValue(event, 'ssl-valid-to');
    const sslIssuer = tagValue(event, 'sslIssuer') ?? tagValue(event, 'ssl-issuer');
    const isp = tagValue(event, 'isp');
    const asNumber = tagValue(event, 'as');
    const asName = tagValue(event, 'asname');

    // Try to parse NIP-11 from content
    let nip11: NIP11Info | undefined;
    if (event.content) {
      try {
        const parsed = JSON.parse(event.content);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          nip11 = parsed as NIP11Info;
        }
      } catch {
        // Content is not JSON, that's fine
      }
    }

    return {
      relayUrl: normalized,
      monitorPubkey: event.pubkey,
      checkedAt: event.created_at,
      rttOpen: parseIntTag(rttOpen),
      rttRead: parseIntTag(rttRead),
      rttWrite: parseIntTag(rttWrite),
      network,
      relayType,
      supportedNips,
      requirements,
      checks,
      geohash,
      geohashes,
      languages,
      topics,
      acceptedKinds,
      rejectedKinds,
      software,
      operatorPubkey,
      sslValidTo: parseIntTag(sslValidTo),
      sslIssuer,
      isp,
      asNumber,
      asName,
      nip11,
      rawEvent: event,
    };
  } catch {
    // Malformed event — skip it silently (wild monitor data)
    return null;
  }
}

/**
 * Decode a geohash to approximate lat/lng coordinates.
 * Precision depends on geohash length (longer = more precise).
 */
export function decodeGeohash(geohash: string): { lat: number; lng: number } | null {
  if (!geohash || geohash.length === 0) return null;

  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let isLng = true;
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;

  for (const char of geohash.toLowerCase()) {
    const idx = BASE32.indexOf(char);
    if (idx === -1) return null;

    for (let bit = 4; bit >= 0; bit--) {
      const bitValue = (idx >> bit) & 1;
      if (isLng) {
        const mid = (minLng + maxLng) / 2;
        if (bitValue === 1) minLng = mid;
        else maxLng = mid;
      } else {
        const mid = (minLat + maxLat) / 2;
        if (bitValue === 1) minLat = mid;
        else maxLat = mid;
      }
      isLng = !isLng;
    }
  }

  return {
    lat: (minLat + maxLat) / 2,
    lng: (minLng + maxLng) / 2,
  };
}
