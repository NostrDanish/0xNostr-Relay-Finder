/**
 * NIP-51 Relay Sets and Favorite Lists
 *
 * Supports user-curated relay collections and personal favorite relays.
 *
 * Event kinds:
 * - kind:30002 — Relay sets (addressable, user-defined groups)
 * - kind:10012 — Favorite relays list (replaceable, user's favorites)
 *
 * These allow users to share relay recommendations and organize their
 * own relay collections.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import {
  KIND_RELAY_SET,
  KIND_FAVORITE_RELAYS,
  APP_RELAY_URLS,
} from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RelaySet {
  id: string;
  authorPubkey: string;
  title: string;
  description?: string;
  image?: string;
  relays: string[];
  createdAt: number;
  updatedAt: number;
  rawEvent: NostrEvent;
}

export interface FavoriteRelays {
  pubkey: string;
  relays: string[];
  relaySetRefs: string[];
  updatedAt: number;
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseRelaySet(event: NostrEvent): RelaySet | null {
  const dTag = event.tags.find(([t]) => t === 'd')?.[1];
  if (!dTag) return null;

  const title = event.tags.find(([t]) => t === 'title')?.[1] ?? dTag;
  const description = event.tags.find(([t]) => t === 'description')?.[1];
  const image = event.tags.find(([t]) => t === 'image')?.[1];
  const relays = event.tags.filter(([t]) => t === 'relay').map(([, r]) => r);

  return {
    id: dTag,
    authorPubkey: event.pubkey,
    title,
    description,
    image,
    relays,
    createdAt: event.created_at * 1000,
    updatedAt: event.created_at * 1000,
    rawEvent: event,
  };
}

function parseFavoriteRelays(event: NostrEvent): FavoriteRelays | null {
  const relays = event.tags.filter(([t]) => t === 'relay').map(([, r]) => r);
  const relaySetRefs = event.tags.filter(([t]) => t === 'a').map(([, a]) => a);

  return {
    pubkey: event.pubkey,
    relays,
    relaySetRefs,
    updatedAt: event.created_at * 1000,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetch all relay sets from the network.
 */
export function useRelaySets(limit = 50) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['relay-sets', limit],
    queryFn: async () => {
      const relayGroup = nostr.group(APP_RELAY_URLS);
      const events = await relayGroup.query([
        {
          kinds: [KIND_RELAY_SET],
          limit,
        },
      ]);

      const sets = events
        .map(parseRelaySet)
        .filter((s): s is RelaySet => s !== null);

      // Deduplicate by author+id (keep latest)
      const byAuthorId = new Map<string, RelaySet>();
      for (const set of sets) {
        const key = `${set.authorPubkey}:${set.id}`;
        const existing = byAuthorId.get(key);
        if (!existing || set.updatedAt > existing.updatedAt) {
          byAuthorId.set(key, set);
        }
      }

      return Array.from(byAuthorId.values()).sort(
        (a, b) => b.updatedAt - a.updatedAt
      );
    },
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Fetch relay sets created by the current user.
 */
export function useMyRelaySets() {
  const { user } = useCurrentUser();
  const { data: allSets, isLoading } = useRelaySets(200);

  const mySets = allSets?.filter((s) => s.authorPubkey === user?.pubkey) ?? [];

  return { sets: mySets, isLoading };
}

/**
 * Fetch the current user's favorite relays (kind:10012).
 */
export function useFavoriteRelays() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['favorite-relays', user?.pubkey],
    queryFn: async () => {
      if (!user) return null;

      const relayGroup = nostr.group(APP_RELAY_URLS);
      const events = await relayGroup.query([
        {
          kinds: [KIND_FAVORITE_RELAYS],
          authors: [user.pubkey],
          limit: 1,
        },
      ]);

      if (events.length === 0) return null;

      return parseFavoriteRelays(events[0]);
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Check if a relay is in the user's favorites.
 */
export function useIsFavorite(relayUrl: string) {
  const { data: favorites } = useFavoriteRelays();
  return favorites?.relays.includes(relayUrl) ?? false;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Create or update a relay set.
 */
export function usePublishRelaySet() {
  const { mutate: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      title: string;
      description?: string;
      image?: string;
      relays: string[];
    }) => {
      if (!user) throw new Error('Must be logged in to create relay sets');

      const tags: string[][] = [
        ['d', input.id],
        ['title', input.title],
      ];

      if (input.description) tags.push(['description', input.description]);
      if (input.image) tags.push(['image', input.image]);
      for (const relay of input.relays) {
        tags.push(['relay', relay]);
      }

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: KIND_RELAY_SET,
            content: '',
            tags,
          },
          {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          },
        );
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relay-sets'] });
    },
  });
}

/**
 * Delete a relay set.
 */
export function useDeleteRelaySet() {
  const { mutate: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, authorPubkey }: { id: string; authorPubkey: string }) => {
      return new Promise<void>((resolve, reject) => {
        // Publish a deletion request (kind:5)
        createEvent(
          {
            kind: 5,
            content: 'Deleting relay set',
            tags: [
              ['a', `${KIND_RELAY_SET}:${authorPubkey}:${id}`],
            ],
          },
          {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          },
        );
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relay-sets'] });
    },
  });
}

/**
 * Toggle a relay in the user's favorites list.
 */
export function useToggleFavorite() {
  const { mutate: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { data: favorites } = useFavoriteRelays();

  return useMutation({
    mutationFn: async (relayUrl: string) => {
      if (!user) throw new Error('Must be logged in to manage favorites');

      const currentRelays = favorites?.relays ?? [];
      const isFavorite = currentRelays.includes(relayUrl);

      const newRelays = isFavorite
        ? currentRelays.filter((r) => r !== relayUrl)
        : [...currentRelays, relayUrl];

      const tags = newRelays.map((r) => ['relay', r]);
      // Preserve existing relay set refs
      for (const ref of favorites?.relaySetRefs ?? []) {
        tags.push(['a', ref]);
      }

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: KIND_FAVORITE_RELAYS,
            content: '',
            tags,
          },
          {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          },
        );
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite-relays'] });
    },
  });
}
