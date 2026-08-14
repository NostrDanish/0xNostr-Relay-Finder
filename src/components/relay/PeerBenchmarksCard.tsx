/**
 * Peer Benchmarks Card — percentile insights vs. the network
 *
 * "Faster than 87% of relays" style insights, plus speed group badge
 * (Lightning Fast / Swift / Mid / Leisurely / Glacial) based on
 * percentile bucketing across the live relay dataset.
 *
 * Modeled on nostr.watch's relaySpeedGroupResolver + insights view.
 */

import { Gauge, Code2, TrendingUp, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  useNetworkBenchmarks,
  getSpeedGroup,
  getRttPercentile,
  getNipPercentile,
  SPEED_GROUP_META,
} from '@/hooks/useMonitorConsensus';
import { useLiveRelayStore, type LiveRelayRecord } from '@/hooks/useLiveRelayStore';
import { cn } from '@/lib/utils';

export function PeerBenchmarksCard({ relay }: { relay: LiveRelayRecord }) {
  const { relays } = useLiveRelayStore();
  const benchmarks = useNetworkBenchmarks(relays);

  const rtt = relay.liveLatencyMs ?? relay.avgLatencyMs;
  const nipCount = relay.nip11.supported_nips?.length ?? 0;

  const speedGroup = getSpeedGroup(rtt, benchmarks);
  const rttPct = rtt != null ? getRttPercentile(rtt, relays) : null;
  const nipPct = nipCount > 0 ? getNipPercentile(nipCount, relays) : null;
  const uptimePct = getRttPercentileInverse(relay.uptimePercent30d, relays.map((r) => r.uptimePercent30d));

  if (benchmarks.sampleSize === 0) return null;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Award className="w-4 h-4 text-primary" />
          Peer Benchmarks
          {speedGroup && (
            <Badge
              variant="outline"
              className={cn('text-xs ml-auto gap-1 border-current/30', SPEED_GROUP_META[speedGroup].color)}
            >
              {SPEED_GROUP_META[speedGroup].emoji} {SPEED_GROUP_META[speedGroup].label}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* RTT percentile */}
        {rttPct != null && rtt != null && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-primary" /> Latency
              </span>
              <span className="text-muted-foreground">
                faster than <strong className="text-foreground">{rttPct}%</strong> of relays
              </span>
            </div>
            <Progress value={rttPct} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {rtt}ms · network median ~{benchmarks.p60}ms
            </p>
          </div>
        )}

        {/* NIP count percentile */}
        {nipPct != null && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium flex items-center gap-1.5">
                <Code2 className="w-3.5 h-3.5 text-violet-500" /> NIP Support
              </span>
              <span className="text-muted-foreground">
                more NIPs than <strong className="text-foreground">{nipPct}%</strong> of relays
              </span>
            </div>
            <Progress value={nipPct} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {nipCount} NIPs · network median {benchmarks.medianNipCount}
            </p>
          </div>
        )}

        {/* Uptime percentile */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Uptime
            </span>
            <span className="text-muted-foreground">
              more reliable than <strong className="text-foreground">{uptimePct}%</strong> of relays
            </span>
          </div>
          <Progress value={uptimePct} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {relay.uptimePercent30d.toFixed(1)}% · network median {benchmarks.medianUptime.toFixed(1)}%
          </p>
        </div>

        <p className="text-[10px] text-muted-foreground/70">
          Percentiles computed against {benchmarks.sampleSize} relays with live data.
        </p>
      </CardContent>
    </Card>
  );
}

/** Percentile where HIGHER is better (e.g. uptime) */
function getRttPercentileInverse(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 50;
  const sorted = [...allValues].sort((a, b) => a - b);
  const below = sorted.filter((v) => v < value).length;
  return Math.round((below / sorted.length) * 100);
}
