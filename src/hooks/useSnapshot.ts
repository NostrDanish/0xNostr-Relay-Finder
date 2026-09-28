/**
 * Snapshot hook — the GitHub Actions "auto-tick" data store, in the app.
 *
 * The scheduled crawler (scripts/crawl, crawl workflow) commits a bundled
 * snapshot of the whole NIP-66 monitor network. This hook converts those
 * records into RelayRecords so the directory:
 *
 *   - renders instantly on first paint (no waiting for relay queries),
 *   - has REAL 30-day uptime, sparklines, and first-seen dates built from
 *     persistent observation history (not a single live query),
 *   - keeps relays listed even when the live monitor feed has a gap,
 *   - knows about dead relays for the graveyard.
 *
 * Live sources (NIP-66 feed, NIP-11 batch, submissions) still override the
 * snapshot when fresher — the snapshot is the floor, not the ceiling.
 */

import { useMemo } from 'react';
import type { RelayRecord, UseCaseTag } from '@/types/relay';
import { GENERATED_SNAPSHOT, CRAWL_REPORT } from '@/lib/snapshot/generated';
import type { SnapshotRelay, GraveyardEntry, StatsPoint, CrawlReport } from '@/lib/snapshot/types';

/** NIP → use-case mapping (mirrors src/data/relays.ts autoTags). */
const NIP_TAGS: Record<number, UseCaseTag> = {
  4: 'DMs',
  17: 'DMs',
  23: 'Long Form',
  29: 'Communities',
  50: 'High Performance',
  57: 'Zaps',
  72: 'Communities',
  94: 'Blossom',
  96: 'Blossom',
  99: 'Marketplace',
};

function autoTags(nips: number[]): UseCaseTag[] {
  const tags = new Set<UseCaseTag>(['General']);
  for (const n of nips) {
    if (NIP_TAGS[n]) tags.add(NIP_TAGS[n]);
  }
  return Array.from(tags);
}

function hostname(url: string): string {
  try {
    return new URL(url.replace(/^wss?:\/\//, 'https://')).hostname || url;
  } catch {
    return url;
  }
}

/** Convert a bundled snapshot relay into a directory RelayRecord. */
export function snapshotRelayToRecord(r: SnapshotRelay, nowMs: number): RelayRecord {
  const nips = r.nips ?? [];
  const onlineRecently = nowMs - r.lastSeen * 1000 < 24 * 3_600_000;
  const blossom = nips.includes(94) || nips.includes(96);

  return {
    id: r.url,
    url: r.url,
    name: (r.nip11?.name ?? r.software ?? hostname(r.url)).slice(0, 60),
    description: (r.nip11?.description ?? 'Observed by the NIP-66 monitor network.').slice(0, 500),
    nip11: {
      name: r.nip11?.name,
      description: r.nip11?.description,
      pubkey: r.nip11?.pubkey,
      contact: r.nip11?.contact,
      software: r.software ?? r.nip11?.software,
      version: r.version ?? r.nip11?.version,
      supported_nips: nips,
      limitation: r.nip11?.limitation,
      relay_countries: r.nip11?.relay_countries,
      language_tags: r.nip11?.language_tags,
      tags: r.nip11?.tags,
      payments_url: r.nip11?.payments_url,
      icon: r.nip11?.icon,
    },
    useCases: autoTags(nips),
    priceTiers: [],
    countryCode: r.nip11?.relay_countries?.[0],
    isFree: !(r.requirements.payment || r.nip11?.limitation?.payment_required),
    isOnline: onlineRecently,
    uptimePercent30d: Math.round(r.uptime30d * 100),
    uptimeSpark: r.spark,
    avgLatencyMs: r.medianRttMs ?? undefined,
    lastChecked: r.lastChecked * 1000,
    addedAt: r.firstSeen * 1000,
    featured: false,
    trustScore: 0,
    blossomSupported: blossom,
    nip66: {
      enriched: r.monitorCount > 0,
      lastMonitorEvent: r.lastSeen * 1000,
      liveStatus: onlineRecently ? 'online' : 'offline',
      monitorLatencyMs: r.medianRttMs ?? undefined,
      capabilities: {
        read: true,
        write: r.requirements.writes ?? true,
        relay: true,
        blossom,
        hasNip11: Boolean(r.nip11),
      },
    },
    importSources: [{ source: 'nip66', importedAt: GENERATED_SNAPSHOT.generatedAt * 1000, fieldsUpdated: ['uptimePercent30d', 'uptimeSpark', 'nip11', 'nip66'] }],
  };
}

export interface SnapshotData {
  /** All active relays as directory records, keyed map + list */
  records: RelayRecord[];
  byUrl: Map<string, RelayRecord>;
  /** Dead relays for the graveyard page */
  graveyard: GraveyardEntry[];
  /** Network-wide time series (one point per crawl run) */
  stats: StatsPoint[];
  /** When the snapshot was generated (unix seconds) */
  generatedAt: number;
  /** Per-run crawler report */
  report: CrawlReport | null;
}

/**
 * Access the bundled crawler snapshot. Synchronous — the data is compiled
 * into the bundle, so there is no loading state at all.
 */
export function useSnapshot(): SnapshotData {
  return useMemo(() => {
    const nowMs = Date.now();
    const records = GENERATED_SNAPSHOT.relays.map((r) => snapshotRelayToRecord(r, nowMs));
    return {
      records,
      byUrl: new Map(records.map((r) => [r.url, r])),
      graveyard: GENERATED_SNAPSHOT.graveyard,
      stats: GENERATED_SNAPSHOT.stats,
      generatedAt: GENERATED_SNAPSHOT.generatedAt,
      report: CRAWL_REPORT,
    };
  }, []);
}
