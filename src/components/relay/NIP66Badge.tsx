import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, ShieldCheck, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NIP66Data } from '@/types/relay';
import { timeAgo } from '@/lib/utils';

interface NIP66BadgeProps {
  data: NIP66Data;
  size?: 'sm' | 'md';
  showConflict?: boolean;
}

export function NIP66Badge({ data, size = 'sm', showConflict = true }: NIP66BadgeProps) {
  if (!data.enriched) return null;

  const hasConflict = showConflict && data.conflictsWithNip11;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border font-medium cursor-help transition-all',
              size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1',
              hasConflict
                ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
                : 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'
            )}
          >
            {hasConflict ? (
              <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
            ) : (
              <ShieldCheck className="w-2.5 h-2.5 flex-shrink-0" />
            )}
            NIP-66
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1.5 text-xs">
            <p className="font-semibold">
              {hasConflict ? '⚠️ NIP-66 Conflict Detected' : '✅ Enriched by NIP-66'}
            </p>
            <p className="text-muted-foreground">
              Official health data from nostr.watch-style monitors via kind:30166 / kind:10166.
            </p>
            {data.monitorLatencyMs != null && (
              <p>Monitor latency: <strong>{data.monitorLatencyMs}ms</strong></p>
            )}
            {data.lastMonitorEvent && (
              <p>Last event: <strong>{timeAgo(data.lastMonitorEvent)}</strong></p>
            )}
            {hasConflict && data.conflictDetail && (
              <p className="text-yellow-500">{data.conflictDetail}</p>
            )}
            {data.capabilities && (
              <div className="flex gap-1 flex-wrap pt-1">
                {Object.entries(data.capabilities)
                  .filter(([, v]) => v)
                  .map(([k]) => (
                    <span key={k} className="bg-muted px-1.5 py-0.5 rounded text-xs">{k}</span>
                  ))}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Compact live-status dot from NIP-66 monitor */
export function NIP66StatusDot({ data }: { data?: NIP66Data }) {
  if (!data?.enriched || !data.liveStatus) return null;

  const colors = {
    online: 'bg-emerald-500',
    offline: 'bg-red-500',
    degraded: 'bg-yellow-500',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help">
            <Activity className="w-3 h-3 text-violet-500" />
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full flex-shrink-0',
                colors[data.liveStatus],
                data.liveStatus === 'online' && 'animate-pulse'
              )}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">NIP-66 monitor: <strong>{data.liveStatus}</strong></p>
          {data.monitorLatencyMs != null && (
            <p className="text-xs text-muted-foreground">{data.monitorLatencyMs}ms RTT</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
