/**
 * Relay Data — Monitor-Sourced Directory + Crawler Snapshot floor
 *
 * Sources of truth (no synthetic data):
 * 0. Crawler snapshot (bundled, committed by GitHub Actions every 3h) —
 *    instant first paint, real 30d uptime/sparklines from persistent
 *    observation history, resilient against monitor-feed gaps.
 * 1. NIP-66 monitors (kind:30166, live query) — freshest liveness; overrides
 *    the snapshot when it has newer data.
 * 2. Community submissions (kind:30078) — submitted & approved via our app.
 *
 * Infrastructure relays (admin, moderation) live in src/lib/constants.ts
 * under APP_RELAY_URLS — they are the plumbing, not the directory.
 */

import { useMemo, useState, useEffect } from 'react';
import type { RelayRecord } from '@/types/relay';
import { useRelayDirectory } from '@/hooks/useRelayDirectory';
import { useNIP66DiscoveryFeed } from '@/hooks/useNIP66Monitor';
import { useSnapshot } from '@/hooks/useSnapshot';
import { observationToRecord } from '@/data/relays';
import { normalizeRelayUrl } from '@/lib/relayUrl';

/**
 * How old a monitor observation can be before the relay drops from the
 * directory. 24 hours — long enough to survive a slow monitor day, short
 * enough that genuinely dead relays fall off quickly.
 */
const FRESH_WINDOW_S = 24 * 3600; // 24 hours

/**
 * Snapshot relays older than this stay out of the live directory (they're
 * headed to the graveyard). 7 days — much more resilient than the live-only
 * window, because the snapshot has persistent history to back the listing.
 */
const SNAPSHOT_WINDOW_S = 7 * 24 * 3600;

export function useRelayData() {
  // 0. Crawler snapshot — bundled, synchronous, always available
  const snapshot = useSnapshot();

  // 1. Monitor observations from the ENTIRE NIP-66 network (all monitors,
  //    3-day query window, deduped per relay). Primary source of truth.
  const { data: discoveryFeed, isLoading: monitorLoading } = useNIP66DiscoveryFeed(2000);

  // 2. Community-submitted relays (kind:30078) — secondary source
  const { data: nostrRelays, isLoading: nostrLoading } = useRelayDirectory();

  const relays = useMemo(() => {
    const nowS = Math.floor(Date.now() / 1000);
    const relayMap = new Map<string, RelayRecord>();

    // Phase 0: Lay down the crawler snapshot as the floor. Every relay the
    //    crawler has seen online within the last 7 days appears immediately
    //    with real historical uptime and sparklines.
    for (const record of snapshot.records) {
      const lastSeenS = record.nip66?.lastMonitorEvent
        ? nowS - Math.floor(record.nip66.lastMonitorEvent / 1000)
        : nowS - Math.floor(record.lastChecked / 1000);
      if (lastSeenS > SNAPSHOT_WINDOW_S) continue;
      relayMap.set(normalizeRelayUrl(record.url) ?? record.url, record);
    }

    // Phase 1: Ingest monitor observations from the discovery feed.
    //    The feed contains ALL monitors (no author filter) — one entry per
    //    relay with the latest observation per monitor. Fresher than the
    //    snapshot, so it wins on conflict; snapshot history (uptime,
    //    sparklines, first-seen) is carried over.
    if (discoveryFeed) {
      for (const [relayUrl, monitorMap] of discoveryFeed) {
        // Take the most recent observation across ALL monitors for this relay
        const latest = Array.from(monitorMap.values())
          .sort((a, b) => b.checkedAt - a.checkedAt)[0];

        if (!latest) continue;

        // Skip relays that haven't been seen within the freshness window
        const age = nowS - latest.checkedAt;
        if (age > FRESH_WINDOW_S) continue;

        const key = normalizeRelayUrl(relayUrl) ?? relayUrl;
        const rtt = latest.rttOpen;
        const nips = latest.supportedNips ?? [];
        const record = observationToRecord(
          relayUrl,
          {
            enriched: true,
            lastMonitorEvent: latest.checkedAt * 1000,
            liveStatus: 'online',
            monitorLatencyMs: rtt,
            monitorPubkey: latest.monitorPubkey,
            capabilities: {
              read: latest.checks.read ?? true,
              write: latest.checks.write ?? true,
              relay: true,
              blossom: nips.includes(94) || nips.includes(96),
              hasNip11: !!latest.nip11,
            },
            eventsPerDay: undefined,
            connectedUsers: undefined,
          },
          latest.nip11,
          rtt,
          Date.now(),
        );

        // Carry over persistent history from the snapshot floor
        const prior = relayMap.get(key);
        if (prior) {
          record.uptimeSpark = prior.uptimeSpark;
          record.uptimePercent30d = prior.uptimePercent30d;
          if (!record.avgLatencyMs && prior.avgLatencyMs) record.avgLatencyMs = prior.avgLatencyMs;
          if (prior.nip66?.lastMonitorEvent && record.nip66) {
            record.nip66.lastMonitorEvent = Math.max(
              record.nip66.lastMonitorEvent ?? 0,
              prior.nip66.lastMonitorEvent,
            );
          }
        }
        relayMap.set(key, record);
      }
    }

    // Phase 2: Merge community-submitted relays (they win on URL conflict
    //    because they carry richer metadata: pricing, reviews, etc.)
    if (nostrRelays) {
      for (const relay of nostrRelays) {
        relayMap.set(normalizeRelayUrl(relay.url) ?? relay.url, relay);
      }
    }

    return Array.from(relayMap.values());
  }, [snapshot, discoveryFeed, nostrRelays]);

  const loading = monitorLoading || nostrLoading;
  const monitorCount = discoveryFeed?.size ?? 0;

  return {
    relays,
    loading,
    monitorCount,
    hasMonitorFeed: !!discoveryFeed && discoveryFeed.size > 0,
    snapshotGeneratedAt: snapshot.generatedAt,
  };
}

/**
 * Look up a single relay by the encoded URL slug (e.g. "wss%3A%2F%2Frelay.damus.io").
 */
export function useRelayById(urlEncoded: string) {
  const { relays, loading } = useRelayData();
  const [notFound, setNotFound] = useState(false);

  const relay = useMemo(() => {
    if (loading && !relays.length) return null;
    const url = decodeURIComponent(urlEncoded);
    const normalized = normalizeRelayUrl(url) ?? url;
    return relays.find((r) => (normalizeRelayUrl(r.url) ?? r.url) === normalized) ?? null;
  }, [relays, loading, urlEncoded]);

  useEffect(() => {
    if (!loading && !relay) setNotFound(true);
  }, [loading, relay]);

  return { relay, loading, notFound };
}
