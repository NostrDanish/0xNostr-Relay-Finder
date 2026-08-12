/**
 * NIP-32 Labeling for Relays
 *
 * Supports labeling relays with trust scores, categories, and quality
 * assessments. Labels can come from:
 * 1. Trusted moderators (authoritative labels)
 * 2. NIP-85 trusted assertion providers
 * 3. Self-reported labels from relay operators
 *
 * Label namespaces:
 * - `ugc` (user-generated content)
 * - `com.0xrelayfinder.trust` (trust scores 0-100)
 * - `com.0xrelayfinder.category` (use-case categories)
 * - `social.nos.ontology` (NS-xxx content moderation labels)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import {
  KIND_LABEL,
  APP_RELAY_URLS,
  OWNER_PUBKEY_HEX,
} from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RelayLabel {
  /** The label namespace (L tag) */
  namespace: string;
  /** The label value (l tag) */
  label: string;
  /** Relay URL being labeled */
  relayUrl: string;
  /** Author of the label event */
  authorPubkey: string;
  /** When the label was published */
  createdAt: number;
  /** Whether this label is from a trusted source (owner/admin) */
  isTrusted: boolean;
  /** Raw event */
  event: NostrEvent;
}

export interface LabelStats {
  /** Total number of labels for this relay */
  totalLabels: number;
  /** Unique label namespaces */
  namespaces: string[];
  /** All labels (deduplicated by namespace+label) */
  labels: RelayLabel[];
  /** Trust score from trusted labels (if any) */
  trustScore?: number;
  /** Category labels */
  categories: string[];
  /** Content moderation labels (NS-xxx) */
  moderationLabels: string[];
}

// ─── Namespace constants ──────────────────────────────────────────────────────

export const LABEL_NAMESPACES = {
  UGC: 'ugc',
  TRUST: 'com.0xrelayfinder.trust',
  CATEGORY: 'com.0xrelayfinder.category',
  MODERATION: 'social.nos.ontology',
} as const;

/** Trusted label authors (owner + admins) */
export const TRUSTED_LABELERS = [OWNER_PUBKEY_HEX];

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseLabelEvent(event: NostrEvent): RelayLabel | null {
  const lTags = event.tags.filter(([t]) => t === 'l');
  const LTags = event.tags.filter(([t]) => t === 'L');
  const rTags = event.tags.filter(([t]) => t === 'r');

  if (lTags.length === 0 || rTags.length === 0) return null;

  const relayUrl = rTags[0][1];
  const namespace = LTags.length > 0 ? LTags[0][1] : LABEL_NAMESPACES.UGC;
  const label = lTags[0][1];

  return {
    namespace,
    label,
    relayUrl,
    authorPubkey: event.pubkey,
    createdAt: event.created_at * 1000,
    isTrusted: TRUSTED_LABELERS.includes(event.pubkey),
    event,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetch all NIP-32 labels for a specific relay.
 */
export function useRelayLabels(relayUrl: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['relay-labels', relayUrl],
    queryFn: async () => {
      const relayGroup = nostr.group(APP_RELAY_URLS);
      const events = await relayGroup.query([
        {
          kinds: [KIND_LABEL],
          '#r': [relayUrl],
          limit: 100,
        },
      ]);

      const labels = events
        .map(parseLabelEvent)
        .filter((l): l is RelayLabel => l !== null);

      // Sort by trusted first, then newest
      labels.sort((a, b) => {
        if (a.isTrusted && !b.isTrusted) return -1;
        if (!a.isTrusted && b.isTrusted) return 1;
        return b.createdAt - a.createdAt;
      });

      return labels;
    },
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch aggregated label stats for a relay.
 */
export function useRelayLabelStats(relayUrl: string) {
  const { data: labels, isLoading } = useRelayLabels(relayUrl);

  const stats: LabelStats = {
    totalLabels: labels?.length ?? 0,
    namespaces: [...new Set(labels?.map((l) => l.namespace) ?? [])],
    labels: labels ?? [],
    trustScore: undefined,
    categories: [],
    moderationLabels: [],
  };

  if (labels) {
    // Extract trust score from trusted labels
    const trustLabel = labels.find(
      (l) => l.isTrusted && l.namespace === LABEL_NAMESPACES.TRUST
    );
    if (trustLabel) {
      const score = parseInt(trustLabel.label);
      if (!isNaN(score) && score >= 0 && score <= 100) {
        stats.trustScore = score;
      }
    }

    // Extract categories
    stats.categories = labels
      .filter((l) => l.namespace === LABEL_NAMESPACES.CATEGORY)
      .map((l) => l.label);

    // Extract moderation labels
    stats.moderationLabels = labels
      .filter((l) => l.namespace === LABEL_NAMESPACES.MODERATION)
      .map((l) => l.label);
  }

  return { stats, isLoading };
}

/**
 * Fetch labels from all trusted labelers across all relays.
 */
export function useTrustedLabels() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['trusted-labels'],
    queryFn: async () => {
      const relayGroup = nostr.group(APP_RELAY_URLS);
      const events = await relayGroup.query([
        {
          kinds: [KIND_LABEL],
          authors: TRUSTED_LABELERS,
          limit: 500,
        },
      ]);

      const labels = events
        .map(parseLabelEvent)
        .filter((l): l is RelayLabel => l !== null);

      // Group by relay URL
      const byRelay = new Map<string, RelayLabel[]>();
      for (const label of labels) {
        const existing = byRelay.get(label.relayUrl) ?? [];
        existing.push(label);
        byRelay.set(label.relayUrl, existing);
      }

      return byRelay;
    },
    staleTime: 1000 * 60 * 10,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export interface CreateLabelInput {
  relayUrl: string;
  namespace: string;
  label: string;
  content?: string;
}

/**
 * Publish a NIP-32 label for a relay.
 */
export function usePublishLabel() {
  const { mutate: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLabelInput) => {
      const tags: string[][] = [
        ['L', input.namespace],
        ['l', input.label, input.namespace],
        ['r', input.relayUrl],
      ];

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: KIND_LABEL,
            content: input.content ?? '',
            tags,
          },
          {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          }
        );
      });
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['relay-labels', input.relayUrl] });
      queryClient.invalidateQueries({ queryKey: ['trusted-labels'] });
    },
  });
}

/**
 * Publish a trust score label (owner/admin only).
 */
export function usePublishTrustScore() {
  const { user } = useCurrentUser();
  const publishLabel = usePublishLabel();

  return useMutation({
    mutationFn: async ({ relayUrl, score }: { relayUrl: string; score: number }) => {
      if (!user || !TRUSTED_LABELERS.includes(user.pubkey)) {
        throw new Error('Only trusted labelers can publish trust scores');
      }
      if (score < 0 || score > 100) {
        throw new Error('Trust score must be 0-100');
      }

      await publishLabel.mutateAsync({
        relayUrl,
        namespace: LABEL_NAMESPACES.TRUST,
        label: String(Math.round(score)),
        content: `Trust score: ${score}/100`,
      });
    },
  });
}

/**
 * Publish a category label.
 */
export function usePublishCategoryLabel() {
  const { user } = useCurrentUser();
  const publishLabel = usePublishLabel();

  return useMutation({
    mutationFn: async ({ relayUrl, category }: { relayUrl: string; category: string }) => {
      if (!user) throw new Error('Must be logged in to label relays');

      await publishLabel.mutateAsync({
        relayUrl,
        namespace: LABEL_NAMESPACES.CATEGORY,
        label: category,
      });
    },
  });
}
