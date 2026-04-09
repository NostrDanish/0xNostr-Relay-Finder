import { useState } from 'react';
import { ThumbsUp, Sparkles, Info, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { RelayRecord, VoteTag, CommunityTagVote } from '@/types/relay';
import { ALL_VOTE_TAGS } from '@/types/relay';
import { useRelayVotes } from '@/hooks/useRelayVotes';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const TAG_COLORS: Record<VoteTag, string> = {
  'Best for Images': 'bg-pink-500/15 text-pink-600 dark:text-pink-400 border-pink-500/25 hover:bg-pink-500/25',
  'Best for Video/Blossom': 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/25 hover:bg-purple-500/25',
  'Best for General Chat': 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25 hover:bg-blue-500/25',
  'Best for High-Volume': 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25 hover:bg-orange-500/25',
  'Censorship-Resistant': 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/25',
  'Low-Latency': 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25 hover:bg-yellow-500/25',
  'Free Tier': 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/25 hover:bg-green-500/25',
  'Best for DMs': 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/25 hover:bg-cyan-500/25',
  'Best for Long-Form': 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25 hover:bg-amber-500/25',
  'Best for Zaps': 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/25 hover:bg-yellow-500/25',
  'Best for Developers': 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/25 hover:bg-indigo-500/25',
  'Best for Communities': 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/25 hover:bg-teal-500/25',
  'Privacy Focused': 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/25 hover:bg-slate-500/25',
  'High Reliability': 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25 hover:bg-sky-500/25',
};

const ACTIVE_TAG_COLORS: Record<VoteTag, string> = {
  'Best for Images': 'bg-pink-500 text-white border-pink-500',
  'Best for Video/Blossom': 'bg-purple-500 text-white border-purple-500',
  'Best for General Chat': 'bg-blue-500 text-white border-blue-500',
  'Best for High-Volume': 'bg-orange-500 text-white border-orange-500',
  'Censorship-Resistant': 'bg-emerald-500 text-white border-emerald-500',
  'Low-Latency': 'bg-yellow-500 text-white border-yellow-500',
  'Free Tier': 'bg-green-500 text-white border-green-500',
  'Best for DMs': 'bg-cyan-500 text-white border-cyan-500',
  'Best for Long-Form': 'bg-amber-500 text-white border-amber-500',
  'Best for Zaps': 'bg-yellow-500 text-white border-yellow-500',
  'Best for Developers': 'bg-indigo-500 text-white border-indigo-500',
  'Best for Communities': 'bg-teal-500 text-white border-teal-500',
  'Privacy Focused': 'bg-slate-500 text-white border-slate-500',
  'High Reliability': 'bg-sky-500 text-white border-sky-500',
};

interface VotingPanelProps {
  relay: RelayRecord;
}

export function VotingPanel({ relay }: VotingPanelProps) {
  const { user } = useCurrentUser();
  const { hasVoted, castVote, removeVote, justVoted, computeAggregated } = useRelayVotes(
    relay.url,
    user?.pubkey
  );
  const [showAll, setShowAll] = useState(false);

  const aggregated = computeAggregated(relay.communityTags);
  const topTags = aggregated.slice(0, showAll ? undefined : 8);
  const totalVotes = aggregated.reduce((s, t) => s + t.upvotes, 0);

  const handleVote = (tag: VoteTag) => {
    if (!user) return;
    if (hasVoted(tag)) removeVote(tag);
    else castVote(tag);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ThumbsUp className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Community Votes</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">
                  Nostr-logged-in users can vote once per tag. Votes are public and tied to your Nostr identity.
                  Community votes influence the relay's discovery ranking.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        {totalVotes > 0 && (
          <span className="text-xs text-muted-foreground">{totalVotes} total votes</span>
        )}
      </div>

      {/* Login prompt */}
      {!user && (
        <div className="flex items-center gap-2 bg-muted/40 border border-border/40 rounded-lg px-3 py-2.5 text-sm text-muted-foreground">
          <LogIn className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Log in with Nostr to vote on tags for this relay.</span>
        </div>
      )}

      {/* Aggregated top tags with progress bars */}
      {aggregated.length > 0 && (
        <div className="space-y-2">
          {topTags.map(({ tag, upvotes, percent }) => (
            <div key={tag} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <button
                  onClick={() => handleVote(tag as VoteTag)}
                  disabled={!user}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition-all text-xs',
                    hasVoted(tag as VoteTag)
                      ? ACTIVE_TAG_COLORS[tag as VoteTag]
                      : TAG_COLORS[tag as VoteTag],
                    !user && 'opacity-60 cursor-not-allowed',
                    user && 'cursor-pointer',
                    justVoted === tag && 'scale-105'
                  )}
                >
                  {hasVoted(tag as VoteTag) && <ThumbsUp className="w-2.5 h-2.5" />}
                  {tag}
                </button>
                <span className="text-muted-foreground font-semibold">
                  {upvotes} <span className="font-normal opacity-70">({percent}%)</span>
                </span>
              </div>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary/50 rounded-full transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          ))}
          {aggregated.length > 8 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-primary hover:underline"
            >
              {showAll ? 'Show less' : `+${aggregated.length - 8} more tags`}
            </button>
          )}
        </div>
      )}

      {/* All voteable tags when logged in */}
      {user && (
        <div>
          <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Click to vote for tags (click again to remove)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_VOTE_TAGS.filter((tag) => !aggregated.some((a) => a.tag === tag)).map((tag) => (
              <button
                key={tag}
                onClick={() => handleVote(tag as VoteTag)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium text-xs transition-all',
                  hasVoted(tag as VoteTag)
                    ? ACTIVE_TAG_COLORS[tag as VoteTag]
                    : TAG_COLORS[tag as VoteTag],
                  'cursor-pointer hover:scale-105',
                  justVoted === tag && 'scale-110 shadow-lg'
                )}
              >
                {hasVoted(tag as VoteTag) && <ThumbsUp className="w-2.5 h-2.5" />}
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Just-voted celebration */}
      {justVoted && (
        <div className="flex items-center gap-2 text-xs text-emerald-500 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Voted <strong>"{justVoted}"</strong> — thanks! Your vote is recorded.</span>
        </div>
      )}
    </div>
  );
}

/** Compact community tag display for relay cards */
export function CommunityTagsCompact({ tags }: { tags: CommunityTagVote[] }) {
  if (!tags.length) return null;
  const top = tags.slice(0, 3);

  return (
    <div className="flex flex-wrap gap-1">
      {top.map(({ tag, percent }) => (
        <TooltipProvider key={tag}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border text-xs px-2 py-0.5 font-medium cursor-help',
                  TAG_COLORS[tag as VoteTag] ?? 'bg-muted text-muted-foreground border-border'
                )}
              >
                <ThumbsUp className="w-2.5 h-2.5" />
                {tag}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Community voted: <strong>{percent}%</strong> say {tag}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}
