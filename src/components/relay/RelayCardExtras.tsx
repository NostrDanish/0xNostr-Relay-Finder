/**
 * NIP-51 Favorite Button + Trust Badges for Relay Cards
 *
 * Compact components for adding favorites and displaying trust scores
 * on relay cards and detail pages.
 */

import { useState } from 'react';
import { Heart, Award, Shield, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToggleFavorite, useIsFavorite } from '@/hooks/useRelaySets';
import { useRelayLabelStats } from '@/hooks/useRelayLabels';
import { useRelayTrustScore } from '@/hooks/useTrustedAssertions';
import { useCurrentUser } from '@/hooks/useCurrentUser';

// ─── Favorite Button ──────────────────────────────────────────────────────────

export function FavoriteButton({ relayUrl, size = 'sm' }: { relayUrl: string; size?: 'sm' | 'md' }) {
  const { user } = useCurrentUser();
  const isFavorite = useIsFavorite(relayUrl);
  const toggleFavorite = useToggleFavorite();
  const [animating, setAnimating] = useState(false);

  const handleClick = async () => {
    if (!user) return;
    setAnimating(true);
    try {
      await toggleFavorite.mutateAsync(relayUrl);
    } finally {
      setAnimating(false);
    }
  };

  if (!user) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={`${size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'} ${animating ? 'scale-125' : ''} transition-transform`}
            onClick={handleClick}
            disabled={toggleFavorite.isPending}
          >
            {toggleFavorite.isPending ? (
              <Loader2 className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} animate-spin`} />
            ) : (
              <Heart
                className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} ${
                  isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-500'
                } transition-colors`}
              />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{isFavorite ? 'Remove from favorites' : 'Add to favorites'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Trust Badge ──────────────────────────────────────────────────────────────

export function TrustBadge({ relayUrl, size = 'sm' }: { relayUrl: string; size?: 'sm' | 'md' }) {
  const { stats } = useRelayLabelStats(relayUrl);
  const { data: trustScore } = useRelayTrustScore(relayUrl);

  const score = trustScore?.score ?? stats.trustScore;
  if (score === undefined) return null;

  const getColor = (s: number) => {
    if (s >= 80) return 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10';
    if (s >= 60) return 'border-blue-500/30 text-blue-500 bg-blue-500/10';
    if (s >= 40) return 'border-yellow-500/30 text-yellow-500 bg-yellow-500/10';
    return 'border-red-500/30 text-red-500 bg-red-500/10';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'} ${getColor(score)} gap-1`}
          >
            <Shield className="w-2.5 h-2.5" />
            {score}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            Trust score: {score}/100
            {trustScore?.providerName && ` from ${trustScore.providerName}`}
            {stats.trustScore !== undefined && ' (verified by moderators)'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Label Badges ─────────────────────────────────────────────────────────────

export function LabelBadges({ relayUrl, max = 3 }: { relayUrl: string; max?: number }) {
  const { stats } = useRelayLabelStats(relayUrl);

  if (stats.labels.length === 0) return null;

  const displayLabels = stats.labels.slice(0, max);
  const remaining = stats.labels.length - max;

  return (
    <div className="flex flex-wrap gap-1">
      {displayLabels.map((label) => (
        <Badge
          key={label.event.id}
          variant="outline"
          className="text-[10px] px-1.5 py-0 border-border/50 text-muted-foreground"
        >
          {label.label}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border/50 text-muted-foreground">
          +{remaining}
        </Badge>
      )}
    </div>
  );
}
