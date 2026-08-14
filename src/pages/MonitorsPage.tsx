/**
 * MonitorsPage — NIP-66 Monitor Transparency
 *
 * Lists all known NIP-66 monitors (kind:10166 announcements) with:
 * - Monitor profiles (kind:0 name/avatar)
 * - Check types performed (open, read, write, ssl, dns, geo, nip11, auth)
 * - Check frequency and timeouts
 * - Coverage stats (how many relays each monitor has reported on recently)
 * - Monitor location (geohash)
 *
 * This makes the health data pipeline transparent — users can see exactly
 * who is measuring the network and how.
 */

import { useMemo } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import {
  Radar, Activity, Clock, MapPin, CheckCircle2, Globe2,
  Shield, Zap, Wifi, Eye, Timer, Radio,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useMonitorAnnouncements, useNIP66MultiMonitor, type MonitorAnnouncement } from '@/hooks/useNIP66Monitor';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { timeAgo } from '@/lib/utils';
import { TRUSTED_MONITOR_PUBKEYS } from '@/lib/constants';

// ─── Check type metadata ──────────────────────────────────────────────────────

const CHECK_META: Record<string, { label: string; icon: React.ReactNode; desc: string }> = {
  open: { label: 'Open', icon: <Wifi className="w-3 h-3" />, desc: 'WebSocket connection' },
  read: { label: 'Read', icon: <Eye className="w-3 h-3" />, desc: 'REQ subscription' },
  write: { label: 'Write', icon: <Zap className="w-3 h-3" />, desc: 'EVENT publish' },
  ssl: { label: 'SSL', icon: <Shield className="w-3 h-3" />, desc: 'TLS certificate' },
  dns: { label: 'DNS', icon: <Globe2 className="w-3 h-3" />, desc: 'DNS resolution' },
  geo: { label: 'Geo', icon: <MapPin className="w-3 h-3" />, desc: 'Geolocation' },
  nip11: { label: 'NIP-11', icon: <Activity className="w-3 h-3" />, desc: 'Relay info doc' },
  auth: { label: 'Auth', icon: <Shield className="w-3 h-3" />, desc: 'NIP-42 auth' },
  info: { label: 'Info', icon: <Activity className="w-3 h-3" />, desc: 'Relay info doc' },
  ws: { label: 'WS', icon: <Wifi className="w-3 h-3" />, desc: 'WebSocket checks' },
};

// ─── Monitor Card ─────────────────────────────────────────────────────────────

function MonitorCard({
  monitor,
  coverage,
  recentChecks,
}: {
  monitor: MonitorAnnouncement;
  coverage: number;
  recentChecks: number;
}) {
  const author = useAuthor(monitor.pubkey);
  const meta = author.data?.metadata;
  const name = meta?.name ?? genUserName(monitor.pubkey);
  const pic = meta?.picture;
  const isTrusted = TRUSTED_MONITOR_PUBKEYS.includes(monitor.pubkey);

  const freqLabel = monitor.frequency
    ? monitor.frequency >= 3600
      ? `every ${(monitor.frequency / 3600).toFixed(1)}h`
      : monitor.frequency >= 60
        ? `every ${Math.round(monitor.frequency / 60)}m`
        : `every ${monitor.frequency}s`
    : null;

  return (
    <Card className="border-border/60 hover:border-primary/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Avatar className="w-10 h-10 border border-border/50">
            <AvatarImage src={pic} />
            <AvatarFallback className="text-sm font-bold">{name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm truncate">{name}</span>
              {isTrusted && (
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500 gap-0.5">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Trusted
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-mono truncate">
              {monitor.pubkey.slice(0, 16)}…{monitor.pubkey.slice(-8)}
            </p>
            {monitor.client && (
              <p className="text-[10px] text-muted-foreground/70 font-mono truncate mt-0.5">{monitor.client}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted/40 rounded-lg px-2 py-1.5">
            <div className="text-lg font-black">{coverage}</div>
            <div className="text-[10px] text-muted-foreground">Relays covered</div>
          </div>
          <div className="bg-muted/40 rounded-lg px-2 py-1.5">
            <div className="text-lg font-black">{recentChecks}</div>
            <div className="text-[10px] text-muted-foreground">Checks (6h)</div>
          </div>
          <div className="bg-muted/40 rounded-lg px-2 py-1.5">
            <div className="text-lg font-black">{monitor.checks.length}</div>
            <div className="text-[10px] text-muted-foreground">Check types</div>
          </div>
        </div>

        {/* Check types */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1.5">Checks Performed</div>
          <div className="flex flex-wrap gap-1">
            {monitor.checks.map((check) => {
              const meta = CHECK_META[check];
              return (
                <Badge
                  key={check}
                  variant="outline"
                  className="text-[10px] gap-1 border-primary/30 text-primary"
                  title={meta?.desc ?? check}
                >
                  {meta?.icon}
                  {meta?.label ?? check}
                </Badge>
              );
            })}
            {monitor.checks.length === 0 && (
              <span className="text-xs text-muted-foreground">No check types declared</span>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="space-y-1.5 text-xs">
          {freqLabel && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Timer className="w-3 h-3" /> Frequency
              </span>
              <span className="font-medium">{freqLabel}</span>
            </div>
          )}
          {Object.keys(monitor.timeouts).length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Timeout
              </span>
              <span className="font-medium font-mono">
                {monitor.timeouts.all ?? monitor.timeouts.open ?? '—'}ms
              </span>
            </div>
          )}
          {monitor.networks.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Globe2 className="w-3 h-3" /> Networks
              </span>
              <span className="font-medium">{monitor.networks.join(', ')}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Activity className="w-3 h-3" /> Announced
            </span>
            <span className="font-medium">{timeAgo(monitor.announcedAt * 1000)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function MonitorsPage() {
  useSeoMeta({
    title: 'Monitors — 0xRelay-Finder',
    description: 'Meet the NIP-66 monitors measuring the Nostr relay network. See who checks what, how often, and from where.',
  });

  const { data: monitors, isLoading } = useMonitorAnnouncements();
  const { data: multiMap } = useNIP66MultiMonitor();

  // Compute coverage stats per monitor
  const coverageStats = useMemo(() => {
    const coverage = new Map<string, { relays: number; checks: number }>();
    if (!multiMap) return coverage;

    for (const [, monitorMap] of multiMap) {
      for (const [pubkey, event] of monitorMap) {
        const stat = coverage.get(pubkey) ?? { relays: 0, checks: 0 };
        stat.relays += 1;
        stat.checks += 1;
        coverage.set(pubkey, stat);
        void event;
      }
    }
    return coverage;
  }, [multiMap]);

  const totalCoverage = useMemo(() => {
    if (!multiMap) return 0;
    return multiMap.size;
  }, [multiMap]);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-3">
          <Radar className="w-3.5 h-3.5" />
          Network Monitors
        </div>
        <h1 className="text-3xl font-black mb-1">Who's Watching the Network</h1>
        <p className="text-muted-foreground text-sm max-w-2xl">
          NIP-66 monitors continuously measure relay health — latency, uptime, capabilities, and location —
          and publish signed results (kind:30166) that power this directory. This page shows who's measuring,
          what they check, and how often. No black boxes.
        </p>
      </div>

      {/* Network stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Card className="border-border/60 text-center">
          <CardContent className="pt-4 pb-3">
            <Radar className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-black">{monitors?.length ?? '—'}</div>
            <div className="text-xs text-muted-foreground">Active Monitors</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 text-center">
          <CardContent className="pt-4 pb-3">
            <Radio className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
            <div className="text-2xl font-black">{totalCoverage}</div>
            <div className="text-xs text-muted-foreground">Relays Observed (6h)</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 text-center">
          <CardContent className="pt-4 pb-3">
            <Shield className="w-4 h-4 text-yellow-500 mx-auto mb-1" />
            <div className="text-2xl font-black">{TRUSTED_MONITOR_PUBKEYS.length}</div>
            <div className="text-xs text-muted-foreground">Trusted by This App</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 text-center">
          <CardContent className="pt-4 pb-3">
            <Activity className="w-4 h-4 text-blue-500 mx-auto mb-1" />
            <div className="text-2xl font-black">30166</div>
            <div className="text-xs text-muted-foreground">Event Kind</div>
          </CardContent>
        </Card>
      </div>

      {/* Monitor grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : monitors && monitors.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {monitors.map((monitor) => {
            const stats = coverageStats.get(monitor.pubkey);
            return (
              <MonitorCard
                key={monitor.pubkey}
                monitor={monitor}
                coverage={stats?.relays ?? 0}
                recentChecks={stats?.checks ?? 0}
              />
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Radar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-bold mb-1">No Monitors Found</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              No kind:10166 monitor announcements were found on the connected relays.
              The directory still works — it falls back to seed data and direct probing.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Explainer */}
      <Card className="border-border/60 mt-8">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            How Monitoring Works
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <p>
            Monitors are independent operators who crawl the relay network and publish signed
            health observations as <code className="bg-muted px-1 rounded text-xs">kind:30166</code> events.
            Because the data lives on Nostr, anyone — including this app — can consume it without
            API keys or permission.
          </p>
          <p>
            0xRelayFinder aggregates observations from{' '}
            <strong className="text-foreground">{TRUSTED_MONITOR_PUBKEYS.length} trusted monitors</strong>{' '}
            and computes a <strong className="text-foreground">multi-monitor consensus</strong> for each relay:
            a relay is shown as online when at least half of the monitors that checked it recently agree.
            Median RTT across monitors is used instead of any single measurement, making the data
            resistant to outliers and faulty monitors.
          </p>
          <p>
            Want to run your own monitor? See{' '}
            <a
              href="https://github.com/sandwichfarm/nostr-watch"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              nostr.watch's relaymon
            </a>{' '}
            and publish a kind:10166 announcement. Then check the{' '}
            <Link to="/protocols" className="text-primary hover:underline">protocol coverage</Link> page.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
