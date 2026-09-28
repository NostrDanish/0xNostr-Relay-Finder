/**
 * Relay Data — Monitor-Sourced Directory
 *
 * Sources of truth (no synthetic data):
 * 1. NIP-66 monitors (kind:30166) — every relay any monitor has recently seen
 * 2. Community submissions (kind:30078) — submitted & approved via our app
 *
 * The directory is empty at startup. Relays appear as monitors find them.
 * Relays disappear from the live view when monitors haven't seen them for
 * 6 hours. Persistence comes from community submissions, which are stored
 * as signed events on Nostr.
 *
 * Infrastructure relays (admin, moderation) live in src/lib/constants.ts
 * under APP_RELAY_URLS — they are the plumbing, not the directory.
 */

import { useMemo, useState, useEffect } from 'react';
import type { RelayRecord } from '@/types/relay';
import { useRelayDirectory } from '@/hooks/useRelayDirectory';
import { useNIP66MultiMonitor } from '@/hooks/useNIP66Monitor';
import { observationToRecord } from '@/data/relays';

/** How old a monitor observation can be before the relay drops from the directory */
const FRESH_WINDOW_S = 6 * 3600; // 6 hours

export function useRelayData() {
  // 1. Live monitor observations — the primary directory source
  const { data: multiMap, isLoading: monitorLoading } = useNIP66MultiMonitor();

  // 2. Community-submitted relays (kind:30078) — secondary source
  const { data: nostrRelays, isLoading: nostrLoading } = useRelayDirectory();

  const relays = useMemo(() => {
    const nowS = Math.floor(Date.now() / 1000);
    const relayMap = new Map<string, RelayRecord>();

    // Phase 1: Ingest monitor observations
    if (multiMap) {
      for (const [relayUrl, monitorMap] of multiMap) {
        // Only fresh observations
        const latest = Array.from(monitorMap.values())
          .filter((e) => nowS - e.checkedAt <= FRESH_WINDOW_S)
          .sort((a, b) => b.checkedAt - a.checkedAt)[0];

        if (!latest) continue;

        const rtt = latest.rttOpen;
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
              blossom: latest.supportedNips.includes(94) || latest.supportedNips.includes(96),
              hasNip11: !!latest.nip11,
            },
            eventsPerDay: undefined,
            connectedUsers: undefined,
          },
          latest.nip11,
          rtt,
          Date.now(),
        );
        relayMap.set(relayUrl, record);
      }
    }

    // Phase 2: Merge community-submitted relays (overwrite monitors for these)
    if (nostrRelays) {
      for (const relay of nostrRelays) {
        relayMap.set(relay.url, relay);
      }
    }

    return Array.from(relayMap.values());
  }, [multiMap, nostrRelays]);

  const loading = monitorLoading || nostrLoading;

  return { relays, loading, discoveredCount: 0, discoverableTotal: multiMap?.size ?? 0 };
}

/**
 * Look up a single relay by the encoded URL slug (e.g. "wss%3A%2F%2Frelay.damus.io").
 */
export function useRelayById(urlEncoded: string) {
  const { relays, loading } = useRelayData();
  const [notFound, setNotFound] = useState(false);

  const relay = useMemo(() => {
    if (loading) return null;
    const url = decodeURIComponent(urlEncoded);
    return relays.find((r) => r.url === url) ?? null;
  }, [relays, loading, urlEncoded]);

  useEffect(() => {
    if (!loading && !relay) setNotFound(true);
  }, [loading, relay]);

  return { relay, loading, notFound };
}