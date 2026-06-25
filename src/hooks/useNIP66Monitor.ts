/**
 * NIP-66 Live Monitor Subscription
 *
 * Subscribes to kind:30166 relay discovery events from trusted NIP-66 monitors.
 * Provides real-time relay liveness, RTT, NIP support, geohash, and capabilities
 * streamed directly from nostr.watch-style monitors.
 *
 * Uses a persistent subscription (via useQuery with a long staleTime) to
 * wss://relay.nostr.watch and other meta-relays.
 */

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import type { NIP11Info } from '@/types/relay';
import {
  KIND_RELAY_DISCOVERY,
  TRUSTED_MONITOR_PUBKEYS,
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
  /** Geohash from g tag */
  geohash?: string;
  /** Language tags */
  languages: string[];
  /** Topic tags */
  topics: string[];
  /** NIP-11 JSON parsed from content (if present) */
  nip11?: NIP11Info;
  /** Raw event for reference */
  rawEvent: NostrEvent;
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

  // Parse requirements from R tags
  const rTags = event.tags.filter(([t]) => t === 'R').map(([, v]) => v);
  const requirements = {
    auth: rTags.includes('auth') && !rTags.includes('!auth'),
    payment: rTags.includes('payment') && !rTags.includes('!payment'),
    pow: rTags.includes('pow') && !rTags.includes('!pow'),
    writes: !rTags.includes('!writes'),
  };

  // Parse geohash
  const geohash = event.tags.find(([t]) => t === 'g')?.[1];

  // Parse language tags
  const languages = event.tags
    .filter(([t]) => t === 'l')
    .map(([, v]) => v);

  // Parse topic tags
  const topics = event.tags
    .filter(([t]) => t === 't')
    .map(([, v]) => v);

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
    geohash,
    languages,
    topics,
    nip11,
    rawEvent: event,
  };
}

/** Map of relay URL → latest NIP66MonitorEvent */
export type NIP66MonitorMap = Map<string, NIP66MonitorEvent>;

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

      // Query from connected relays for recent monitor events
      const events = await nostr.query([
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
