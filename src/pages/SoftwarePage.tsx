/**
 * SoftwarePage — Relay Software Leaderboard
 *
 * Aggregates relay software from NIP-11 data and shows which
 * relay implementations are most popular, reliable, and feature-rich.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import {
  Code2, Radio, TrendingUp, Wifi, ExternalLink, ChevronDown, ChevronUp,
  Zap, Shield, BarChart3, ArrowRight, Award,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useLiveRelayStore, type LiveRelayRecord } from '@/hooks/useLiveRelayStore';

interface SoftwareStats {
  name: string;
  normalizedName: string;
  relayCount: number;
  onlineCount: number;
  avgUptime: number;
  avgLatency: number | null;
  avgNipCount: number;
  versions: Map<string, number>;
  relays: LiveRelayRecord[];
  softwareUrl?: string;
}

function parseSoftwareName(software?: string): string {
  if (!software) return 'Unknown';
  // Extract name from URLs like "git+https://github.com/user/repo.git"
  const urlMatch = software.match(/([^/]+?)(?:\.git)?$/);
  if (urlMatch) {
    const name = urlMatch[1].replace(/-/g, ' ').replace(/nostr[-_]?/i, '');
    // Capitalize first letter of each word
    return name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
  return software;
}

function normalizeSoftwareKey(software?: string): string {
  if (!software) return 'unknown';
  return software.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const KNOWN_SOFTWARE: Record<string, { label: string; url: string; color: string }> = {
  strfry: { label: 'strfry', url: 'https://github.com/hoytech/strfry', color: 'text-amber-500' },
  'nostr-rs-relay': { label: 'nostr-rs-relay', url: 'https://git.sr.ht/~gheartsfield/nostr-rs-relay', color: 'text-orange-500' },
  nostream: { label: 'nostream', url: 'https://github.com/Cameri/nostream', color: 'text-blue-500' },
  khatru: { label: 'khatru', url: 'https://github.com/fiatjaf/khatru', color: 'text-violet-500' },
  ditto: { label: 'Ditto', url: 'https://gitlab.com/soapbox-pub/ditto', color: 'text-pink-500' },
  'blossom-server': { label: 'Blossom Server', url: 'https://github.com/ArcadeLabsInc/blossom-server', color: 'text-sky-500' },
};

function getSoftwareLabel(normalized: string, raw: string): string {
  for (const [key, info] of Object.entries(KNOWN_SOFTWARE)) {
    if (normalized.includes(key.replace(/-/g, ''))) return info.label;
  }
  return parseSoftwareName(raw);
}

function getSoftwareUrl(normalized: string, raw?: string): string | undefined {
  for (const [key, info] of Object.entries(KNOWN_SOFTWARE)) {
    if (normalized.includes(key.replace(/-/g, ''))) return info.url;
  }
  if (raw?.startsWith('http')) return raw.replace(/^git\+/, '');
  return undefined;
}

function getSoftwareColor(normalized: string): string {
  for (const [key, info] of Object.entries(KNOWN_SOFTWARE)) {
    if (normalized.includes(key.replace(/-/g, ''))) return info.color;
  }
  return 'text-muted-foreground';
}

function SoftwareCard({ stats, rank }: { stats: SoftwareStats; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const url = getSoftwareUrl(stats.normalizedName, stats.relays[0]?.nip11?.software);
  const color = getSoftwareColor(stats.normalizedName);
  const onlinePercent = stats.relayCount > 0 ? Math.round((stats.onlineCount / stats.relayCount) * 100) : 0;
  const topVersion = Array.from(stats.versions.entries()).sort((a, b) => b[1] - a[1])[0];

  return (
    <Card className="border-border/60 overflow-hidden">
      <div className={`h-0.5 w-full ${rank <= 3 ? 'bg-gradient-to-r from-primary/60 via-violet-500/40 to-transparent' : 'bg-border/30'}`} />
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-4">
          {/* Rank */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-black ${
            rank === 1 ? 'bg-yellow-500/15 text-yellow-500' :
            rank === 2 ? 'bg-zinc-400/15 text-zinc-400' :
            rank === 3 ? 'bg-amber-700/15 text-amber-700' :
            'bg-muted text-muted-foreground'
          }`}>
            #{rank}
          </div>

          <div className="flex-1 min-w-0">
            {/* Name + link */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className={`font-bold text-base ${color}`}>{stats.name}</h3>
              {url && (
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" onClick={(e) => e.stopPropagation()}>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <Badge variant="secondary" className="text-xs">{stats.relayCount} relay{stats.relayCount !== 1 ? 's' : ''}</Badge>
              {topVersion && (
                <span className="text-xs text-muted-foreground font-mono">v{topVersion[0]}</span>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Online</div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm">{onlinePercent}%</span>
                  <Progress value={onlinePercent} className="h-1.5 flex-1" />
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Avg Uptime</div>
                <span className="font-bold text-sm">{stats.avgUptime.toFixed(1)}%</span>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Avg Latency</div>
                <span className="font-bold text-sm">{stats.avgLatency != null ? `${stats.avgLatency}ms` : 'N/A'}</span>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Avg NIPs</div>
                <span className="font-bold text-sm">{stats.avgNipCount.toFixed(0)}</span>
              </div>
            </div>

            {/* Expandable relay list */}
            {stats.relays.length > 0 && (
              <div className="mt-3">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                >
                  {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {expanded ? 'Hide relays' : `Show ${stats.relays.length} relay${stats.relays.length !== 1 ? 's' : ''}`}
                </button>
                {expanded && (
                  <div className="mt-2 space-y-1 border-t border-border/30 pt-2">
                    {stats.relays.slice(0, 10).map(r => (
                      <Link
                        key={r.id}
                        to={`/relay/${encodeURIComponent(r.url)}`}
                        className="flex items-center gap-2 py-1 text-xs hover:bg-muted/40 rounded px-2 -mx-2 transition-colors"
                      >
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${(r.liveOnline ?? r.isOnline) ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span className="font-medium truncate flex-1">{r.name}</span>
                        <span className="text-muted-foreground font-mono">{r.nip11?.version ?? ''}</span>
                        <span className="text-muted-foreground">{r.uptimePercent30d.toFixed(1)}%</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      </Link>
                    ))}
                    {stats.relays.length > 10 && (
                      <p className="text-xs text-muted-foreground pl-2">+ {stats.relays.length - 10} more</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SoftwarePage() {
  const { relays, stats: networkStats } = useLiveRelayStore();

  useSeoMeta({
    title: 'Relay Software Leaderboard - 0xNostrRelays',
    description: 'Compare Nostr relay software implementations. See which relay software is most popular, reliable, and feature-rich.',
  });

  const softwareStats = useMemo(() => {
    const groups = new Map<string, SoftwareStats>();

    for (const relay of relays) {
      const raw = relay.liveNip11?.software ?? relay.nip11?.software ?? 'Unknown';
      const normalizedKey = normalizeSoftwareKey(raw);
      const label = getSoftwareLabel(normalizedKey, raw);

      let group = groups.get(normalizedKey);
      if (!group) {
        group = {
          name: label,
          normalizedName: normalizedKey,
          relayCount: 0,
          onlineCount: 0,
          avgUptime: 0,
          avgLatency: null,
          avgNipCount: 0,
          versions: new Map(),
          relays: [],
        };
        groups.set(normalizedKey, group);
      }

      group.relayCount++;
      group.relays.push(relay);
      if (relay.liveOnline ?? relay.isOnline) group.onlineCount++;

      // Track versions
      const version = relay.liveNip11?.version ?? relay.nip11?.version ?? 'unknown';
      group.versions.set(version, (group.versions.get(version) ?? 0) + 1);
    }

    // Compute averages
    for (const group of groups.values()) {
      const uptimes = group.relays.map(r => r.uptimePercent30d);
      group.avgUptime = uptimes.reduce((a, b) => a + b, 0) / uptimes.length;

      const latencies = group.relays
        .map(r => r.liveLatencyMs ?? r.avgLatencyMs)
        .filter((l): l is number => l != null);
      group.avgLatency = latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : null;

      const nips = group.relays.map(r => (r.liveNip11?.supported_nips ?? r.nip11?.supported_nips ?? []).length);
      group.avgNipCount = nips.reduce((a, b) => a + b, 0) / nips.length;
    }

    return Array.from(groups.values())
      .sort((a, b) => b.relayCount - a.relayCount);
  }, [relays]);

  const knownSoftwareCount = softwareStats.filter(s => s.normalizedName !== 'unknown').length;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-3">
          <Code2 className="w-3.5 h-3.5" />
          Leaderboard
        </div>
        <h1 className="text-3xl font-black mb-2">Relay Software</h1>
        <p className="text-muted-foreground text-sm max-w-xl">
          Which Nostr relay software is most popular? Compare implementations by relay count,
          uptime, latency, and NIP support. Data sourced from NIP-11 relay info documents.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4 text-center">
            <Code2 className="w-5 h-5 mx-auto mb-1.5 text-primary" />
            <div className="text-2xl font-black">{knownSoftwareCount}</div>
            <div className="text-xs text-muted-foreground">Implementations</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4 text-center">
            <Radio className="w-5 h-5 mx-auto mb-1.5 text-emerald-500" />
            <div className="text-2xl font-black">{networkStats.totalRelays}</div>
            <div className="text-xs text-muted-foreground">Total Relays</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1.5 text-blue-500" />
            <div className="text-2xl font-black">
              {softwareStats[0]?.name ?? 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground">Most Popular</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4 text-center">
            <Award className="w-5 h-5 mx-auto mb-1.5 text-yellow-500" />
            <div className="text-2xl font-black">
              {softwareStats.reduce((best, s) => s.avgUptime > best.avgUptime && s.relayCount >= 2 ? s : best, softwareStats[0])?.name ?? 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground">Highest Uptime</div>
          </CardContent>
        </Card>
      </div>

      {/* Software list */}
      <div className="space-y-3">
        {softwareStats.map((stats, i) => (
          <SoftwareCard key={stats.normalizedName} stats={stats} rank={i + 1} />
        ))}
      </div>

      {softwareStats.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <Code2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-bold text-lg mb-2">No Software Data</h3>
            <p className="text-sm text-muted-foreground">
              Relay software information is sourced from NIP-11 documents. Waiting for data to load.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info footer */}
      <div className="mt-8 text-center text-xs text-muted-foreground">
        <p>
          Software data comes from each relay's NIP-11 <code className="bg-muted px-1 rounded">software</code> field.
          Not all relays report their software implementation.
        </p>
      </div>
    </div>
  );
}
