import { useState, useCallback, useEffect } from 'react';
import type { VoteTag, LocalVote, CommunityTagVote } from '@/types/relay';
import { ALL_VOTE_TAGS } from '@/types/relay';

const VOTES_KEY = '0x_relay_votes';

function loadVotes(): LocalVote[] {
  try {
    const raw = localStorage.getItem(VOTES_KEY);
    return raw ? (JSON.parse(raw) as LocalVote[]) : [];
  } catch {
    return [];
  }
}

function saveVotes(votes: LocalVote[]) {
  localStorage.setItem(VOTES_KEY, JSON.stringify(votes));
}

/**
 * Manages user votes for relay community tags.
 * Votes are persisted to localStorage; in production they'd sync to Supabase.
 */
export function useRelayVotes(relayUrl: string, voterPubkey?: string) {
  const [allVotes, setAllVotes] = useState<LocalVote[]>([]);
  const [justVoted, setJustVoted] = useState<VoteTag | null>(null);

  useEffect(() => {
    setAllVotes(loadVotes());
  }, []);

  // All votes for THIS relay (from all users)
  const relayVotes = allVotes.filter((v) => v.relayUrl === relayUrl);

  // Votes cast by the current user for this relay
  const myVotes = relayVotes.filter(
    (v) => voterPubkey && v.voterPubkey === voterPubkey
  );

  const hasVoted = useCallback(
    (tag: VoteTag) => myVotes.some((v) => v.tag === tag),
    [myVotes]
  );

  const castVote = useCallback(
    (tag: VoteTag) => {
      const existing = allVotes.find(
        (v) => v.relayUrl === relayUrl && v.tag === tag && v.voterPubkey === (voterPubkey ?? 'anon')
      );
      if (existing) return; // already voted

      const newVote: LocalVote = {
        relayUrl,
        tag,
        voterPubkey: voterPubkey ?? 'anon',
        votedAt: Date.now(),
      };

      const updated = [...allVotes, newVote];
      setAllVotes(updated);
      saveVotes(updated);
      setJustVoted(tag);
      setTimeout(() => setJustVoted(null), 2500);
    },
    [allVotes, relayUrl, voterPubkey]
  );

  const removeVote = useCallback(
    (tag: VoteTag) => {
      const updated = allVotes.filter(
        (v) =>
          !(
            v.relayUrl === relayUrl &&
            v.tag === tag &&
            v.voterPubkey === (voterPubkey ?? 'anon')
          )
      );
      setAllVotes(updated);
      saveVotes(updated);
    },
    [allVotes, relayUrl, voterPubkey]
  );

  /**
   * Compute aggregated community tag votes by merging:
   * 1. Seed data community tags (from RelayRecord.communityTags)
   * 2. Live localStorage votes for this relay
   */
  const computeAggregated = useCallback(
    (seedTags: CommunityTagVote[] = []): CommunityTagVote[] => {
      const map = new Map<VoteTag, number>();

      // Start with seed votes
      for (const st of seedTags) {
        map.set(st.tag, st.upvotes);
      }

      // Add localStorage votes
      for (const v of relayVotes) {
        map.set(v.tag, (map.get(v.tag) ?? 0) + 1);
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
    [relayVotes]
  );

  return {
    myVotes,
    hasVoted,
    castVote,
    removeVote,
    justVoted,
    relayVoteCount: relayVotes.length,
    computeAggregated,
  };
}
