/**
 * Auto-Crawling Relay Discovery
 *
 * Watches kind:10002 (NIP-65 relay lists), kind:3 (follow lists),
 * and kind:30166 (NIP-66 monitor events) to discover new relay URLs
 * that aren't in our directory yet.
 *
 * Runs passively in the background and feeds new discoveries
 * into the live relay store.
 */

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import {
  KIND_RELAY_LIST,
  KIND_FOLLOW_LIST,
  KIND_RELAY_DISCOVERY,
  TRUSTED_MONITOR_PUBKEYS,
} from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiscoveredRelay {
  url: string;
  discoveredAt: number; // unix ms
  source: 'kind:10002' | 'kind:3' | 'kind:30166';
  /** How many times this URL was seen across sources */
  seenCount: number;
  /** Pubkeys that reference this relay */
  referencedBy: string[];
}

// ─── URL normalization ────────────────────────────────────────────────────────

function normalizeRelayUrl(url: string): string | null {
  try {
    // Must start with ws:// or wss://
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) return null;

    const parsed = new URL(url);
    // Normalize: lowercase host, remove trailing slash, remove default ports
    let normalized = `${parsed.protocol}//${parsed.hostname.toLowerCase()}`;
    if (parsed.port && parsed.port !== '443' && parsed.port !== '80') {
      normalized += `:${parsed.port}`;
    }
    if (parsed.pathname && parsed.pathname !== '/') {
      normalized += parsed.pathname.replace(/\/+$/, '');
    }
    // Ensure wss://
    normalized = normalized.replace(/^ws:\/\//, 'wss://');

    return normalized;
  } catch {
    return null;
  }
}

/**
 * Extract relay URLs from kind:10002 events.
 */
function extractFromRelayList(tags: string[][]): string[] {
  return tags
    .filter(([t]) => t === 'r')
    .map(([, url]) => normalizeRelayUrl(url))
    .filter((u): u is string => u !== null);
}

/**
 * Extract relay URLs from kind:3 events (follow list).
 * Kind:3 events sometimes include relay URLs in the content field as JSON.
 */
function extractFromFollowList(content: string, tags: string[][]): string[] {
  const urls: string[] = [];

  // Tags may have relay hints
  for (const tag of tags) {
    if (tag[0] === 'p' && tag[2]) {
      const normalized = normalizeRelayUrl(tag[2]);
      if (normalized) urls.push(normalized);
    }
  }

  // Content is sometimes a JSON object of { "wss://relay.url": { read: true, write: true } }
  try {
    const relayObj = JSON.parse(content) as Record<string, unknown>;
    for (const key of Object.keys(relayObj)) {
      const normalized = normalizeRelayUrl(key);
      if (normalized) urls.push(normalized);
    }
  } catch {
    // Content is not JSON — fine
  }

  return urls;
}

/**
 * Extract relay URLs from kind:30166 NIP-66 events.
 */
function extractFromMonitorEvent(tags: string[][]): string[] {
  const dTag = tags.find(([t]) => t === 'd')?.[1];
  if (!dTag) return [];
  const normalized = normalizeRelayUrl(dTag);
  return normalized ? [normalized] : [];
}

/**
 * Hook that crawls Nostr for new relay URLs.
 *
 * Queries recent kind:10002 and kind:30166 events and extracts
 * relay URLs that aren't in the provided known set.
 */
export function useRelayCrawler(knownRelayUrls: string[]) {
  const { nostr } = useNostr();
  const knownSet = new Set(knownRelayUrls.map((u) => normalizeRelayUrl(u) ?? u));

  return useQuery({
    queryKey: ['relay-crawler', knownRelayUrls.length],
    queryFn: async (): Promise<DiscoveredRelay[]> => {
      const sixHoursAgo = Math.floor(Date.now() / 1000) - 21600;
      const discoveryMap = new Map<string, DiscoveredRelay>();

      // 1. Query recent kind:10002 events (relay lists from random users)
      try {
        const relayListEvents = await nostr.query([
          {
            kinds: [KIND_RELAY_LIST],
            since: sixHoursAgo,
            limit: 100,
          },
        ]);

        for (const event of relayListEvents) {
          const urls = extractFromRelayList(event.tags);
          for (const url of urls) {
            if (knownSet.has(url)) continue;
            const existing = discoveryMap.get(url);
            if (existing) {
              existing.seenCount++;
              if (!existing.referencedBy.includes(event.pubkey)) {
                existing.referencedBy.push(event.pubkey);
              }
            } else {
              discoveryMap.set(url, {
                url,
                discoveredAt: Date.now(),
                source: 'kind:10002',
                seenCount: 1,
                referencedBy: [event.pubkey],
              });
            }
          }
        }
      } catch (err) {
        console.warn('[RelayCrawler] kind:10002 query failed:', err);
      }

      // 2. Query kind:30166 from monitors for relay URLs we don't know
      try {
        const monitorEvents = await nostr.query([
          {
            kinds: [KIND_RELAY_DISCOVERY],
            authors: TRUSTED_MONITOR_PUBKEYS,
            since: sixHoursAgo,
            limit: 200,
          },
        ]);

        for (const event of monitorEvents) {
          const urls = extractFromMonitorEvent(event.tags);
          for (const url of urls) {
            if (knownSet.has(url)) continue;
            const existing = discoveryMap.get(url);
            if (existing) {
              existing.seenCount++;
              existing.source = 'kind:30166'; // upgrade source priority
            } else {
              discoveryMap.set(url, {
                url,
                discoveredAt: Date.now(),
                source: 'kind:30166',
                seenCount: 1,
                referencedBy: [event.pubkey],
              });
            }
          }
        }
      } catch (err) {
        console.warn('[RelayCrawler] kind:30166 query failed:', err);
      }

      // Sort by seen count (most referenced first)
      const discovered = Array.from(discoveryMap.values())
        .sort((a, b) => b.seenCount - a.seenCount);

      return discovered;
    },
    staleTime: 1000 * 60 * 30,      // 30 min stale
    gcTime: 1000 * 60 * 60 * 2,     // 2 hours
    refetchInterval: 1000 * 60 * 30, // Re-crawl every 30 min
    retry: 1,
  });
}
