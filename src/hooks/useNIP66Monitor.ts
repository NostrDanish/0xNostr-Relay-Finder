/**
 * NIP-66 Live Monitor Subscription (v2 — nostr.watch-parity)
 *
 * Subscribes to kind:30166 relay discovery events from trusted NIP-66 monitors.
 * Provides real-time relay liveness, RTT, NIP support, geohash, and capabilities
 * streamed directly from nostr.watch-style monitors.
 *
 * Parsing lives in the framework-free shared module `@/lib/nip66` so the
 * GitHub Actions crawler (scripts/crawl) uses byte-for-byte the same logic.
 */

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  parseNIP66Event,
  parseMonitorAnnouncement,
  type NIP66Observation,
  type MonitorAnnouncement,
} from '@/lib/nip66';
import {
  KIND_RELAY_DISCOVERY,
  KIND_MONITOR_ANNOUNCEMENT,
  TRUSTED_MONITOR_PUBKEYS,
  NIP66_DATA_RELAYS,
} from '@/lib/constants';

// ─── Backwards-compatible type aliases ────────────────────────────────────
/** @deprecated Use NIP66Observation from '@/lib/nip66' — kept as alias. */
export type NIP66MonitorEvent = NIP66Observation;
export type { MonitorAnnouncement };

// Re-export shared helpers so existing imports keep working.
export { parseNIP66Event, parseMonitorAnnouncement, decodeGeohash } from '@/lib/nip66';

/** Map of relay URL → latest NIP66MonitorEvent (best across monitors) */
export type NIP66MonitorMap = Map<string, NIP66Observation>;

/** Map of relay URL → Map of monitorPubkey → that monitor's latest event */
export type NIP66MultiMonitorMap = Map<string, Map<string, NIP66Observation>>;

function asEvent(e: NostrEvent): Parameters<typeof parseNIP66Event>[0] {
  return e;
}

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
      const events = await relayGroup.query(
        [
          {
            kinds: [KIND_RELAY_DISCOVERY],
            authors: TRUSTED_MONITOR_PUBKEYS,
            since: twoHoursAgo,
            limit: 500,
          },
        ],
        { signal: AbortSignal.timeout(15_000) },
      );

      const monitorMap: NIP66MonitorMap = new Map();

      for (const event of events) {
        const parsed = parseNIP66Event(asEvent(event));
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
      const events = await relayGroup.query(
        [
          {
            kinds: [KIND_RELAY_DISCOVERY],
            authors: TRUSTED_MONITOR_PUBKEYS,
            since: sixHoursAgo,
            limit: 1000,
          },
        ],
        { signal: AbortSignal.timeout(15_000) },
      );

      const multiMap: NIP66MultiMonitorMap = new Map();

      for (const event of events) {
        const parsed = parseNIP66Event(asEvent(event));
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
      const events = await relayGroup.query(
        [
          {
            kinds: [KIND_MONITOR_ANNOUNCEMENT],
            limit: 100,
          },
        ],
        { signal: AbortSignal.timeout(15_000) },
      );

      // Keep latest per monitor pubkey
      const byPubkey = new Map<string, MonitorAnnouncement>();
      for (const event of events) {
        const parsed = parseMonitorAnnouncement(asEvent(event));
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
      const events = await relayGroup.query(
        [
          {
            kinds: [KIND_RELAY_DISCOVERY],
            since: threeDaysAgo,
            limit,
          },
        ],
        { signal: AbortSignal.timeout(20_000) },
      );

      const multiMap: NIP66MultiMonitorMap = new Map();

      for (const event of events) {
        const parsed = parseNIP66Event(asEvent(event));
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
