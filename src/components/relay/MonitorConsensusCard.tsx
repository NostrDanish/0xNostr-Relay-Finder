/**
 * Monitor Consensus Card — multi-monitor breakdown for a relay
 *
 * Shows how many trusted monitors observed the relay, whether they agree
 * it's online, median RTT across monitors, and a per-monitor table.
 * Modeled on nostr.watch's multi-monitor aggregation.
 */

import { useState } from 'react';
import {
  Radar, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Activity, Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useRelayConsensus } from '@/hooks/useMonitorConsensus';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { timeAgo, cn } from '@/lib/utils';
import type { MonitorObservation } from '@/hooks/useMonitorConsensus';

function MonitorRow({ obs }: { obs: MonitorObservation }) {
  const author = useAuthor(obs.monitorPubkey);
  const name = author.data?.metadata?.name ?? genUserName(obs.monitorPubkey);
  const pic = author.data?.metadata?.picture;

  return (
    <div className="flex items-center gap-2.5 py-2 px-2 rounded-lg hover:bg-muted/30 transition-colors">
      <Avatar className="w-6 h-6 flex-shrink-0">
        <AvatarImage src={pic} />
        <AvatarFallback className="text-[10px]">{name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{name}</div>
        <div className="text-[10px] text-muted-foreground font-mono truncate">
          {obs.monitorPubkey.slice(0, 12)}…
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs flex-shrink-0">
        {obs.rttOpen != null && (
          <span className="text-muted-foreground font-mono" title="RTT open">
            {obs.rttOpen}ms
          </span>
        )}
        <span className="text-muted-foreground" title="Last check">
          {timeAgo(obs.checkedAt * 1000)}
        </span>
        {obs.online ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-red-500" />
        )}
      </div>
    </div>
  );
}

export function MonitorConsensusCard({ relayUrl }: { relayUrl: string }) {
  const { consensus, isLoading } = useRelayConsensus(relayUrl);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Radar className="w-4 h-4 text-primary" />
            Monitor Consensus
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!consensus) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Radar className="w-4 h-4 text-primary" />
            Monitor Consensus
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No trusted monitors have observed this relay recently.
          </p>
        </CardContent>
      </Card>
    );
  }

  const agreementPct = Math.round(consensus.agreement * 100);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Radar className="w-4 h-4 text-primary" />
          Monitor Consensus
          <Badge
            variant="outline"
            className={cn(
              'text-xs ml-auto',
              consensus.online
                ? 'border-emerald-500/30 text-emerald-500'
                : consensus.liveness === 'offline'
                  ? 'border-yellow-500/30 text-yellow-500'
                  : 'border-red-500/30 text-red-500',
            )}
          >
            {consensus.online ? 'Online' : consensus.liveness === 'offline' ? 'Offline' : 'Dead'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Consensus summary */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/40 rounded-lg px-2 py-2">
            <div className="text-lg font-black">
              {consensus.onlineCount}/{consensus.monitorCount}
            </div>
            <div className="text-[10px] text-muted-foreground">Monitors online</div>
          </div>
          <div className="bg-muted/40 rounded-lg px-2 py-2">
            <div className="text-lg font-black">{agreementPct}%</div>
            <div className="text-[10px] text-muted-foreground">Agreement</div>
          </div>
          <div className="bg-muted/40 rounded-lg px-2 py-2">
            <div className="text-lg font-black">
              {consensus.medianRttOpen != null ? `${consensus.medianRttOpen}ms` : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground">Median RTT</div>
          </div>
        </div>

        {/* RTT breakdown */}
        {(consensus.medianRttOpen != null || consensus.medianRttRead != null || consensus.medianRttWrite != null) && (
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { label: 'Open', value: consensus.medianRttOpen },
              { label: 'Read', value: consensus.medianRttRead },
              { label: 'Write', value: consensus.medianRttWrite },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between bg-muted/30 rounded px-2 py-1.5">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Activity className="w-3 h-3" /> {label}
                </span>
                <span className="font-mono font-medium">{value != null ? `${value}ms` : '—'}</span>
              </div>
            ))}
          </div>
        )}

        {/* Per-monitor breakdown */}
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            Per-monitor breakdown ({consensus.observations.length})
          </button>
          {expanded && (
            <div className="mt-2 divide-y divide-border/20 border border-border/30 rounded-lg">
              {consensus.observations.map((obs) => (
                <MonitorRow key={obs.monitorPubkey} obs={obs} />
              ))}
            </div>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          Consensus = online when ≥50% of monitors with a fresh observation (&lt;3h) agree. RTT is the median across monitors.
        </p>
      </CardContent>
    </Card>
  );
}
