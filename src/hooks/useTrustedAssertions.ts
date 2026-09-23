/**
 * NIP-85 Trusted Assertions
 *
 * Integrates WoT-based trust scoring from external service providers.
 * These are addressable events (kinds 30382-30385) published by trusted
 * services that compute reputation metrics we can't calculate client-side.
 *
 * We consume:
 * - kind:30382 (User rank) — for relay operator trust scoring
 * - kind:30384 (Addressable rank) — for relay submission trust scoring
 * - kind:30385 (External identifier rank) — for relay URL trust scoring
 *
 * The user's preferred providers come from their kind:10040 list,
 * or fall back to the app's default trusted providers.
 */

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  KIND_TRUSTED_ASSERTION_USER,
  KIND_TRUSTED_ASSERTION_ADDRESSABLE,
  KIND_TRUSTED_ASSERTION_EXTERNAL,
  KIND_TRUSTED_PROVIDERS,
  APP_RELAY_URLS,
} from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrustedProvider {
  /** The kind+tag combo this provider covers (e.g., "30382:rank") */
  kindTag: string;
  /** Provider's service pubkey */
  pubkey: string;
  /** Relay where assertions can be found */
  relayHint: string;
  /** Human-readable name from kind:0 */
  name?: string;
  /** Website from kind:0 */
  website?: string;
}

export interface TrustedAssertion {
  /** Subject of the assertion */
  subject: string;
  /** Provider's pubkey */
  providerPubkey: string;
  /** Kind of assertion (30382, 30383, 30384, 30385) */
  kind: number;
  /** Assertion result type (rank, followers, etc.) */
  resultType: string;
  /** Assertion value */
  value: string;
  /** When published */
  createdAt: number;
  /** Raw event */
  event: NostrEvent;
}

export interface RelayTrustScore {
  /** 0-100 trust score from trusted assertion providers */
  score?: number;
  /** Provider that produced this score */
  providerPubkey?: string;
  /** Provider name */
  providerName?: string;
  /** All available scores from different providers */
  allScores: { provider: string; score: number; relay: string }[];
}

// ─── Default trusted providers (fallback) ─────────────────────────────────────

const DEFAULT_TRUSTED_PROVIDERS: TrustedProvider[] = [
  {
    kindTag: '30382:rank',
    pubkey: '4fd5e210530e4f6b2cb083795834bfe5108324f1ed9f00ab73b9e8fcfe5f12fe',
    relayHint: 'wss://nip85.nostr.band',
    name: 'nostr.band Rank',
    website: 'https://nostr.band',
  },
  {
    kindTag: '30384:rank',
    pubkey: '4fd5e210530e4f6b2cb083795834bfe5108324f1ed9f00ab73b9e8fcfe5f12fe',
    relayHint: 'wss://nip85.nostr.band',
    name: 'nostr.band Rank',
    website: 'https://nostr.band',
  },
];

// ─── Provider discovery ───────────────────────────────────────────────────────

/**
 * Fetch the user's trusted assertion providers (kind:10040).
 * Falls back to app defaults if user hasn't configured any.
 */
export function useTrustedProviders() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['trusted-providers', user?.pubkey],
    queryFn: async () => {
      if (!user) return DEFAULT_TRUSTED_PROVIDERS;

      // The user's kind:10040 provider list lives on THEIR relays, not the
      // app relay group — query the full pool (app relays + user relays).
      const events = await nostr.query([
        {
          kinds: [KIND_TRUSTED_PROVIDERS],
          authors: [user.pubkey],
          limit: 1,
        },
      ]);

      if (events.length === 0) return DEFAULT_TRUSTED_PROVIDERS;

      // Use the newest provider list (replaceable event)
      const event = events.reduce((a, b) => (b.created_at > a.created_at ? b : a));
      const providers: TrustedProvider[] = [];

      for (const tag of event.tags) {
        const [kindTag, pubkey, relay] = tag;
        if (kindTag && pubkey && relay) {
          providers.push({ kindTag, pubkey, relayHint: relay });
        }
      }

      // Also check for encrypted content (NIP-44)
      if (event.content && event.content.length > 0) {
        try {
          // Note: NIP-44 decryption requires the user's signer
          // For now we only support public providers in tags
          // TODO: Add NIP-44 decryption when signer is available
        } catch {
          // ignore encrypted content errors
        }
      }

      return providers.length > 0 ? providers : DEFAULT_TRUSTED_PROVIDERS;
    },
    staleTime: 1000 * 60 * 15,
  });
}

/**
 * Fetch provider metadata (kind:0) for a given service pubkey.
 */
export function useProviderMetadata(providerPubkey: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['provider-metadata', providerPubkey],
    queryFn: async () => {
      const relayGroup = nostr.group(APP_RELAY_URLS);
      const events = await relayGroup.query([
        { kinds: [0], authors: [providerPubkey], limit: 1 },
      ]);

      if (events.length === 0) return null;

      try {
        const metadata = JSON.parse(events[0].content) as {
          name?: string;
          about?: string;
          website?: string;
          picture?: string;
        };
        return metadata;
      } catch {
        return null;
      }
    },
    staleTime: 1000 * 60 * 30,
  });
}

// ─── Assertion queries ────────────────────────────────────────────────────────

/** Minimal structural type for the nostr client (avoids depending on pool generics). */
interface NostrQuerier {
  group(urls: string[]): {
    query(filters: NostrFilter[], opts?: { signal?: AbortSignal }): Promise<NostrEvent[]>;
  };
}

/**
 * Fetch assertions of `kind` with d-tag `dTagValue` from each provider,
 * querying the provider's own relayHint in addition to the app relays
 * (NIP-85 assertions live on the provider's relay, e.g. wss://nip85.nostr.band).
 *
 * Assertions are deduplicated to the newest event per (provider pubkey, d)
 * before scores are compared. Tracks the real provider pubkey.
 */
async function fetchAssertionScores(
  nostr: NostrQuerier,
  providers: TrustedProvider[],
  kind: number,
  dTagValue: string,
): Promise<RelayTrustScore> {
  const perProvider = await Promise.all(
    providers.map(async (provider) => {
      try {
        const group = nostr.group([provider.relayHint, ...APP_RELAY_URLS]);
        return await group.query([
          {
            kinds: [kind],
            authors: [provider.pubkey],
            '#d': [dTagValue],
            limit: 20,
          },
        ]);
      } catch {
        return [] as NostrEvent[];
      }
    }),
  );

  // Dedup to the newest assertion per (provider pubkey, d)
  const latestByProviderD = new Map<string, NostrEvent>();
  for (const ev of perProvider.flat()) {
    const d = ev.tags.find(([t]) => t === 'd')?.[1] ?? '';
    const key = `${ev.pubkey}:${d}`;
    const existing = latestByProviderD.get(key);
    if (!existing || ev.created_at > existing.created_at) {
      latestByProviderD.set(key, ev);
    }
  }

  const allScores: RelayTrustScore['allScores'] = [];
  let bestScore: number | undefined;
  let bestProviderPubkey: string | undefined;
  let bestProviderName: string | undefined;

  for (const event of latestByProviderD.values()) {
    const provider = providers.find((p) => p.pubkey === event.pubkey);
    if (!provider) continue;

    // Look for rank tag
    const rankTag = event.tags.find(([t]) => t === 'rank');
    if (!rankTag) continue;

    const score = parseInt(rankTag[1]);
    if (isNaN(score) || score < 0 || score > 100) continue;

    allScores.push({
      provider: provider.name ?? event.pubkey.slice(0, 8),
      score,
      relay: provider.relayHint,
    });

    // Keep highest score — track the REAL provider pubkey (not the display name)
    if (bestScore === undefined || score > bestScore) {
      bestScore = score;
      bestProviderPubkey = event.pubkey;
      bestProviderName = provider.name ?? event.pubkey.slice(0, 8);
    }
  }

  return {
    score: bestScore,
    providerPubkey: bestProviderPubkey,
    providerName: bestProviderName,
    allScores,
  };
}

/**
 * Fetch trusted assertions for a relay URL.
 * Uses kind:30385 (external identifier) for URL-based trust scores.
 */
export function useRelayTrustScore(relayUrl: string) {
  const { nostr } = useNostr();
  const { data: providers } = useTrustedProviders();

  return useQuery({
    queryKey: ['relay-trust-score', relayUrl],
    queryFn: async () => {
      if (!providers || providers.length === 0) {
        return { score: undefined, allScores: [] } as RelayTrustScore;
      }

      // Query kind:30385 for external identifier assertions about this relay URL
      // The d tag should be the relay URL
      return fetchAssertionScores(nostr, providers, KIND_TRUSTED_ASSERTION_EXTERNAL, relayUrl);
    },
    enabled: !!providers,
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Fetch trusted assertions for a relay operator pubkey.
 * Uses kind:30382 (user rank).
 */
export function useOperatorTrustScore(operatorPubkey: string) {
  const { nostr } = useNostr();
  const { data: providers } = useTrustedProviders();

  return useQuery({
    queryKey: ['operator-trust-score', operatorPubkey],
    queryFn: async () => {
      if (!providers || providers.length === 0) {
        return { score: undefined, allScores: [] } as RelayTrustScore;
      }

      return fetchAssertionScores(nostr, providers, KIND_TRUSTED_ASSERTION_USER, operatorPubkey);
    },
    enabled: !!providers,
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Fetch trusted assertions for a relay submission event (kind:30078).
 * Uses kind:30384 (addressable event rank).
 */
export function useSubmissionTrustScore(submissionAddress: string) {
  const { nostr } = useNostr();
  const { data: providers } = useTrustedProviders();

  return useQuery({
    queryKey: ['submission-trust-score', submissionAddress],
    queryFn: async () => {
      if (!providers || providers.length === 0) {
        return { score: undefined, allScores: [] } as RelayTrustScore;
      }

      return fetchAssertionScores(nostr, providers, KIND_TRUSTED_ASSERTION_ADDRESSABLE, submissionAddress);
    },
    enabled: !!providers,
    staleTime: 1000 * 60 * 10,
  });
}
