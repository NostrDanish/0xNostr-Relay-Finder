/**
 * Web of Trust (WoT) Hook for 0xRelayFinder
 *
 * Computes trust scores for users based on their distance in the follow graph
 * from the app owner and trusted moderators. Votes from closer users count more.
 *
 * WoT Levels:
 *   0 = App owner (OWNER_PUBKEY_HEX)           → weight 5x
 *   1 = Directly followed by owner/admins       → weight 3x
 *   2 = Followed by someone at level 1          → weight 2x
 *   3+ = Everyone else with a Nostr identity    → weight 1x
 *   anon = No Nostr identity                    → weight 0
 */

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import {
  OWNER_PUBKEY_HEX,
  KIND_FOLLOW_LIST,
  APP_RELAY_URLS,
} from '@/lib/constants';
import { useAdminAccess } from '@/hooks/useAdminAccess';

export type WoTLevel = 0 | 1 | 2 | 3;

export interface WoTData {
  /** Set of pubkeys the owner/admins directly follow (level 1) */
  level1: Set<string>;
  /** Set of pubkeys followed by level 1 users (level 2) */
  level2: Set<string>;
  /** The admin/mod pubkeys used as trust anchors */
  anchors: string[];
}

const EMPTY_WOT: WoTData = {
  level1: new Set(),
  level2: new Set(),
  anchors: [OWNER_PUBKEY_HEX],
};

/**
 * Build the WoT graph from the owner + admin follow lists.
 * This queries kind:3 events to build a 2-level trust graph.
 */
export function useWoT() {
  const { nostr } = useNostr();
  const { adminList, modList } = useAdminAccess();

  // All trust anchors: owner + admins + mods
  const anchors = [OWNER_PUBKEY_HEX, ...adminList, ...modList];
  const anchorKey = anchors.sort().join(',');

  return useQuery({
    queryKey: ['wot-graph', anchorKey],
    queryFn: async (): Promise<WoTData> => {
      try {
        // Step 1: Fetch follow lists for all trust anchors
        const relayGroup = nostr.group(APP_RELAY_URLS);
        const anchorFollowEvents = await relayGroup.query([
          {
            kinds: [KIND_FOLLOW_LIST],
            authors: anchors,
            limit: anchors.length,
          },
        ]);

        // Deduplicate: keep latest per author
        const latestByAuthor = new Map<string, string[][]>();
        for (const ev of anchorFollowEvents) {
          const existing = latestByAuthor.get(ev.pubkey);
          if (!existing) {
            latestByAuthor.set(ev.pubkey, ev.tags);
          }
        }

        // Extract level 1 pubkeys (directly followed by anchors)
        const level1 = new Set<string>();
        for (const tags of latestByAuthor.values()) {
          for (const tag of tags) {
            if (tag[0] === 'p' && tag[1] && tag[1].length === 64) {
              level1.add(tag[1]);
            }
          }
        }

        // Step 2: Fetch follow lists for level 1 users (sample for performance)
        // Only fetch a subset to avoid overloading — pick up to 50 most relevant
        const level1Sample = [...level1].slice(0, 50);
        const level2 = new Set<string>();

        if (level1Sample.length > 0) {
          const level1Events = await relayGroup.query([
            {
              kinds: [KIND_FOLLOW_LIST],
              authors: level1Sample,
              limit: level1Sample.length,
            },
          ]);

          for (const ev of level1Events) {
            for (const tag of ev.tags) {
              if (tag[0] === 'p' && tag[1] && tag[1].length === 64) {
                // Only add if not already in level 1
                if (!level1.has(tag[1]) && !anchors.includes(tag[1])) {
                  level2.add(tag[1]);
                }
              }
            }
          }
        }

        return { level1, level2, anchors };
      } catch (err) {
        console.warn('[WoT] Failed to build trust graph:', err);
        return EMPTY_WOT;
      }
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 60,    // 1 hour
    retry: 1,
  });
}

/**
 * Get the WoT level for a specific pubkey.
 */
export function getWoTLevel(pubkey: string, wot: WoTData): WoTLevel {
  if (pubkey === OWNER_PUBKEY_HEX || wot.anchors.includes(pubkey)) return 0;
  if (wot.level1.has(pubkey)) return 1;
  if (wot.level2.has(pubkey)) return 2;
  return 3;
}

/**
 * Get the vote weight multiplier for a WoT level.
 */
export function getWoTWeight(level: WoTLevel): number {
  switch (level) {
    case 0: return 5;
    case 1: return 3;
    case 2: return 2;
    case 3: return 1;
  }
}

/**
 * Human-readable WoT level label.
 */
export function getWoTLabel(level: WoTLevel): string {
  switch (level) {
    case 0: return 'Trusted (App Team)';
    case 1: return 'Inner Circle';
    case 2: return 'Extended Network';
    case 3: return 'Community';
  }
}

/**
 * Color for WoT level badges.
 */
export function getWoTColor(level: WoTLevel): string {
  switch (level) {
    case 0: return 'text-yellow-500 bg-yellow-500/15 border-yellow-500/30';
    case 1: return 'text-violet-500 bg-violet-500/15 border-violet-500/30';
    case 2: return 'text-blue-500 bg-blue-500/15 border-blue-500/30';
    case 3: return 'text-muted-foreground bg-muted border-border';
  }
}
