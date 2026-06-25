/**
 * Batch NIP-11 HTTP Fetching
 *
 * Fetches NIP-11 info documents for all known relays in staggered batches
 * to avoid overwhelming relays. Uses CORS proxy as fallback.
 *
 * Caches results and tracks:
 * - Last fetch time per relay
 * - NIP support changes (diff tracking)
 * - NIP-11 freshness indicators
 */

import { useQuery } from '@tanstack/react-query';
import type { NIP11Info } from '@/types/relay';
import { corsProxy } from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NIP11CacheEntry {
  /** The NIP-11 document */
  info: NIP11Info;
  /** When this was last fetched (unix ms) */
  fetchedAt: number;
  /** Previous supported_nips array (for diff tracking) */
  previousNips?: number[];
  /** NIPs that were added since last check */
  nipsAdded: number[];
  /** NIPs that were removed since last check */
  nipsRemoved: number[];
  /** Whether the NIP-11 document changed since last fetch */
  changed: boolean;
  /** When NIP-11 last changed (unix ms) */
  lastChangedAt?: number;
}

export type NIP11CacheMap = Map<string, NIP11CacheEntry>;

// Keep a persistent cache across re-renders
let globalNIP11Cache: NIP11CacheMap = new Map();

/**
 * Fetch a single relay's NIP-11 document, trying direct first, then CORS proxy.
 */
async function fetchSingleNIP11(wsUrl: string): Promise<NIP11Info | null> {
  const httpUrl = wsUrl.replace(/^wss?:\/\//, 'https://');

  // Try direct fetch
  try {
    const res = await fetch(httpUrl, {
      headers: { Accept: 'application/nostr+json' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      return (await res.json()) as NIP11Info;
    }
  } catch {
    // Direct failed, try CORS proxy
  }

  // Try CORS proxy
  try {
    const proxyUrl = corsProxy(httpUrl);
    const res = await fetch(proxyUrl, {
      headers: { Accept: 'application/nostr+json' },
      signal: AbortSignal.timeout(7000),
    });
    if (res.ok) {
      return (await res.json()) as NIP11Info;
    }
  } catch {
    // Both failed
  }

  return null;
}

/**
 * Compute the diff between two NIP arrays.
 */
function diffNips(
  previous: number[] | undefined,
  current: number[]
): { added: number[]; removed: number[] } {
  if (!previous) return { added: [], removed: [] };
  const prevSet = new Set(previous);
  const currSet = new Set(current);
  const added = current.filter((n) => !prevSet.has(n));
  const removed = previous.filter((n) => !currSet.has(n));
  return { added, removed };
}

/**
 * Batch-fetch NIP-11 for a list of relay URLs with rate limiting.
 * Processes 8 relays concurrently with 300ms between batches.
 */
async function batchFetchNIP11(
  relayUrls: string[],
  existingCache: NIP11CacheMap
): Promise<NIP11CacheMap> {
  const newCache = new Map(existingCache);
  const BATCH_SIZE = 8;
  const BATCH_DELAY = 300;
  const STALE_THRESHOLD = 1000 * 60 * 5; // 5 minutes

  // Filter to relays that need refreshing
  const now = Date.now();
  const needsRefresh = relayUrls.filter((url) => {
    const cached = newCache.get(url);
    return !cached || (now - cached.fetchedAt) > STALE_THRESHOLD;
  });

  // Process in batches
  for (let i = 0; i < needsRefresh.length; i += BATCH_SIZE) {
    const batch = needsRefresh.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (url) => {
        const info = await fetchSingleNIP11(url);
        return { url, info };
      })
    );

    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value.info) continue;

      const { url, info } = result.value;
      const existing = newCache.get(url);
      const previousNips = existing?.info.supported_nips;
      const currentNips = info.supported_nips ?? [];
      const { added, removed } = diffNips(previousNips, currentNips);

      // Check if document actually changed
      const changed = !existing ||
        JSON.stringify(existing.info) !== JSON.stringify(info);

      newCache.set(url, {
        info,
        fetchedAt: now,
        previousNips,
        nipsAdded: added,
        nipsRemoved: removed,
        changed,
        lastChangedAt: changed ? now : existing?.lastChangedAt,
      });
    }

    // Rate limit between batches
    if (i + BATCH_SIZE < needsRefresh.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY));
    }
  }

  return newCache;
}

/**
 * Hook to batch-fetch NIP-11 for all relays.
 * Returns a Map of relay URL → NIP11CacheEntry.
 *
 * Auto-refreshes every 5 minutes.
 */
export function useNIP11Batch(relayUrls: string[]) {
  return useQuery({
    queryKey: ['nip11-batch', relayUrls.length],
    queryFn: async () => {
      const cache = await batchFetchNIP11(relayUrls, globalNIP11Cache);
      globalNIP11Cache = cache;
      return cache;
    },
    enabled: relayUrls.length > 0,
    staleTime: 1000 * 60 * 5,     // 5 minutes
    gcTime: 1000 * 60 * 60,       // 1 hour
    refetchInterval: 1000 * 60 * 5, // Auto-refresh every 5 minutes
    retry: 1,
  });
}

/**
 * Get a human-readable NIP-11 freshness label.
 */
export function getNIP11Freshness(entry?: NIP11CacheEntry): {
  label: string;
  color: 'green' | 'yellow' | 'grey';
  detail: string;
} {
  if (!entry) {
    return { label: 'Not fetched', color: 'grey', detail: 'NIP-11 has not been checked yet' };
  }

  const age = Date.now() - entry.fetchedAt;
  const mins = Math.floor(age / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  let label: string;
  if (mins < 5) label = 'Just checked';
  else if (mins < 60) label = `${mins}m ago`;
  else if (hours < 24) label = `${hours}h ago`;
  else label = `${days}d ago`;

  const changeAge = entry.lastChangedAt ? Date.now() - entry.lastChangedAt : undefined;
  const changeDays = changeAge ? Math.floor(changeAge / (1000 * 60 * 60 * 24)) : undefined;

  let color: 'green' | 'yellow' | 'grey';
  let detail: string;

  if (entry.changed) {
    color = 'green';
    detail = 'NIP-11 info updated recently';
  } else if (changeDays != null && changeDays > 30) {
    color = 'grey';
    detail = `NIP-11 unchanged for ${changeDays} days`;
  } else {
    color = 'yellow';
    detail = `NIP-11 checked ${label}`;
  }

  return { label, color, detail };
}
