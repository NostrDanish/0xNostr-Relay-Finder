/**
 * NIP-89 App Handler Discovery
 *
 * Allows users to discover apps that can handle specific event kinds.
 * When a user encounters an unknown event kind, the app can query
 * kind:31989 (recommendations) and kind:31990 (handler info) to find
 * compatible apps.
 *
 * This is used to make the relay finder interoperable with other Nostr
 * apps — e.g., if a relay specializes in NIP-99 marketplace events,
 * we can recommend apps that handle that kind.
 */

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { APP_RELAY_URLS } from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppHandler {
  /** App's pubkey */
  appPubkey: string;
  /** App's d-identifier */
  appId: string;
  /** Supported event kind */
  kind: number;
  /** Platform (web, ios, android) */
  platform?: string;
  /** Relay hint */
  relayHint?: string;
  /** App metadata from kind:0 */
  name?: string;
  about?: string;
  website?: string;
  picture?: string;
}

export interface AppRecommendation {
  /** Recommender's pubkey */
  recommenderPubkey: string;
  /** Supported event kind */
  kind: number;
  /** Recommended apps */
  apps: {
    appPubkey: string;
    appId: string;
    relayHint?: string;
    platform?: string;
  }[];
  /** When published */
  createdAt: number;
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseHandlerEvent(event: NostrEvent): AppHandler | null {
  const dTag = event.tags.find(([t]) => t === 'd')?.[1];
  const kTags = event.tags.filter(([t]) => t === 'k').map(([, k]) => parseInt(k)).filter((k) => !isNaN(k));

  if (!dTag || kTags.length === 0) return null;

  // Parse metadata from content
  let name: string | undefined;
  let about: string | undefined;
  let website: string | undefined;
  let picture: string | undefined;

  try {
    if (event.content) {
      const metadata = JSON.parse(event.content) as {
        name?: string;
        about?: string;
        website?: string;
        picture?: string;
      };
      name = metadata.name;
      about = metadata.about;
      website = metadata.website;
      picture = metadata.picture;
    }
  } catch {
    // ignore parse errors
  }

  return {
    appPubkey: event.pubkey,
    appId: dTag,
    kind: kTags[0],
    name,
    about,
    website,
    picture,
  };
}

function parseRecommendationEvent(event: NostrEvent): AppRecommendation | null {
  const dTag = event.tags.find(([t]) => t === 'd')?.[1];
  if (!dTag) return null;

  const kind = parseInt(dTag);
  if (isNaN(kind)) return null;

  const apps = event.tags
    .filter(([t]) => t === 'a')
    .map(([, addr, relay, platform]) => {
      // Parse address: kind:pubkey:d-identifier
      const parts = addr.split(':');
      if (parts.length < 3) return null;
      return {
        appPubkey: parts[1],
        appId: parts.slice(2).join(':'),
        relayHint: relay,
        platform,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  return {
    recommenderPubkey: event.pubkey,
    kind,
    apps,
    createdAt: event.created_at * 1000,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetch app handlers for a specific event kind.
 */
export function useAppHandlers(kind: number) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['app-handlers', kind],
    queryFn: async () => {
      const relayGroup = nostr.group(APP_RELAY_URLS);

      // Query kind:31990 handler events
      const handlerEvents = await relayGroup.query([
        {
          kinds: [31990],
          '#k': [String(kind)],
          limit: 20,
        },
      ]);

      const handlers = handlerEvents
        .map(parseHandlerEvent)
        .filter((h): h is AppHandler => h !== null);

      // Fetch metadata for each handler
      const withMetadata = await Promise.all(
        handlers.map(async (handler) => {
          try {
            const metadataEvents = await relayGroup.query([
              { kinds: [0], authors: [handler.appPubkey], limit: 1 },
            ]);
            if (metadataEvents.length > 0) {
              const metadata = JSON.parse(metadataEvents[0].content) as {
                name?: string;
                about?: string;
                website?: string;
                picture?: string;
              };
              return { ...handler, ...metadata };
            }
          } catch {
            // ignore metadata fetch errors
          }
          return handler;
        }),
      );

      return withMetadata;
    },
    staleTime: 1000 * 60 * 30,
  });
}

/**
 * Fetch app recommendations from the user's follows for a specific kind.
 */
export function useAppRecommendations(kind: number, userPubkeys: string[]) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['app-recommendations', kind, userPubkeys.join(',')],
    queryFn: async () => {
      if (userPubkeys.length === 0) return [];

      const relayGroup = nostr.group(APP_RELAY_URLS);
      const events = await relayGroup.query([
        {
          kinds: [31989],
          '#d': [String(kind)],
          authors: userPubkeys,
          limit: 20,
        },
      ]);

      return events
        .map(parseRecommendationEvent)
        .filter((r): r is AppRecommendation => r !== null);
    },
    enabled: userPubkeys.length > 0,
    staleTime: 1000 * 60 * 15,
  });
}

/**
 * Fetch handler info for a specific app (kind:31990).
 */
export function useAppHandlerInfo(appPubkey: string, appId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['app-handler-info', appPubkey, appId],
    queryFn: async () => {
      const relayGroup = nostr.group(APP_RELAY_URLS);
      const events = await relayGroup.query([
        {
          kinds: [31990],
          authors: [appPubkey],
          '#d': [appId],
          limit: 1,
        },
      ]);

      if (events.length === 0) return null;

      return parseHandlerEvent(events[0]);
    },
    staleTime: 1000 * 60 * 30,
  });
}
