/**
 * RelayBadges — Visual badge display for relay achievements
 */

import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { computeRelayBadges, rarityColor, type RelayBadge } from '@/lib/relayBadges';
import type { LiveRelayRecord } from '@/hooks/useLiveRelayStore';
import { cn } from '@/lib/utils';

interface RelayBadgesProps {
  relay: LiveRelayRecord;
  /** Show all badges or just top N */
  limit?: number;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function RelayBadges({ relay, limit, size = 'md', className }: RelayBadgesProps) {
  const badges = useMemo(() => {
    const all = computeRelayBadges(relay);
    return limit ? all.slice(0, limit) : all;
  }, [relay, limit]);

  if (badges.length === 0) return null;

  return (
    <TooltipProvider>
      <div className={cn('flex flex-wrap gap-1.5', className)}>
        {badges.map((badge) => (
          <Tooltip key={badge.id}>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border transition-all cursor-default',
                  badge.bgColor,
                  badge.borderColor,
                  size === 'sm' && 'px-1.5 py-0.5 text-[10px]',
                  size === 'md' && 'px-2 py-0.5 text-xs',
                  size === 'lg' && 'px-3 py-1 text-sm',
                )}
              >
                <span>{badge.emoji}</span>
                <span className={cn('font-medium', badge.color)}>{badge.label}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-bold text-sm">{badge.emoji} {badge.label}</p>
                <p className="text-xs text-muted-foreground">{badge.description}</p>
                <p className={cn('text-[10px] font-medium capitalize', rarityColor(badge.rarity))}>
                  {badge.rarity}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}

/**
 * Compact badge count display for cards.
 */
export function BadgeCount({ relay, className }: { relay: LiveRelayRecord; className?: string }) {
  const badges = useMemo(() => computeRelayBadges(relay), [relay]);
  if (badges.length === 0) return null;

  const topBadges = badges.slice(0, 3);
  const remaining = badges.length - topBadges.length;

  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-0.5', className)}>
        {topBadges.map((badge) => (
          <Tooltip key={badge.id}>
            <TooltipTrigger asChild>
              <span className="text-xs cursor-default">{badge.emoji}</span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs font-medium">{badge.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {remaining > 0 && (
          <span className="text-[10px] text-muted-foreground ml-0.5">+{remaining}</span>
        )}
      </div>
    </TooltipProvider>
  );
}
