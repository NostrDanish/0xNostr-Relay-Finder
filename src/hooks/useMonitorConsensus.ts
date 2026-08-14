/**
 * Multi-Monitor Consensus & Relay History (nostr.watch-parity)
 *
 * Aggregates NIP-66 observations from ALL trusted monitors per relay:
 *
 * - Consensus status: "online per 3/4 monitors" (quorum-based)
 * - Median RTT across monitors (robust against outliers)
 * - Per-monitor breakdown table
 * - Real uptime % computed from historical kind:30166 events
 * - Tri-state liveness: online / offline / dead (from monitor recency)
 * - Speed groups: percentile buckets across the whole network
 *   (Lightning Fast ≤20th pct, Swift ≤40th, Mid ≤60th, Leisurely ≤80th, Glacial >80th)
 * - Peer percentile insights: "faster than 87% of relays"
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import {
  useNIP66MultiMonitor,
  type NIP66MonitorEvent,
  type NIP66MultiMonitorMap,
} from '@/hooks/useNIP66Monitor';
import { KIND_RELAY_DISCOVERY, TRUSTED_MONITOR_PUBKEYS } from '@/lib/constants';
import type { LiveRelayRecord } from '@/hooks/useLiveRelayStore';

// ─── Tri-state liveness ─────────────────────────────────────────────────────

export type LivenessState = 'online' | 'offline' | 'dead';

/** Seconds after last successful check before a relay is considered offline */
const OFFLINE_AFTER_S = 3 * 3600; // 3h
/** Seconds after last sighting before a relay is considered dead */
const DEAD_AFTER_S = 7 * 24 * 3600; // 7 days

/**
 * Classify a relay's liveness from the most recent monitor observation.
 * Mirrors nostr.watch's online/offline/dead thresholds.
 */
export function classifyLiveness(checkedAtSeconds?: number, nowSeconds = Math.floor(Date.now() / 1000)): LivenessState {
  if (!checkedAtSeconds) return 'dead';
  const age = nowSeconds - checkedAtSeconds;
  if (age <= OFFLINE_AFTER_S) return 'online';
  if (age <= DEAD_AFTER_S) return 'offline';
  return 'dead';
}

// ─── Consensus types ────────────────────────────────────────────────────────

export interface MonitorObservation {
  monitorPubkey: string;
  checkedAt: number;
  online: boolean;
  rttOpen?: number;
  rttRead?: number;
  rttWrite?: number;
  event: NIP66MonitorEvent;
}

export interface RelayConsensus {
  relayUrl: string;
  /** Number of monitors that saw this relay recently */
  monitorCount: number;
  /** Number of monitors reporting it online */
  onlineCount: number;
  /** Consensus status: online if >= 50% of monitors agree */
  online: boolean;
  /** Agreement ratio 0-1 */
  agreement: number;
  /** Median RTT open across monitors (outlier-resistant) */
  medianRttOpen?: number;
  /** Median RTT read across monitors */
  medianRttRead?: number;
  /** Median RTT write across monitors */
  medianRttWrite?: number;
  /** Most recent observation timestamp */
  lastSeenAt: number;
  /** Tri-state liveness from recency */
  liveness: LivenessState;
  /** Per-monitor observations, newest first */
  observations: MonitorObservation[];
  /** Merged supported NIPs (union across monitors) */
  supportedNips: number[];
  /** Merged accepted kinds */
  acceptedKinds: number[];
  /** Best geohash (longest precision from any monitor) */
  geohash?: string;
  /** Topics (union) */
  topics: string[];
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

/**
 * Compute consensus for one relay from its multi-monitor observations.
 */
export function computeConsensus(
  relayUrl: string,
  monitorMap: Map<string, NIP66MonitorEvent>,
): RelayConsensus {
  const observations: MonitorObservation[] = Array.from(monitorMap.values())
    .map((event) => ({
      monitorPubkey: event.monitorPubkey,
      checkedAt: event.checkedAt,
      // A relay is "online" per this monitor if the event exists and is recent
      // (monitors only publish 30166 for relays they could reach, per NIP-66)
      online: true,
      rttOpen: event.rttOpen,
      rttRead: event.rttRead,
      rttWrite: event.rttWrite,
      event,
    }))
    .sort((a, b) => b.checkedAt - a.checkedAt);

  const monitorCount = observations.length;
  const lastSeenAt = observations[0]?.checkedAt ?? 0;

  // A monitor's observation only counts as "online" if it's fresh (< 3h old)
  const now = Math.floor(Date.now() / 1000);
  const freshObservations = observations.filter(
    (o) => now - o.checkedAt <= OFFLINE_AFTER_S,
  );
  const onlineCount = freshObservations.length;

  // Quorum: online if >= 50% of monitors that saw it recently agree
  const agreement = monitorCount > 0 ? onlineCount / monitorCount : 0;
  const online = onlineCount > 0 && agreement >= 0.5;

  const allNips = new Set<number>();
  const allKinds = new Set<number>();
  const allTopics = new Set<string>();
  let bestGeohash: string | undefined;

  for (const o of observations) {
    o.event.supportedNips.forEach((n) => allNips.add(n));
    o.event.acceptedKinds.forEach((k) => allKinds.add(k));
    o.event.topics.forEach((t) => allTopics.add(t));
    if (o.event.geohash && (!bestGeohash || o.event.geohash.length > bestGeohash.length)) {
      bestGeohash = o.event.geohash;
    }
  }

  return {
    relayUrl,
    monitorCount,
    onlineCount,
    online,
    agreement,
    medianRttOpen: median(observations.map((o) => o.rttOpen).filter((v): v is number => v != null)),
    medianRttRead: median(observations.map((o) => o.rttRead).filter((v): v is number => v != null)),
    medianRttWrite: median(observations.map((o) => o.rttWrite).filter((v): v is number => v != null)),
    lastSeenAt,
    liveness: online ? 'online' : classifyLiveness(lastSeenAt, now),
    observations,
    supportedNips: Array.from(allNips).sort((a, b) => a - b),
    acceptedKinds: Array.from(allKinds).sort((a, b) => a - b),
    geohash: bestGeohash,
    topics: Array.from(allTopics),
  };
}

/**
 * Hook: consensus data for ALL relays observed by monitors.
 */
export function useMonitorConsensus() {
  const { data: multiMap, isLoading } = useNIP66MultiMonitor();

  const consensusMap = useMemo(() => {
    const map = new Map<string, RelayConsensus>();
    if (!multiMap) return map;
    for (const [relayUrl, monitorMap] of multiMap) {
      map.set(relayUrl, computeConsensus(relayUrl, monitorMap));
    }
    return map;
  }, [multiMap]);

  return { consensusMap, isLoading };
}

/**
 * Hook: consensus for a single relay.
 */
export function useRelayConsensus(relayUrl: string) {
  const { data: multiMap, isLoading } = useNIP66MultiMonitor();

  const consensus = useMemo(() => {
    if (!multiMap) return null;
    const monitorMap = multiMap.get(relayUrl);
    if (!monitorMap || monitorMap.size === 0) return null;
    return computeConsensus(relayUrl, monitorMap);
  }, [multiMap, relayUrl]);

  return { consensus, isLoading };
}

// ─── Real uptime from historical kind:30166 ─────────────────────────────────

export interface UptimeDataPoint {
  /** Bucket start timestamp (ms) */
  timestamp: number;
  /** 1 = seen online by any monitor in this bucket, 0 = not seen */
  online: 0 | 1;
}

export interface RelayHistoryStats {
  /** Uptime % over the queried window */
  uptimePercent: number;
  /** Bucketed data points for sparklines/charts */
  points: UptimeDataPoint[];
  /** Number of checks found */
  checkCount: number;
  /** Distinct monitors that checked this relay */
  monitorCount: number;
  /** RTT trend (median per bucket) */
  rttTrend: { timestamp: number; rtt: number }[];
  /** Whether we found any history at all */
  hasHistory: boolean;
}

/**
 * Fetch historical kind:30166 events for a relay and compute REAL uptime.
 * Buckets the last 14 days into daily buckets: a day counts as "up" if any
 * trusted monitor published an observation for the relay that day.
 */
export function useRelayMonitorHistory(relayUrl: string, days = 14) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['relay-monitor-history', relayUrl, days],
    queryFn: async (): Promise<RelayHistoryStats> => {
      const nowS = Math.floor(Date.now() / 1000);
      const sinceS = nowS - days * 24 * 3600;

      const events = await nostr.query([
        {
          kinds: [KIND_RELAY_DISCOVERY],
          authors: TRUSTED_MONITOR_PUBKEYS,
          '#d': [relayUrl],
          since: sinceS,
          limit: 500,
        },
      ]);

      if (events.length === 0) {
        return {
          uptimePercent: 0,
          points: [],
          checkCount: 0,
          monitorCount: 0,
          rttTrend: [],
          hasHistory: false,
        };
      }

      // Bucket by day
      const bucketMs = 24 * 3600 * 1000;
      const buckets = new Map<number, { online: boolean; rtts: number[] }>();
      const monitors = new Set<string>();

      for (const event of events) {
        monitors.add(event.pubkey);
        const tsMs = event.created_at * 1000;
        const bucketStart = Math.floor(tsMs / bucketMs) * bucketMs;
        const bucket = buckets.get(bucketStart) ?? { online: false, rtts: [] };
        bucket.online = true; // Monitors only publish 30166 for reachable relays
        const rtt = event.tags.find(([t]) => t === 'rtt-open')?.[1];
        if (rtt) bucket.rtts.push(parseInt(rtt));
        buckets.set(bucketStart, bucket);
      }

      // Build full day range (fill gaps as offline)
      const points: UptimeDataPoint[] = [];
      const rttTrend: { timestamp: number; rtt: number }[] = [];
      let upDays = 0;

      for (let d = days - 1; d >= 0; d--) {
        const dayStart = Math.floor((Date.now() - d * bucketMs) / bucketMs) * bucketMs;
        const bucket = buckets.get(dayStart);
        const online = bucket?.online ? 1 : 0;
        points.push({ timestamp: dayStart, online: online as 0 | 1 });
        if (online) upDays++;
        if (bucket && bucket.rtts.length > 0) {
          const med = median(bucket.rtts);
          if (med !== undefined) rttTrend.push({ timestamp: dayStart, rtt: med });
        }
      }

      return {
        uptimePercent: Math.round((upDays / days) * 1000) / 10,
        points,
        checkCount: events.length,
        monitorCount: monitors.size,
        rttTrend,
        hasHistory: true,
      };
    },
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  });
}

// ─── Speed groups & peer percentiles ────────────────────────────────────────

export type SpeedGroup = 'lightning' | 'swift' | 'mid' | 'leisurely' | 'glacial';

export const SPEED_GROUP_META: Record<SpeedGroup, { label: string; color: string; emoji: string }> = {
  lightning: { label: 'Lightning Fast', color: 'text-emerald-400', emoji: '⚡' },
  swift: { label: 'Swift', color: 'text-green-500', emoji: '🚀' },
  mid: { label: 'Mid', color: 'text-yellow-500', emoji: '➡️' },
  leisurely: { label: 'Leisurely', color: 'text-orange-500', emoji: '🐢' },
  glacial: { label: 'Glacial', color: 'text-red-500', emoji: '🧊' },
};

export interface NetworkBenchmarks {
  /** RTT percentile thresholds */
  p20: number;
  p40: number;
  p60: number;
  p80: number;
  /** Median supported NIP count */
  medianNipCount: number;
  /** Median uptime */
  medianUptime: number;
  /** Total relays in sample */
  sampleSize: number;
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = Math.floor((p / 100) * sortedValues.length);
  return sortedValues[Math.min(idx, sortedValues.length - 1)];
}

/**
 * Compute network-wide benchmarks from all relays (nostr.watch speed groups).
 */
export function useNetworkBenchmarks(relays: LiveRelayRecord[]): NetworkBenchmarks {
  return useMemo(() => {
    const rtts = relays
      .map((r) => r.liveLatencyMs ?? r.avgLatencyMs)
      .filter((v): v is number => v != null && v > 0)
      .sort((a, b) => a - b);

    const nipCounts = relays
      .map((r) => r.nip11.supported_nips?.length ?? 0)
      .sort((a, b) => a - b);

    const uptimes = relays
      .map((r) => r.uptimePercent30d)
      .sort((a, b) => a - b);

    return {
      p20: percentile(rtts, 20),
      p40: percentile(rtts, 40),
      p60: percentile(rtts, 60),
      p80: percentile(rtts, 80),
      medianNipCount: percentile(nipCounts, 50),
      medianUptime: percentile(uptimes, 50),
      sampleSize: rtts.length,
    };
  }, [relays]);
}

/**
 * Classify a relay's speed into a percentile bucket.
 */
export function getSpeedGroup(rttMs: number | null | undefined, benchmarks: NetworkBenchmarks): SpeedGroup | null {
  if (rttMs == null || benchmarks.sampleSize === 0) return null;
  if (rttMs <= benchmarks.p20) return 'lightning';
  if (rttMs <= benchmarks.p40) return 'swift';
  if (rttMs <= benchmarks.p60) return 'mid';
  if (rttMs <= benchmarks.p80) return 'leisurely';
  return 'glacial';
}

/**
 * Compute "faster than X% of relays" percentile for a relay's RTT.
 */
export function getRttPercentile(rttMs: number, relays: LiveRelayRecord[]): number {
  const rtts = relays
    .map((r) => r.liveLatencyMs ?? r.avgLatencyMs)
    .filter((v): v is number => v != null && v > 0)
    .sort((a, b) => a - b);
  if (rtts.length === 0) return 50;
  const below = rtts.filter((v) => v > rttMs).length;
  return Math.round((below / rtts.length) * 100);
}

/**
 * Compute "more NIPs than X% of relays" percentile.
 */
export function getNipPercentile(nipCount: number, relays: LiveRelayRecord[]): number {
  const counts = relays.map((r) => r.nip11.supported_nips?.length ?? 0);
  if (counts.length === 0) return 50;
  const below = counts.filter((v) => v < nipCount).length;
  return Math.round((below / counts.length) * 100);
}
