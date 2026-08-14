/**
 * Discovered Relay Auto-Import
 *
 * Converts NIP-66 discovery feed observations (kind:30166 from ALL monitors)
 * into minimal RelayRecords so the directory grows automatically — the same
 * way nostr.watch builds its relay list.
 *
 * Discovered relays come with real health data attached:
 * - NIP-11 document from the event's content field (zero extra probing!)
 * - RTT from rtt-open tags
 * - Geohash from g tags
 * - Supported NIPs from N tags
 * - Requirements from R tags
 *
 * Trust model: discovered relays are ranked by how many monitors have
 * observed them. Relays only seen by one random monitor get low trust;
 * relays seen by trusted monitors get full health data.
 */

import { useMemo } from 'react';
import type { RelayRecord, UseCaseTag } from '@/types/relay';
import {
  useNIP66DiscoveryFeed,
  type NIP66MonitorEvent,
} from '@/hooks/useNIP66Monitor';
import { TRUSTED_MONITOR_PUBKEYS } from '@/lib/constants';

// ─── Auto-tag from NIPs (lightweight version for discovered relays) ─────────

const NIP_TAG_MAP: Record<number, UseCaseTag> = {
  4: 'DMs',
  17: 'DMs',
  50: 'High Performance',
  57: 'Zaps',
  94: 'Blossom',
  96: 'Blossom',
  23: 'Long Form',
  29: 'Communities',
  72: 'Communities',
  99: 'Marketplace',
  71: 'Video',
};

function autoTagFromNips(nips: number[]): UseCaseTag[] {
  const tags = new Set<UseCaseTag>(['General']);
  for (const nip of nips) {
    const tag = NIP_TAG_MAP[nip];
    if (tag) tags.add(tag);
  }
  return Array.from(tags);
}

/**
 * Build a minimal RelayRecord from a NIP-66 observation.
 * Uses the NIP-11 document embedded in the event content when available.
 */
function observationToRecord(
  relayUrl: string,
  best: NIP66MonitorEvent,
  monitorCount: number,
  trustedMonitorSeen: boolean,
): RelayRecord {
  const nip11 = best.nip11 ?? {};
  const nips = best.supportedNips.length > 0
    ? best.supportedNips
    : (nip11.supported_nips ?? []);

  const name = nip11.name ?? best.software ?? new URL(relayUrl.replace(/^wss?:\/\//, 'https://')).hostname;
  const description = nip11.description
    ?? `Discovered via NIP-66 monitor network. ${monitorCount} monitor${monitorCount !== 1 ? 's have' : ' has'} observed this relay.`;

  // Trust: discovered relays start low, scale with monitor coverage
  const trustScore = trustedMonitorSeen
    ? Math.min(40 + monitorCount * 10, 80)
    : Math.min(20 + monitorCount * 5, 50);

  return {
    id: `discovered:${relayUrl}`,
    url: relayUrl,
    name,
    description,
    nip11: {
      ...nip11,
      supported_nips: nips,
      software: nip11.software ?? best.software,
    },
    useCases: autoTagFromNips(nips),
    priceTiers: [{
      name: best.requirements.payment ? 'Paid' : 'Free',
      price: 0,
      currency: 'USD',
      features: ['Discovered via NIP-66'],
    }],
    isFree: !best.requirements.payment,
    isOnline: true, // Monitor published an observation, so it was reachable
    uptimePercent30d: 0, // Unknown — no history yet; RealUptimePanel will compute live
    uptimeSpark: [],
    avgLatencyMs: best.rttOpen,
    lastChecked: best.checkedAt * 1000,
    addedAt: Date.now(),
    featured: false,
    trustScore,
    operatorNpub: nip11.pubkey ?? best.operatorPubkey,
    websiteUrl: undefined,
    blossomSupported: nips.includes(94) || nips.includes(96),
    nip66: {
      enriched: true,
      lastMonitorEvent: best.checkedAt * 1000,
      liveStatus: 'online',
      monitorLatencyMs: best.rttOpen,
      monitorPubkey: best.monitorPubkey,
      capabilities: {
        read: best.checks.read ?? true,
        write: best.checks.write ?? true,
        relay: true,
        blossom: nips.includes(94) || nips.includes(96),
        hasNip11: !!best.nip11,
      },
      conflictsWithNip11: false,
    },
    importSources: [{
      source: 'nip66',
      importedAt: Date.now(),
      fieldsUpdated: ['nip11', 'avgLatencyMs', 'isOnline', 'nip66'],
    }],
  };
}

/**
 * Discover relays from the NIP-66 network-wide feed and convert them
 * into RelayRecords ready to merge into the directory.
 *
 * @param knownRelayUrls URLs already in the directory (excluded)
 * @param maxDiscovered Cap the number of auto-imported relays (default 150)
 */
export function useDiscoveredRelays(knownRelayUrls: string[], maxDiscovered = 150) {
  const { data: discoveryFeed, isLoading } = useNIP66DiscoveryFeed();

  const discovered = useMemo(() => {
    if (!discoveryFeed) return [];

    const knownSet = new Set(knownRelayUrls);
    const records: RelayRecord[] = [];

    for (const [relayUrl, monitorMap] of discoveryFeed) {
      if (knownSet.has(relayUrl)) continue;

      // Pick the best observation: prefer trusted monitors, then most recent
      const observations = Array.from(monitorMap.values()).sort((a, b) => {
        const aTrusted = TRUSTED_MONITOR_PUBKEYS.includes(a.monitorPubkey) ? 1 : 0;
        const bTrusted = TRUSTED_MONITOR_PUBKEYS.includes(b.monitorPubkey) ? 1 : 0;
        if (aTrusted !== bTrusted) return bTrusted - aTrusted;
        return b.checkedAt - a.checkedAt;
      });

      const best = observations[0];
      const trustedMonitorSeen = observations.some((o) =>
        TRUSTED_MONITOR_PUBKEYS.includes(o.monitorPubkey),
      );

      try {
        records.push(observationToRecord(relayUrl, best, monitorMap.size, trustedMonitorSeen));
      } catch {
        // Skip malformed URLs
      }
    }

    // Sort: trusted-monitor-seen first, then most monitors, then lowest RTT
    records.sort((a, b) => b.trustScore - a.trustScore);

    return records.slice(0, maxDiscovered);
  }, [discoveryFeed, knownRelayUrls, maxDiscovered]);

  return { discovered, isLoading, totalFound: discoveryFeed?.size ?? 0 };
}
