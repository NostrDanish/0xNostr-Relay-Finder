/**
 * NIP-66 Live Monitor Subscription (v2 — nostr.watch-parity)
 *
 * Subscribes to kind:30166 relay discovery events from trusted NIP-66 monitors.
 * Provides real-time relay liveness, RTT, NIP support, geohash, and capabilities
 * streamed directly from nostr.watch-style monitors.
 *
 * v2 upgrades (learned from nostr.watch):
 * - Rich tag parsing: `k` (accepted/rejected kinds), `s` (software),
 *   `p` (operator pubkey), topics, language labels with namespaces,
 *   R-tag capabilities (open/read/write), SSL/ISP fields
 * - Multi-monitor support: keeps ALL monitor events per relay (not just latest)
 *   enabling consensus computation and per-monitor breakdown
 * - Monitor announcements (kind:10166) with check types and frequency
 */

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import type { NIP11Info } from '@/types/relay';
import {
  KIND_RELAY_DISCOVERY,
  KIND_MONITOR_ANNOUNCEMENT,
  TRUSTED_MONITOR_PUBKEYS,
  NIP66_DATA_RELAYS,
} from '@/lib/constants';

// ─── NIP-66 parsed event data ─────────────────────────────────────────────
export interface NIP66MonitorEvent {
  /** Relay URL (from d-tag) */
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
  /** Requirements from R tags: auth, payment, pow, writes */
  requirements: { auth: boolean; payment: boolean; pow: boolean; writes: boolean };
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
  rawEvent: NostrEvent;
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
  rawEvent: NostrEvent;
}

function parseMonitorAnnouncement(event: NostrEvent): MonitorAnnouncement | null {
  const checks = event.tags.filter(([t]) => t === 'c').map(([, v]) => v);
  const networks = event.tags.filter(([t]) => t === 'n').map(([, v]) => v);
  const publishedKinds = event.tags
    .filter(([t]) => t === 'k')
    .map(([, v]) => parseInt(v))
    .filter((n) => !isNaN(n));

  const frequency = event.tags.find(([t]) => t === 'frequency')?.[1];
  const geohash = event.tags.find(([t]) => t === 'g')?.[1];
  const client = event.tags.find(([t]) => t === 'client')?.[1];

  const timeouts: Record<string, number> = {};
  for (const tag of event.tags.filter(([t]) => t === 'timeout')) {
    // ["timeout", "open", "5000"] — index 1 = check type, index 2 = ms
    // (some monitors use ["timeout", "5000", "open"])
    const [, a, b] = tag;
    if (a && b) {
      if (isNaN(parseInt(a))) timeouts[a] = parseInt(b);
      else timeouts[b] = parseInt(a);
    } else if (a && !isNaN(parseInt(a))) {
      timeouts.all = parseInt(a);
    }
  }

  return {
    pubkey: event.pubkey,
    frequency: frequency ? parseInt(frequency) : undefined,
    checks,
    timeouts,
    geohash,
    networks,
    publishedKinds,
    client,
    announcedAt: event.created_at,
    rawEvent: event,
  };
}

/**
 * Parse a kind:30166 event into structured NIP66MonitorEvent
 */
function parseNIP66Event(event: NostrEvent): NIP66MonitorEvent | null {
  const dTag = event.tags.find(([t]) => t === 'd')?.[1];
  if (!dTag) return null;

  // Parse RTT values
  const rttOpen = event.tags.find(([t]) => t === 'rtt-open')?.[1];
  const rttRead = event.tags.find(([t]) => t === 'rtt-read')?.[1];
  const rttWrite = event.tags.find(([t]) => t === 'rtt-write')?.[1];

  // Parse network/type
  const network = event.tags.find(([t]) => t === 'n')?.[1];
  const relayType = event.tags.find(([t]) => t === 'T')?.[1];

  // Parse supported NIPs from N tags
  const supportedNips = event.tags
    .filter(([t]) => t === 'N')
    .map(([, v]) => parseInt(v))
    .filter((n) => !isNaN(n));

  // Parse R tags — both requirements and capability checks
  const rTags = event.tags.filter(([t]) => t === 'R').map(([, v]) => v);
  const rHas = (key: string) => rTags.includes(key) && !rTags.includes(`!${key}`);
  const requirements = {
    auth: rHas('auth'),
    payment: rHas('payment'),
    pow: rHas('pow'),
    writes: !rTags.includes('!writes'),
  };
  const checks: NIP66MonitorEvent['checks'] = {};
  if (rTags.includes('open') || rTags.includes('!open')) checks.open = rHas('open');
  if (rTags.includes('read') || rTags.includes('!read')) checks.read = rHas('read');
  if (rTags.includes('write') || rTags.includes('!write')) checks.write = rHas('write');
  if (rTags.includes('ssl') || rTags.includes('!ssl')) checks.ssl = rHas('ssl');

  // Parse geohashes (all precisions; keep longest as primary)
  const geohashes = event.tags.filter(([t]) => t === 'g').map(([, v]) => v);
  const geohash = geohashes.sort((a, b) => b.length - a.length)[0];

  // Parse language tags — only those with ISO-639-1 namespace or bare values
  const languages = event.tags
    .filter(([t, , ns]) => t === 'l' && (!ns || ns === 'ISO-639-1'))
    .map(([, v]) => v);

  // Parse topic tags
  const topics = event.tags
    .filter(([t]) => t === 't')
    .map(([, v]) => v);

  // Parse accepted/rejected kinds from k tags
  const kTags = event.tags.filter(([t]) => t === 'k').map(([, v]) => v);
  const acceptedKinds = kTags
    .filter((v) => !v.startsWith('!'))
    .map((v) => parseInt(v))
    .filter((n) => !isNaN(n));
  const rejectedKinds = kTags
    .filter((v) => v.startsWith('!'))
    .map((v) => parseInt(v.slice(1)))
    .filter((n) => !isNaN(n));

  // Parse software, operator pubkey
  const software = event.tags.find(([t]) => t === 's')?.[1];
  const operatorPubkey = event.tags.find(([t]) => t === 'p')?.[1];

  // Parse SSL / ISP / AS fields (monitors that run ssl/dns/geo checks include these)
  const sslValidTo = event.tags.find(([t]) => t === 'sslValidTo' || t === 'ssl-valid-to')?.[1];
  const sslIssuer = event.tags.find(([t]) => t === 'sslIssuer' || t === 'ssl-issuer')?.[1];
  const isp = event.tags.find(([t]) => t === 'isp')?.[1];
  const asNumber = event.tags.find(([t]) => t === 'as')?.[1];
  const asName = event.tags.find(([t]) => t === 'asname')?.[1];

  // Try to parse NIP-11 from content
  let nip11: NIP11Info | undefined;
  if (event.content) {
    try {
      nip11 = JSON.parse(event.content) as NIP11Info;
    } catch {
      // Content is not JSON, that's fine
    }
  }

  return {
    relayUrl: dTag,
    monitorPubkey: event.pubkey,
    checkedAt: event.created_at,
    rttOpen: rttOpen ? parseInt(rttOpen) : undefined,
    rttRead: rttRead ? parseInt(rttRead) : undefined,
    rttWrite: rttWrite ? parseInt(rttWrite) : undefined,
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
    sslValidTo: sslValidTo ? parseInt(sslValidTo) : undefined,
    sslIssuer,
    isp,
    asNumber,
    asName,
    nip11,
    rawEvent: event,
  };
}

/** Map of relay URL → latest NIP66MonitorEvent (best across monitors) */
export type NIP66MonitorMap = Map<string, NIP66MonitorEvent>;

/** Map of relay URL → Map of monitorPubkey → that monitor's latest event */
export type NIP66MultiMonitorMap = Map<string, Map<string, NIP66MonitorEvent>>;

/**
 * Subscribe to NIP-66 monitor events and build a live map of relay health.
 *
 * Queries recent kind:30166 events from trusted monitors and returns
 * a Map keyed by relay URL with the latest health data.
 */
export function useNIP66Monitor() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nip66-monitor-feed'],
    queryFn: async (): Promise<NIP66MonitorMap> => {
      const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;

      // Query the NIP-66 data relay group (meta-relays first — richest data)
      const relayGroup = nostr.group(NIP66_DATA_RELAYS);
      const events = await relayGroup.query([
        {
          kinds: [KIND_RELAY_DISCOVERY],
          authors: TRUSTED_MONITOR_PUBKEYS,
          since: twoHoursAgo,
          limit: 500,
        },
      ]);

      const monitorMap: NIP66MonitorMap = new Map();

      for (const event of events) {
        const parsed = parseNIP66Event(event);
        if (!parsed) continue;

        // Keep only the latest event per relay URL
        const existing = monitorMap.get(parsed.relayUrl);
        if (!existing || parsed.checkedAt > existing.checkedAt) {
          monitorMap.set(parsed.relayUrl, parsed);
        }
      }

      return monitorMap;
    },
    staleTime: 1000 * 60 * 2,  // 2 minutes
    gcTime: 1000 * 60 * 30,
    refetchInterval: 1000 * 60 * 2, // Auto-refetch every 2 minutes for live updates
    retry: 2,
    retryDelay: 3000,
  });
}

/**
 * Subscribe to NIP-66 events keeping ALL monitors per relay.
 * Enables multi-monitor consensus: "online per 3/4 monitors".
 */
export function useNIP66MultiMonitor() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nip66-multi-monitor-feed'],
    queryFn: async (): Promise<NIP66MultiMonitorMap> => {
      const sixHoursAgo = Math.floor(Date.now() / 1000) - 21600;

      const relayGroup = nostr.group(NIP66_DATA_RELAYS);
      const events = await relayGroup.query([
        {
          kinds: [KIND_RELAY_DISCOVERY],
          authors: TRUSTED_MONITOR_PUBKEYS,
          since: sixHoursAgo,
          limit: 1000,
        },
      ]);

      const multiMap: NIP66MultiMonitorMap = new Map();

      for (const event of events) {
        const parsed = parseNIP66Event(event);
        if (!parsed) continue;

        let relayMap = multiMap.get(parsed.relayUrl);
        if (!relayMap) {
          relayMap = new Map();
          multiMap.set(parsed.relayUrl, relayMap);
        }

        // Keep latest event per (relay, monitor) pair
        const existing = relayMap.get(parsed.monitorPubkey);
        if (!existing || parsed.checkedAt > existing.checkedAt) {
          relayMap.set(parsed.monitorPubkey, parsed);
        }
      }

      return multiMap;
    },
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
    refetchInterval: 1000 * 60 * 2,
    retry: 2,
    retryDelay: 3000,
  });
}

/**
 * Fetch kind:10166 monitor announcements — which monitors are active,
 * what checks they run, and how often.
 */
export function useMonitorAnnouncements() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nip66-monitor-announcements'],
    queryFn: async (): Promise<MonitorAnnouncement[]> => {
      const relayGroup = nostr.group(NIP66_DATA_RELAYS);
      const events = await relayGroup.query([
        {
          kinds: [KIND_MONITOR_ANNOUNCEMENT],
          limit: 100,
        },
      ]);

      // Keep latest per monitor pubkey
      const byPubkey = new Map<string, MonitorAnnouncement>();
      for (const event of events) {
        const parsed = parseMonitorAnnouncement(event);
        if (!parsed) continue;
        const existing = byPubkey.get(parsed.pubkey);
        if (!existing || parsed.announcedAt > existing.announcedAt) {
          byPubkey.set(parsed.pubkey, parsed);
        }
      }

      return Array.from(byPubkey.values()).sort((a, b) => b.announcedAt - a.announcedAt);
    },
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 60,
    retry: 2,
  });
}

/**
 * Discovery feed: query kind:30166 from ALL monitors (no author filter).
 * Every `d` tag is a relay URL that some monitor on the network has found
 * and health-checked. This is how nostr.watch itself builds its directory —
 * and it's the richest relay discovery source that exists on Nostr.
 *
 * Returns both the relay URLs AND their full observation data (RTT, NIPs,
 * geohash, requirements) so discovered relays can be imported with
 * real health data attached.
 */
export function useNIP66DiscoveryFeed(limit = 2000) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['nip66-discovery-feed', limit],
    queryFn: async (): Promise<NIP66MultiMonitorMap> => {
      const threeDaysAgo = Math.floor(Date.now() / 1000) - 3 * 86400;

      const relayGroup = nostr.group(NIP66_DATA_RELAYS);
      const events = await relayGroup.query([
        {
          kinds: [KIND_RELAY_DISCOVERY],
          since: threeDaysAgo,
          limit,
        },
      ]);

      const multiMap: NIP66MultiMonitorMap = new Map();

      for (const event of events) {
        const parsed = parseNIP66Event(event);
        if (!parsed) continue;

        let relayMap = multiMap.get(parsed.relayUrl);
        if (!relayMap) {
          relayMap = new Map();
          multiMap.set(parsed.relayUrl, relayMap);
        }

        const existing = relayMap.get(parsed.monitorPubkey);
        if (!existing || parsed.checkedAt > existing.checkedAt) {
          relayMap.set(parsed.monitorPubkey, parsed);
        }
      }

      return multiMap;
    },
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60,
    retry: 2,
  });
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
