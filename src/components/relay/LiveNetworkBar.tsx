/**
 * LiveNetworkBar — auto-updating global network stats strip
 *
 * Shows live counters: total relays, online now, avg latency, free/paid split,
 * NIP-specific relay counts. Updates every 60 seconds from the live store.
 */

import { useState, useEffect } from 'react';
import {
  Radio, Wifi, WifiOff, Zap, Lock, Shield,
  Search, MessageCircle, Droplets, Activity, Clock,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { LiveNetworkStats } from '@/hooks/useLiveRelayStore';
import { cn } from '@/lib/utils';

interface LiveNetworkBarProps {
  stats: LiveNetworkStats;
  enriching?: boolean;
}

function StatChip({
  icon: Icon,
  label,
  value,
  color = 'text-muted-foreground',
  tooltip,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color?: string;
  tooltip?: string;
}) {
  const chip = (
    <div className="flex items-center gap-1.5 text-xs">
      <Icon className={cn('w-3 h-3 flex-shrink-0', color)} />
      <span className="text-muted-foreground hidden sm:inline">{label}</span>
      <span className="font-bold text-foreground tabular-nums">{value}</span>
    </div>
  );

  if (!tooltip) return chip;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">{chip}</div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function LiveNetworkBar({ stats, enriching }: LiveNetworkBarProps) {
  const [pulse, setPulse] = useState(false);

  // Pulse animation when stats update
  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 600);
    return () => clearTimeout(t);
  }, [stats.lastUpdated]);

  return (
    <div className="w-full border-b border-border/40 bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-between gap-4 py-1.5 overflow-x-auto scrollbar-none">
          {/* Left: key stats */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <StatChip
              icon={Radio}
              label="Relays"
              value={stats.totalRelays}
              color="text-primary"
              tooltip={`${stats.totalRelays} relays tracked`}
            />

            <div className="w-px h-3.5 bg-border/50" />

            <StatChip
              icon={Wifi}
              label="Online"
              value={stats.onlineNow}
              color="text-emerald-500"
              tooltip={`${stats.onlineNow} relays online right now`}
            />

            <StatChip
              icon={WifiOff}
              label="Offline"
              value={stats.offlineNow}
              color={stats.offlineNow > 0 ? 'text-red-500' : 'text-muted-foreground'}
              tooltip={`${stats.offlineNow} relays currently offline`}
            />

            <div className="w-px h-3.5 bg-border/50 hidden md:block" />

            <div className="hidden md:block">
              <StatChip
                icon={Zap}
                label="Avg RTT"
                value={stats.avgLatencyMs > 0 ? `${stats.avgLatencyMs}ms` : '—'}
                color="text-yellow-500"
                tooltip="Average network round-trip time across all online relays"
              />
            </div>
          </div>

          {/* Right: NIP/feature counts */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden lg:flex items-center gap-3">
              <StatChip
                icon={Search}
                label="NIP-50"
                value={stats.nip50Search}
                tooltip={`${stats.nip50Search} relays support NIP-50 full-text search`}
              />

              <StatChip
                icon={Zap}
                label="NIP-57"
                value={stats.nip57Zaps}
                tooltip={`${stats.nip57Zaps} relays support NIP-57 Lightning zaps`}
              />

              <StatChip
                icon={MessageCircle}
                label="NIP-17"
                value={stats.nip17DMs}
                tooltip={`${stats.nip17DMs} relays support NIP-17 private DMs`}
              />

              <StatChip
                icon={Lock}
                label="Auth"
                value={stats.authRequired}
                tooltip={`${stats.authRequired} relays require authentication (NIP-42)`}
              />

              <StatChip
                icon={Droplets}
                label="Blossom"
                value={stats.blossomEnabled}
                tooltip={`${stats.blossomEnabled} relays support Blossom media storage`}
              />
            </div>

            <div className="w-px h-3.5 bg-border/50 hidden lg:block" />

            <div className="flex items-center gap-1.5 text-xs">
              {enriching ? (
                <Activity className="w-3 h-3 text-violet-500 animate-pulse" />
              ) : (
                <Clock className="w-3 h-3 text-muted-foreground" />
              )}
              <span className={cn(
                'text-muted-foreground transition-opacity duration-300',
                pulse && 'text-emerald-500'
              )}>
                {enriching ? 'Enriching…' : 'Live'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
