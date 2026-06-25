/**
 * Live Relay Store
 *
 * Centralized reactive store that merges all data sources into a single
 * enriched relay list with live updates:
 *
 * 1. Seed data (hardcoded, highest trust)
 * 2. Nostr directory (kind:30078 user-submitted relays)
 * 3. NIP-66 monitor feed (kind:30166 real-time liveness)
 * 4. NIP-11 batch fetcher (HTTP NIP-11 documents)
 *
 * Produces enriched RelayRecords with live fields:
 * - liveOnline: actual current status from NIP-66
 * - liveLatencyMs: real RTT from NIP-66 or NIP-11 probe
 * - liveLastSeen: when the relay was last seen online
 * - nip11Fresh: NIP-11 freshness indicator
 * - nipsChanged: NIP support diff since last check
 */

import { useMemo } from 'react';
import type { RelayRecord, NIP66Data, NIP11Info } from '@/types/relay';
import { useRelayData } from '@/hooks/useRelayData';
import { useNIP66Monitor, type NIP66MonitorEvent } from '@/hooks/useNIP66Monitor';
import { useNIP11Batch, type NIP11CacheEntry, type NIP11CacheMap } from '@/hooks/useNIP11Batch';

// ─── Extended relay record with live fields ────────────────────────────────

export interface LiveRelayRecord extends RelayRecord {
  /** Live online status from NIP-66 monitor */
  liveOnline?: boolean;
  /** Live latency from NIP-66 monitor (rtt-open in ms) */
  liveLatencyMs?: number;
  /** Live read RTT from NIP-66 monitor */
  liveRttRead?: number;
  /** Live write RTT from NIP-66 monitor */
  liveRttWrite?: number;
  /** When the relay was last seen by a monitor (unix ms) */
  liveLastSeen?: number;
  /** NIP-11 cache entry with freshness info */
  nip11Cache?: NIP11CacheEntry;
  /** Live NIP-11 data (from batch fetcher, more recent than seed) */
  liveNip11?: NIP11Info;
  /** NIPs added since last check */
  nipsAdded?: number[];
  /** NIPs removed since last check */
  nipsRemoved?: number[];
  /** Whether NIP-11 recently changed */
  nip11Changed?: boolean;
  /** Geohash from NIP-66 monitor */
  geohash?: string;
  /** Relay type from NIP-66 (e.g. PrivateInbox, PublicOutbox) */
  relayTypeNIP66?: string;
  /** Network type from NIP-66 (clearnet, tor, etc) */
  networkType?: string;
  /** Monitor-reported requirements */
  monitorRequirements?: {
    auth: boolean;
    payment: boolean;
    pow: boolean;
    writes: boolean;
  };
}

// ─── Live stats computed from the store ────────────────────────────────────

export interface LiveNetworkStats {
  totalRelays: number;
  onlineNow: number;
  offlineNow: number;
  avgLatencyMs: number;
  freeRelays: number;
  paidRelays: number;
  authRequired: number;
  powRequired: number;
  paymentRequired: number;
  nip50Search: number;
  nip57Zaps: number;
  nip17DMs: number;
  nip42Auth: number;
  blossomEnabled: number;
  nip66Enriched: number;
  lastUpdated: number;
}

/**
 * Merge NIP-66 monitor data into a relay record.
 */
function enrichWithNIP66(
  relay: RelayRecord,
  monitorEvent?: NIP66MonitorEvent
): Partial<LiveRelayRecord> {
  if (!monitorEvent) return {};

  return {
    liveOnline: true, // If we have a recent event, relay is online
    liveLatencyMs: monitorEvent.rttOpen,
    liveRttRead: monitorEvent.rttRead,
    liveRttWrite: monitorEvent.rttWrite,
    liveLastSeen: monitorEvent.checkedAt * 1000,
    geohash: monitorEvent.geohash,
    relayTypeNIP66: monitorEvent.relayType,
    networkType: monitorEvent.network,
    monitorRequirements: monitorEvent.requirements,
    // Update NIP-66 data on the record
    nip66: {
      enriched: true,
      lastMonitorEvent: monitorEvent.checkedAt * 1000,
      liveStatus: 'online',
      monitorLatencyMs: monitorEvent.rttOpen,
      monitorPubkey: monitorEvent.monitorPubkey,
      capabilities: {
        read: !monitorEvent.requirements || monitorEvent.requirements.writes,
        write: !monitorEvent.requirements || monitorEvent.requirements.writes,
        relay: true,
        blossom: monitorEvent.topics.includes('blossom'),
        hasNip11: !!monitorEvent.nip11,
      },
      conflictsWithNip11: relay.nip66?.conflictsWithNip11 ?? false,
      conflictDetail: relay.nip66?.conflictDetail,
      eventsPerDay: relay.nip66?.eventsPerDay,
      connectedUsers: relay.nip66?.connectedUsers,
    },
  };
}

/**
 * Merge NIP-11 batch data into a relay record.
 */
function enrichWithNIP11(
  _relay: RelayRecord,
  cacheEntry?: NIP11CacheEntry
): Partial<LiveRelayRecord> {
  if (!cacheEntry) return {};

  return {
    nip11Cache: cacheEntry,
    liveNip11: cacheEntry.info,
    nipsAdded: cacheEntry.nipsAdded,
    nipsRemoved: cacheEntry.nipsRemoved,
    nip11Changed: cacheEntry.changed,
  };
}

/**
 * Main live relay store hook.
 *
 * Merges all data sources and provides enriched relay records
 * with live status information.
 */
export function useLiveRelayStore() {
  const { relays: baseRelays, loading: baseLoading } = useRelayData();

  // Get relay URLs for NIP-11 batch fetching
  const relayUrls = useMemo(
    () => baseRelays.map((r) => r.url),
    [baseRelays]
  );

  // NIP-66 monitor subscription
  const { data: monitorMap, isLoading: monitorLoading } = useNIP66Monitor();

  // NIP-11 batch fetcher
  const { data: nip11Cache, isLoading: nip11Loading } = useNIP11Batch(relayUrls);

  // Merge all sources into enriched relay records
  const liveRelays = useMemo<LiveRelayRecord[]>(() => {
    if (!baseRelays.length) return [];

    return baseRelays.map((relay) => {
      const monitorEvent = monitorMap?.get(relay.url);
      const nip11Entry = nip11Cache?.get(relay.url);

      const nip66Enrichment = enrichWithNIP66(relay, monitorEvent);
      const nip11Enrichment = enrichWithNIP11(relay, nip11Entry);

      // Merge: seed data → NIP-66 → NIP-11 (later sources override)
      const live: LiveRelayRecord = {
        ...relay,
        ...nip66Enrichment,
        ...nip11Enrichment,
      };

      // If we have live NIP-11 data, use its supported_nips for the record
      if (nip11Entry?.info.supported_nips) {
        live.nip11 = {
          ...relay.nip11,
          ...nip11Entry.info,
        };
      }

      // If NIP-66 says online, override seed isOnline
      if (nip66Enrichment.liveOnline !== undefined) {
        live.isOnline = nip66Enrichment.liveOnline;
      }

      // If we have live latency, use it
      if (nip66Enrichment.liveLatencyMs !== undefined) {
        live.avgLatencyMs = nip66Enrichment.liveLatencyMs;
      }

      // Update lastChecked from latest source
      if (nip11Entry?.fetchedAt) {
        live.lastChecked = Math.max(relay.lastChecked, nip11Entry.fetchedAt);
      }
      if (monitorEvent) {
        live.lastChecked = Math.max(live.lastChecked, monitorEvent.checkedAt * 1000);
      }

      return live;
    });
  }, [baseRelays, monitorMap, nip11Cache]);

  // Compute live network stats
  const stats = useMemo<LiveNetworkStats>(() => {
    const online = liveRelays.filter((r) => r.liveOnline ?? r.isOnline);
    const latencies = liveRelays
      .map((r) => r.liveLatencyMs ?? r.avgLatencyMs)
      .filter((l): l is number => l != null);
    const avgLat = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;

    const allNips = liveRelays.flatMap((r) => r.nip11.supported_nips ?? []);
    const nipCounts = (nip: number) =>
      liveRelays.filter((r) => (r.nip11.supported_nips ?? []).includes(nip)).length;

    return {
      totalRelays: liveRelays.length,
      onlineNow: online.length,
      offlineNow: liveRelays.length - online.length,
      avgLatencyMs: avgLat,
      freeRelays: liveRelays.filter((r) => r.isFree).length,
      paidRelays: liveRelays.filter((r) => !r.isFree).length,
      authRequired: liveRelays.filter((r) =>
        r.monitorRequirements?.auth || r.nip11.limitation?.auth_required
      ).length,
      powRequired: liveRelays.filter((r) =>
        r.monitorRequirements?.pow || (r.nip11.limitation?.min_pow_difficulty && r.nip11.limitation.min_pow_difficulty > 0)
      ).length,
      paymentRequired: liveRelays.filter((r) =>
        r.monitorRequirements?.payment || r.nip11.limitation?.payment_required
      ).length,
      nip50Search: nipCounts(50),
      nip57Zaps: nipCounts(57),
      nip17DMs: nipCounts(17),
      nip42Auth: nipCounts(42),
      blossomEnabled: liveRelays.filter((r) => r.blossomSupported).length,
      nip66Enriched: liveRelays.filter((r) => r.nip66?.enriched).length,
      lastUpdated: Date.now(),
    };
  }, [liveRelays]);

  const loading = baseLoading;
  const enriching = monitorLoading || nip11Loading;

  return {
    /** All relay records enriched with live data */
    relays: liveRelays,
    /** Live network statistics */
    stats,
    /** Whether initial relay data is loading */
    loading,
    /** Whether enrichment data (NIP-66, NIP-11) is still loading */
    enriching,
    /** NIP-11 cache map (for per-relay freshness info) */
    nip11Cache: nip11Cache ?? (new Map() as NIP11CacheMap),
    /** NIP-66 monitor map (for per-relay monitor data) */
    monitorMap: monitorMap ?? new Map(),
  };
}
