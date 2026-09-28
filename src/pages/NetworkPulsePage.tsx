/**
 * NetworkPulsePage — Network Pulse (/pulse)
 *
 * The heartbeat of the Nostr relay network, built from the crawler snapshot
 * time series (GitHub Actions auto-tick every 3 hours):
 *
 * - Online/total relays over time (area chart)
 * - Median network latency trend
 * - New relay discoveries per run
 * - Active monitor count
 * - Latest crawl report (per-source status, durations, errors)
 *
 * Unlike the live views, these trends are persistent — every crawl run
 * appends a point to stats-history.json in the repo, so the charts survive
 * page reloads, monitor outages, and time itself.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import {
  Activity, Radio, Gauge, Satellite, Sparkles, Clock, CheckCircle2,
  XCircle, ArrowRight, Database, GitCommitHorizontal, Wifi,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, BarChart, Bar,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSnapshot } from '@/hooks/useSnapshot';
import { timeAgo } from '@/lib/utils';

function formatTs(unixS: number): string {
  return new Date(unixS * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTsLong(unixS: number): string {
  return new Date(unixS * 1000).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '0.5rem',
  fontSize: '0.75rem',
};

export function NetworkPulsePage() {
  useSeoMeta({
    title: 'Network Pulse — Nostr Relay Trends | 0xRelayFinder',
    description: 'Persistent Nostr relay network trends: online relays over time, median latency, new discoveries, and monitor activity — rebuilt every 3 hours by the 0xRelayFinder crawler.',
  });

  const { stats, report, generatedAt, records, graveyard } = useSnapshot();

  const latest = stats[stats.length - 1];

  const onlineSeries = useMemo(
    () => stats.map((p) => ({ t: p.t, online: p.online, total: p.total })),
    [stats],
  );
  const rttSeries = useMemo(
    () => stats.filter((p) => p.medianRtt != null).map((p) => ({ t: p.t, rtt: p.medianRtt })),
    [stats],
  );
  const newSeries = useMemo(
    () => stats.map((p) => ({ t: p.t, new: p.newRelays })),
    [stats],
  );

  const topUptime = useMemo(
    () => [...records]
      .filter((r) => r.uptimeSpark.length >= 4)
      .sort((a, b) => b.uptimePercent30d - a.uptimePercent30d)
      .slice(0, 10),
    [records],
  );

  const statCards = [
    { label: 'Relays Tracked', value: latest?.total ?? records.length, icon: Database, sub: `${graveyard.length} in graveyard` },
    { label: 'Online Now', value: latest?.online ?? '—', icon: Wifi, sub: `as of ${timeAgo(generatedAt * 1000)}` },
    { label: 'Median Latency', value: latest?.medianRtt != null ? `${latest.medianRtt}ms` : '—', icon: Gauge, sub: 'across online relays' },
    { label: 'Active Monitors', value: latest?.monitors ?? '—', icon: Satellite, sub: 'contributing NIP-66 data' },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-primary/10">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Network Pulse</h1>
          <Badge variant="secondary" className="gap-1">
            <GitCommitHorizontal className="h-3 w-3" />
            auto-tick: every 3h
          </Badge>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          Persistent trends for the entire Nostr relay network. Our crawler pulls every
          NIP-66 observation from the monitor network, probes stale relays directly, and
          commits the snapshot to this repository every 3 hours — these charts are built
          from that permanent, version-controlled history.
        </p>
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Last crawl: {formatTsLong(generatedAt)} ({timeAgo(generatedAt * 1000)})
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, sub }) => (
          <Card key={label}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              Relays Online vs Tracked
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {onlineSeries.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={onlineSeries}>
                  <XAxis dataKey="t" tickFormatter={formatTs} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" width={50} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => formatTsLong(Number(t))} />
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted))" name="Tracked" />
                  <Area type="monotone" dataKey="online" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.25)" name="Online" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart note="Trend builds as the crawler accumulates runs — one point every 3 hours." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" />
              Median Network Latency
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {rttSeries.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rttSeries}>
                  <XAxis dataKey="t" tickFormatter={formatTs} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" width={50} unit="ms" />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => formatTsLong(Number(t))} />
                  <Line type="monotone" dataKey="rtt" stroke="hsl(var(--primary))" dot={false} name="Median RTT" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart note="Trend builds as the crawler accumulates runs — one point every 3 hours." />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              New Relays Discovered per Crawl
            </CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            {newSeries.length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={newSeries}>
                  <XAxis dataKey="t" tickFormatter={formatTs} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                  <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" width={50} />
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(t) => formatTsLong(Number(t))} />
                  <Bar dataKey="new" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="New relays" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart note="Trend builds as the crawler accumulates runs — one point every 3 hours." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Rock-solid relays */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rock-Solid Relays (30d uptime)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topUptime.map((relay) => (
                <Link
                  key={relay.url}
                  to={`/relay/${encodeURIComponent(relay.url)}`}
                  className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                      {relay.name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{relay.url}</div>
                  </div>
                  <Badge variant={relay.uptimePercent30d >= 99 ? 'default' : 'secondary'}>
                    {relay.uptimePercent30d}%
                  </Badge>
                </Link>
              ))}
              {topUptime.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Uptime rankings appear once the crawler has accumulated a few runs of history.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Latest crawl report */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Latest Crawl Report</CardTitle>
          </CardHeader>
          <CardContent>
            {report ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Relays tracked</span>
                  <span className="text-right font-medium">{report.totals.relaysActive}</span>
                  <span className="text-muted-foreground">Online</span>
                  <span className="text-right font-medium">{report.totals.relaysOnline}</span>
                  <span className="text-muted-foreground">New this run</span>
                  <span className="text-right font-medium">{report.totals.relaysNew}</span>
                  <span className="text-muted-foreground">Monitors seen</span>
                  <span className="text-right font-medium">{report.totals.monitorsSeen}</span>
                  <span className="text-muted-foreground">Direct probes</span>
                  <span className="text-right font-medium">{report.totals.probedDirectly}</span>
                  <span className="text-muted-foreground">NIP-11 backfilled</span>
                  <span className="text-right font-medium">{report.totals.nip11Fetched}</span>
                  <span className="text-muted-foreground">Run duration</span>
                  <span className="text-right font-medium">{(report.durationMs / 1000).toFixed(1)}s</span>
                </div>
                <div className="space-y-1.5 pt-2 border-t">
                  {report.sources.map((source) => (
                    <div key={source.id} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        {source.status === 'ok' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        ) : source.status === 'error' ? (
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                        ) : (
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className="font-mono">{source.id}</span>
                      </span>
                      <span className="text-muted-foreground">
                        {source.items} items · {(source.durationMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No crawl report bundled yet.</p>
            )}
            <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
              <Link to="/monitors">
                Meet the monitors <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyChart({ note }: { note: string }) {
  return (
    <div className="h-full flex items-center justify-center text-center px-6">
      <p className="text-sm text-muted-foreground">{note}</p>
    </div>
  );
}
