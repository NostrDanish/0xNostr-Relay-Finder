/**
 * MonitorWatchPage — Live relays discovered by the NIP-66 monitor network
 *
 * Every relay any monitor has health-checked and found alive in the last
 * several hours. These are NOT in the curated directory — they are the
 * raw, unedited observatory view of what the NIP-66 network sees.
 *
 * Unlike the curated directory (which requires manual submission or seed
 * approval), this page is entirely dynamic: monitors check a relay, and
 * if it passes, it appears here within minutes. Relays cycle in and out.
 *
 * Data comes from kind:30166 events on the NIP-66 meta-relays (nostr.watch,
 * relaypag.es, monitorlizard.nostr1.com) — latest event per relay from
 * any known monitor source. No synthetic data, no estimates.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import {
  Radar, Globe2, Wifi, CheckCircle2, XCircle, Activity,
  Clock, Radio, MapPin, Search, ExternalLink, Shield,
  TrendingUp, Award,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useNIP66MultiMonitor } from '@/hooks/useNIP66Monitor';
import { computeConsensus, classifyLiveness, useNetworkBenchmarks, getSpeedGroup, SPEED_GROUP_META, type RelayConsensus } from '@/hooks/useMonitorConsensus';
import { useLiveRelayStore } from '@/hooks/useLiveRelayStore';
import { shortenUrl, timeAgo, cn } from '@/lib/utils';

const NOW = Math.floor(Date.now() / 1000);
/** Only show relays observed by monitors within this window */
const FRESH_SECONDS = 6 * 3600; // 6 hours

function MonitorRelayCard({ consensus, known }: { consensus: RelayConsensus; known: boolean }) {
  const { relays } = useLiveRelayStore();
  const benchmarks = useNetworkBenchmarks(relays);

  const rtt = consensus.medianRttOpen;
  const sg = rtt ? getSpeedGroup(rtt, benchmarks) : null;
  const knownLabel = known ? 'In Directory' : 'Not in Directory';

  return (
    <Card className="border-border/60 hover:border-primary/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {consensus.online ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-500" />
              )}
              <code className="text-sm font-mono truncate">{shortenUrl(consensus.relayUrl)}</code>
            </div>

            {sg && (
              <div className="flex items-center gap-1.5 text-xs mt-0.5">
                <Badge variant="outline" className="text-[10px] gap-1">
                  {SPEED_GROUP_META[sg].emoji} {SPEED_GROUP_META[sg].label}
                </Badge>
                <span className="text-muted-foreground font-mono">{rtt}ms RTT</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 items-end">
            <Badge
              variant="outline"
              className={cn(
                'text-[10px]',
                known ? 'border-emerald-500/30 text-emerald-500' : 'border-yellow-500/30 text-yellow-500',
              )}
            >
              {knownLabel}
            </Badge>
            <span className="text-[10px] text-muted-foreground">{consensus.monitorCount} monitor{consensus.monitorCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-xs text-center">
          <div className="bg-muted/40 rounded-lg px-1.5 py-1">
            <div className="font-bold">{consensus.onlineCount}{consensus.monitorCount > 0 ? `/${consensus.monitorCount}` : ''}</div>
            <div className="text-[10px] text-muted-foreground">Online</div>
          </div>
          <div className="bg-muted/40 rounded-lg px-1.5 py-1">
            <div className="font-bold">{consensus.medianRttOpen != null ? `${consensus.medianRttOpen}ms` : '—'}</div>
            <div className="text-[10px] text-muted-foreground">Median RTT</div>
          </div>
          <div className="bg-muted/40 rounded-lg px-1.5 py-1">
            <div className="font-bold">{consensus.supportedNips.length}</div>
            <div className="text-[10px] text-muted-foreground">NIPs</div>
          </div>
        </div>

        {consensus.geohash && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <MapPin className="w-3 h-3" />
            Geohash: {consensus.geohash}
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3" />
            Last seen {timeAgo(consensus.lastSeenAt * 1000)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {classifyLiveness(consensus.lastSeenAt, NOW)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function MonitorWatchPage() {
  useSeoMeta({
    title: 'Monitor Watch — 0xRelay-Finder',
    description: 'Live relay discovery feed from the NIP-66 monitor network. Every relay the network has health-checked in the last 6 hours — pure, unedited, fully automatic.',
  });

  const { data: multiMap, isLoading } = useNIP66MultiMonitor();
  const { relays: knownRelays } = useLiveRelayStore();
  const knownUrls = useMemo(() => new Set(knownRelays.map((r) => r.url)), [knownRelays]);
  const [search, setSearch] = useState('');

  // Compute consensus for every relay observed
  const discovered = useMemo(() => {
    if (!multiMap) return [];
    const results: { consensus: RelayConsensus; known: boolean }[] = [];

    for (const [relayUrl, monitorMap] of multiMap) {
      // Only include relays with fresh observations (< 6h)
      const now = Math.floor(Date.now() / 1000);
      const freshObservations = Array.from(monitorMap.values())
        .filter((e) => now - e.checkedAt <= FRESH_SECONDS);
      if (freshObservations.length === 0) continue;

      const consensus = computeConsensus(relayUrl, monitorMap);
      results.push({ consensus, known: knownUrls.has(relayUrl) });
    }

    return results.sort((a, b) => {
      // Online relays first, then by monitor count + RTT
      if (a.consensus.online !== b.consensus.online) return a.consensus.online ? -1 : 1;
      if (a.consensus.monitorCount !== b.consensus.monitorCount)
        return b.consensus.monitorCount - a.consensus.monitorCount;
      const aRtt = a.consensus.medianRttOpen ?? 9999;
      const bRtt = b.consensus.medianRttOpen ?? 9999;
      return aRtt - bRtt;
    });
  }, [multiMap, knownUrls]);

  // Search filter
  const filtered = useMemo(() => {
    if (!search.trim()) return discovered;
    const q = search.toLowerCase();
    return discovered.filter((d) =>
      d.consensus.relayUrl.toLowerCase().includes(q) ||
      d.consensus.topics.some((t) => t.toLowerCase().includes(q))
    );
  }, [discovered, search]);

  const onlineCount = discovered.filter((d) => d.consensus.online).length;
  const knownCount = discovered.filter((d) => d.known).length;
  const freshCount = filtered.length;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-sm text-violet-500 font-medium mb-3">
            <Radar className="w-3.5 h-3.5" />
            Monitor Watch
          </div>
          <h1 className="text-3xl font-black mb-1">Live Relay Discovery</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Every relay the NIP-66 monitor network has checked in the last 6 hours.
            This is the raw, unedited observatory view — relays appear as monitors
            find them and cycle out when they go quiet. <strong>100% real data</strong> —
            every relay was just contacted by a monitor and verified alive.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="border-border/60 text-center">
          <CardContent className="pt-4 pb-3">
            <Radar className="w-4 h-4 text-violet-500 mx-auto mb-1" />
            <div className="text-2xl font-black">{discovered.length}</div>
            <div className="text-xs text-muted-foreground">Discovered (6h)</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 text-center">
          <CardContent className="pt-4 pb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
            <div className="text-2xl font-black">{onlineCount}</div>
            <div className="text-xs text-muted-foreground">Online Now</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 text-center">
          <CardContent className="pt-4 pb-3">
            <Shield className="w-4 h-4 text-primary mx-auto mb-1" />
            <div className="text-2xl font-black">{knownCount}</div>
            <div className="text-xs text-muted-foreground">In Directory</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 text-center">
          <CardContent className="pt-4 pb-3">
            <Activity className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
            <div className="text-2xl font-black">{knownRelays.length - knownCount}</div>
            <div className="text-xs text-muted-foreground">Directory Only</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search relay URLs..."
          className="pl-9"
        />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" />
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.slice(0, 100).map((item) => (
            <MonitorRelayCard key={item.consensus.relayUrl} consensus={item.consensus} known={item.known} />
          ))}
          {filtered.length > 100 && (
            <Card className="border-dashed">
              <CardContent className="py-4 text-center text-sm text-muted-foreground">
                +{filtered.length - 100} more — visit <Link to="/monitors">/monitors</Link> for the full dataset
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Radar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-bold mb-1">Waiting for Monitor Data</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              The monitor network hasn't published fresh observations yet.
              Relays will appear here automatically as NIP-66 monitors check them.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              This is a live view — no rel="noopener noreferrer"oad required. Refresh or come back in a few minutes.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Explainer */}
      <Card className="border-border/60 mt-8">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Radar className="w-4 h-4 text-primary" />
            How This Works
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <p>
            NIP-66 monitors constantly crawl the Nostr network — opening WebSocket connections,
            testing read/write operations, checking SSL certificates, resolving DNS, and looking up
            geolocation. Every time a monitor contacts a relay and it responds, it publishes a
            signed <code className="bg-muted px-1 rounded text-xs">kind:30166</code> event with the results.
          </p>
          <p>
            This page shows <strong>every relay</strong> that any known monitor has checked in the last
            6 hours, with the full health data from the latest observation. There is <strong>no manual
            curation, no seed list, no approval queue</strong>. Relays appear and disappear purely
            based on what the monitor network reports.
          </p>
          <p>
            Relays are marked <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500">In Directory</Badge>
            if they're also in the curated directory (seed + community-submitted, moderated).
            Relays marked <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-500">Not in Directory</Badge>
            are only seen by monitors — you can submit them for review if they look useful.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}