/**
 * Real Uptime Panel — uptime computed from actual NIP-66 history
 *
 * Replaces synthetic sparkline data with real observations:
 * - Daily uptime buckets from kind:30166 events (last 14 days)
 * - Median RTT trend per day
 * - Check count + monitor count stats
 *
 * Falls back gracefully when no monitor history exists.
 */

import {
  TrendingUp, Activity, CheckCircle2, Database,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useRelayMonitorHistory } from '@/hooks/useMonitorConsensus';
import { cn } from '@/lib/utils';

export function RealUptimePanel({ relayUrl }: { relayUrl: string }) {
  const { data: history, isLoading } = useRelayMonitorHistory(relayUrl, 14);

  if (isLoading) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Observed Uptime (14 days)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!history?.hasHistory) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Observed Uptime (14 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No monitor history found for this relay in the last 14 days.
          </p>
        </CardContent>
      </Card>
    );
  }

  const upDays = history.points.filter((p) => p.online === 1).length;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Observed Uptime (14 days)
          <Badge variant="secondary" className="text-xs ml-auto gap-1">
            <Database className="w-3 h-3" />
            {history.checkCount} checks · {history.monitorCount} monitor{history.monitorCount !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Big number */}
        <div className="flex items-end gap-3">
          <div className={cn(
            'text-4xl font-black',
            history.uptimePercent >= 95 ? 'text-emerald-500'
              : history.uptimePercent >= 80 ? 'text-yellow-500'
                : 'text-red-500',
          )}>
            {history.uptimePercent.toFixed(1)}%
          </div>
          <div className="text-xs text-muted-foreground pb-1.5">
            seen online {upDays} of {history.points.length} days
          </div>
        </div>

        {/* Daily buckets bar */}
        <div>
          <div className="flex items-end gap-1 h-12">
            {history.points.map((p) => (
              <TooltipProvider key={p.timestamp}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'flex-1 rounded transition-all cursor-help',
                        p.online === 1 ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-red-500/60 hover:bg-red-500/80',
                      )}
                      style={{ height: p.online === 1 ? '100%' : '30%' }}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {new Date(p.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      {' — '}
                      {p.online === 1 ? '✅ Observed online' : '❌ Not observed'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>14 days ago</span>
            <span>Today</span>
          </div>
        </div>

        {/* RTT trend */}
        {history.rttTrend.length > 1 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Median RTT per day
            </div>
            <div className="flex items-end gap-1 h-10">
              {history.rttTrend.map((p) => {
                const maxRtt = Math.max(...history.rttTrend.map((t) => t.rtt), 1);
                const height = Math.max(15, Math.min(100, (p.rtt / maxRtt) * 100));
                return (
                  <TooltipProvider key={p.timestamp}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="flex-1 rounded bg-primary/60 hover:bg-primary/80 transition-all cursor-help"
                          style={{ height: `${height}%` }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          {new Date(p.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          {' — '}{p.rtt}ms
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
          <CheckCircle2 className="w-2.5 h-2.5" />
          Computed from real kind:30166 observations published by trusted NIP-66 monitors — not estimates.
        </p>
      </CardContent>
    </Card>
  );
}
