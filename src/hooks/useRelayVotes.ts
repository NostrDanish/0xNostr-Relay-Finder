import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import type { VoteTag, CommunityTagVote } from '@/types/relay';
import { ALL_VOTE_TAGS } from '@/types/relay';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useWoT, getWoTLevel, getWoTWeight, type WoTData } from '@/hooks/useWoT';
import {
  APP_RELAY_URLS,
  KIND_REACTION,
  KIND_RELAY_TAG_PROPOSAL,
  OWNER_PUBKEY_HEX,
} from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NostrVote {
  eventId: string;
  voterPubkey: string;
  relayUrl: string;
  isUpvote: boolean; // true = +, false = -
  tag?: string;      // community tag (from kind:6683 proposals)
  createdAt: number;
}

// ─── Parse helpers ────────────────────────────────────────────────────────────
function parseReactionVote(ev: NostrEvent, relayUrl: string): NostrVote | null {
  // Must reference the relay URL via an `r` tag
  const rTag = ev.tags.find(([t]) => t === 'r')?.[1];
  if (rTag !== relayUrl) return null;

  return {
    eventId: ev.id,
    voterPubkey: ev.pubkey,
    relayUrl,
    isUpvote: ev.content !== '-',
    createdAt: ev.created_at,
  };
}

function parseTagProposal(ev: NostrEvent, relayUrl: string): NostrVote | null {
  const rTag = ev.tags.find(([t]) => t === 'r')?.[1];
  if (rTag !== relayUrl) return null;

  // The proposed tag is in the content
  const tag = ev.content.trim();
  if (!tag) return null;

  return {
    eventId: ev.id,
    voterPubkey: ev.pubkey,
    relayUrl,
    isUpvote: true,
    tag,
    createdAt: ev.created_at,
  };
}

// ─── Main Hook ────────────────────────────────────────────────────────────────
/**
 * Manages relay votes using Nostr events:
 * - kind:7 (NIP-25 reactions) for upvotes/downvotes on the relay
 * - kind:6683 for tag proposals ("this relay is best for DMs")
 *
 * Votes are published to the app relay group and weighted by WoT.
 */
export function useRelayVotes(relayUrl: string, voterPubkey?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { data: wotData } = useWoT();
  const [justVoted, setJustVoted] = useState<VoteTag | null>(null);

  // ── Query existing votes from Nostr ─────────────────────────────────────
  const { data: nostrVotes, isLoading: votesLoading } = useQuery({
    queryKey: ['relay-votes', relayUrl],
    queryFn: async () => {
      const relayGroup = nostr.group(APP_RELAY_URLS);

      // Query reactions and tag proposals for this relay
      const events = await relayGroup.query([
        {
          kinds: [KIND_REACTION, KIND_RELAY_TAG_PROPOSAL],
          '#r': [relayUrl],
          limit: 500,
        },
      ]);

      const reactions: NostrVote[] = [];
      const proposals: NostrVote[] = [];

      for (const ev of events) {
        if (ev.kind === KIND_REACTION) {
          const vote = parseReactionVote(ev, relayUrl);
          if (vote) reactions.push(vote);
        } else if (ev.kind === KIND_RELAY_TAG_PROPOSAL) {
          const vote = parseTagProposal(ev, relayUrl);
          if (vote) proposals.push(vote);
        }
      }

      return { reactions, proposals };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 15,
    retry: 1,
  });

  // ── Compute upvote score (WoT-weighted) ────────────────────────────────
  const upvoteScore = useMemo(() => {
    if (!nostrVotes?.reactions) return 0;
    const wot: WoTData = wotData ?? { level1: new Set(), level2: new Set(), anchors: [OWNER_PUBKEY_HEX] };

    let score = 0;
    for (const vote of nostrVotes.reactions) {
      const level = getWoTLevel(vote.voterPubkey, wot);
      const weight = getWoTWeight(level);
      score += vote.isUpvote ? weight : -weight;
    }
    return score;
  }, [nostrVotes?.reactions, wotData]);

  // ── Compute community tag votes (WoT-weighted) ─────────────────────────
  const computeAggregated = useCallback(
    (seedTags: CommunityTagVote[] = []): CommunityTagVote[] => {
      const wot: WoTData = wotData ?? { level1: new Set(), level2: new Set(), anchors: [OWNER_PUBKEY_HEX] };
      const map = new Map<VoteTag, number>();

      // Start with seed votes
      for (const st of seedTags) {
        map.set(st.tag, st.upvotes);
      }

      // Add Nostr tag proposal votes (WoT-weighted)
      if (nostrVotes?.proposals) {
        for (const vote of nostrVotes.proposals) {
          // Convert proposal tag back to VoteTag format
          const tagStr = vote.tag ?? '';
          const matchedTag = ALL_VOTE_TAGS.find(
            (t) => t.toLowerCase().replace(/\s+/g, '-') === tagStr.toLowerCase() ||
                   t.toLowerCase() === tagStr.toLowerCase()
          );
          if (matchedTag) {
            const level = getWoTLevel(vote.voterPubkey, wot);
            const weight = getWoTWeight(level);
            map.set(matchedTag, (map.get(matchedTag) ?? 0) + weight);
          }
        }
      }

      const totalVotes = Array.from(map.values()).reduce((a, b) => a + b, 0) || 1;

      return ALL_VOTE_TAGS.filter((tag) => map.has(tag))
        .map((tag) => ({
          tag,
          upvotes: map.get(tag) ?? 0,
          percent: Math.round(((map.get(tag) ?? 0) / totalVotes) * 100),
        }))
        .sort((a, b) => b.upvotes - a.upvotes);
    },
    [nostrVotes?.proposals, wotData]
  );

  // ── Check if current user has voted ─────────────────────────────────────
  const hasVoted = useCallback(
    (tag: VoteTag) => {
      if (!voterPubkey || !nostrVotes?.proposals) return false;
      const tagKebab = tag.toLowerCase().replace(/\s+/g, '-');
      return nostrVotes.proposals.some(
        (v) => v.voterPubkey === voterPubkey &&
          (v.tag?.toLowerCase().replace(/\s+/g, '-') === tagKebab ||
           v.tag?.toLowerCase() === tag.toLowerCase())
      );
    },
    [nostrVotes?.proposals, voterPubkey]
  );

  const hasUpvoted = useMemo(() => {
    if (!voterPubkey || !nostrVotes?.reactions) return false;
    return nostrVotes.reactions.some((v) => v.voterPubkey === voterPubkey && v.isUpvote);
  }, [nostrVotes?.reactions, voterPubkey]);

  // ── Publish vote mutations ──────────────────────────────────────────────
  const { mutate: publishUpvote, isPending: upvoting } = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not logged in');

      const event = await user.signer.signEvent({
        kind: KIND_REACTION,
        content: '+',
        tags: [
          ['r', relayUrl],
          ['t', '0xrelayfinder-vote'],
          ['alt', `Upvote for relay ${relayUrl}`],
        ],
        created_at: Math.floor(Date.now() / 1000),
      });

      const relayGroup = nostr.group(APP_RELAY_URLS);
      await relayGroup.event(event);
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relay-votes', relayUrl] });
    },
  });

  const { mutate: publishTagVote, isPending: tagVoting } = useMutation({
    mutationFn: async (tag: VoteTag) => {
      if (!user) throw new Error('Not logged in');

      const tagKebab = tag.toLowerCase().replace(/\s+/g, '-');

      const event = await user.signer.signEvent({
        kind: KIND_RELAY_TAG_PROPOSAL,
        content: tagKebab,
        tags: [
          ['r', relayUrl],
          ['t', 'relay-tag-proposal'],
          ['t', tagKebab],
          ['alt', `Relay tag proposal: ${tag} for ${relayUrl}`],
        ],
        created_at: Math.floor(Date.now() / 1000),
      });

      const relayGroup = nostr.group(APP_RELAY_URLS);
      await relayGroup.event(event);
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relay-votes', relayUrl] });
    },
  });

  // ── Convenience wrappers ────────────────────────────────────────────────
  const castVote = useCallback(
    (tag: VoteTag) => {
      if (!user) return;
      publishTagVote(tag);
      setJustVoted(tag);
      setTimeout(() => setJustVoted(null), 2500);
    },
    [user, publishTagVote]
  );

  const castUpvote = useCallback(() => {
    if (!user) return;
    publishUpvote();
  }, [user, publishUpvote]);

  // Note: "removing" a vote isn't possible with Nostr events (they're immutable)
  // Instead, we just don't show the option to vote again
  const removeVote = useCallback((_tag: VoteTag) => {
    // No-op — Nostr events are immutable
    // In the future, could publish a NIP-09 deletion event
  }, []);

  return {
    myVotes: nostrVotes?.proposals.filter((v) => v.voterPubkey === voterPubkey) ?? [],
    hasVoted,
    hasUpvoted,
    castVote,
    castUpvote,
    removeVote,
    justVoted,
    relayVoteCount: nostrVotes?.reactions.length ?? 0,
    upvoteScore,
    computeAggregated,
    votesLoading,
    isPublishing: upvoting || tagVoting,
  };
}
