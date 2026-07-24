/**
 * ComparePage — Side-by-side relay comparison
 *
 * Like phone comparison websites but for Nostr relays.
 * Users can select 2-4 relays and compare them across
 * every dimension: latency, uptime, NIPs, limits, auth, payment, software.
 */

import { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import {
  GitCompareArrows, X, Plus, Search, CheckCircle2, XCircle, Minus,
  TrendingUp, Wifi, Radio, Shield, DollarSign, Zap, Globe2, Code2,
  ArrowRight, Copy, Check, Crown, BarChart3, Activity, Lock,
  Droplets, Clock, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SparklineChart } from '@/components/relay/SparklineChart';
import { AddToRelayListButton } from '@/components/relay/AddToRelayListButton';
import { useLiveRelayStore, type LiveRelayRecord } from '@/hooks/useLiveRelayStore';
import { computeHealthScore, gradeColor, gradeBgColor } from '@/lib/healthScore';
import { shortenUrl, relayUrlToId, formatLatency, getNipName, formatPrice } from '@/lib/utils';
import { cn } from '@/lib/utils';

const MAX_COMPARE = 4;

// ─── Relay Picker ────────────────────────────────────────────────────────────

function RelayPicker({
  relays,
  selected,
  onSelect,
}: {
  relays: LiveRelayRecord[];
  selected: string[];
  onSelect: (url: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return relays
      .filter((r) => !selected.includes(r.url))
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.url.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      )
      .slice(0, 20);
  }, [relays, search, selected]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full h-full min-h-[200px] border-2 border-dashed border-border/60 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-primary/40 hover:bg-primary/5 transition-all group cursor-pointer">
          <div className="w-12 h-12 rounded-xl bg-muted group-hover:bg-primary/15 flex items-center justify-center transition-colors">
            <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
            Add Relay
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b border-border/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search relays..."
              className="pl-9 h-9 text-sm"
              autoFocus
            />
          </div>
        </div>
        <ScrollArea className="max-h-64">
          <div className="p-1">
            {filtered.length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No relays found
              </div>
            )}
            {filtered.map((relay) => (
              <button
                key={relay.url}
                onClick={() => {
                  onSelect(relay.url);
                  setOpen(false);
                  setSearch('');
                }}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-accent transition-colors flex items-center gap-3"
              >
                <div
                  className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    (relay.liveOnline ?? relay.isOnline) ? 'bg-emerald-500' : 'bg-red-500'
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{relay.name}</div>
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    {shortenUrl(relay.url)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex-shrink-0">
                  {relay.uptimePercent30d.toFixed(1)}%
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// ─── Comparison Row ──────────────────────────────────────────────────────────

function CompareRow({
  label,
  icon,
  children,
  highlight,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'grid items-center border-b border-border/30 last:border-b-0',
        highlight && 'bg-primary/[0.02]'
      )}
      style={{ gridTemplateColumns: '200px 1fr' }}
    >
      <div className="px-4 py-3 flex items-center gap-2 text-sm font-medium text-muted-foreground border-r border-border/30">
        {icon}
        {label}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `repeat(${(children as React.ReactElement[])?.length || 1}, 1fr)` }}>
        {children}
      </div>
    </div>
  );
}

function CompareCell({
  children,
  best,
  worst,
  className,
}: {
  children: React.ReactNode;
  best?: boolean;
  worst?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'px-4 py-3 text-sm border-r border-border/20 last:border-r-0 flex items-center gap-2',
        best && 'bg-emerald-500/5',
        worst && 'bg-red-500/5',
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Best/Worst computation helpers ──────────────────────────────────────────

function findBestIdx(values: (number | undefined | null)[], higher = true): number {
  let bestIdx = -1;
  let bestVal = higher ? -Infinity : Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) continue;
    if (higher ? v > bestVal : v < bestVal) {
      bestVal = v;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function ComparePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { relays } = useLiveRelayStore();

  // Parse relay URLs from search params
  const initialUrls = useMemo(() => {
    const urls: string[] = [];
    for (let i = 1; i <= MAX_COMPARE; i++) {
      const url = searchParams.get(`r${i}`);
      if (url) urls.push(url);
    }
    return urls;
  }, [searchParams]);

  const [selectedUrls, setSelectedUrls] = useState<string[]>(initialUrls);

  // Resolve selected relays
  const selectedRelays = useMemo(() => {
    return selectedUrls
      .map((url) => relays.find((r) => r.url === url))
      .filter((r): r is LiveRelayRecord => r != null);
  }, [relays, selectedUrls]);

  // Compute health scores for all selected
  const healthScores = useMemo(
    () => selectedRelays.map((r) => computeHealthScore(r)),
    [selectedRelays]
  );

  useSeoMeta({
    title: 'Compare Relays — 0xRelay-Finder',
    description:
      'Side-by-side comparison of Nostr relays. Compare uptime, latency, NIPs, pricing, limits, and more.',
  });

  const handleAdd = (url: string) => {
    if (selectedUrls.length >= MAX_COMPARE) return;
    const next = [...selectedUrls, url];
    setSelectedUrls(next);
    updateParams(next);
  };

  const handleRemove = (url: string) => {
    const next = selectedUrls.filter((u) => u !== url);
    setSelectedUrls(next);
    updateParams(next);
  };

  const updateParams = (urls: string[]) => {
    const params = new URLSearchParams();
    urls.forEach((u, i) => params.set(`r${i + 1}`, u));
    setSearchParams(params);
  };

  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const handleCopy = (url: string, idx: number) => {
    navigator.clipboard.writeText(url);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // Compute "best" indices for numeric comparisons
  const uptimes = selectedRelays.map((r) => r.uptimePercent30d);
  const latencies = selectedRelays.map((r) => r.liveLatencyMs ?? r.avgLatencyMs);
  const nipCounts = selectedRelays.map((r) => (r.liveNip11?.supported_nips ?? r.nip11?.supported_nips ?? []).length);
  const scores = healthScores.map((h) => h.total);

  const bestUptimeIdx = findBestIdx(uptimes, true);
  const bestLatencyIdx = findBestIdx(latencies, false);
  const bestNipIdx = findBestIdx(nipCounts, true);
  const bestScoreIdx = findBestIdx(scores, true);

  // Collect all NIPs across selected relays for comparison
  const allNips = useMemo(() => {
    const nipSet = new Set<number>();
    selectedRelays.forEach((r) => {
      (r.liveNip11?.supported_nips ?? r.nip11?.supported_nips ?? []).forEach((n) => nipSet.add(n));
    });
    return [...nipSet].sort((a, b) => a - b);
  }, [selectedRelays]);

  const hasRelays = selectedRelays.length >= 2;

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-3">
          <GitCompareArrows className="w-3.5 h-3.5" />
          Relay Comparison
        </div>
        <h1 className="text-3xl font-black mb-2">Compare Relays</h1>
        <p className="text-muted-foreground text-sm max-w-xl">
          Select 2-4 relays to compare side-by-side across every dimension: uptime, latency, NIP support,
          pricing, limits, and health score.
        </p>
      </div>

      {/* Relay selector header cards */}
      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: `repeat(${Math.max(selectedRelays.length + (selectedRelays.length < MAX_COMPARE ? 1 : 0), 2)}, minmax(0, 1fr))` }}>
        {selectedRelays.map((relay, idx) => {
          const hs = healthScores[idx];
          return (
            <Card key={relay.url} className="border-border/60 relative overflow-hidden group">
              {/* Top gradient bar */}
              <div className={cn(
                'h-1 w-full',
                idx === bestScoreIdx ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-primary/60 via-violet-500/40 to-transparent'
              )} />

              {/* Remove button */}
              <button
                onClick={() => handleRemove(relay.url)}
                className="absolute top-3 right-3 w-6 h-6 rounded-full bg-muted/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="w-3 h-3" />
              </button>

              <CardContent className="pt-4 pb-4">
                {/* Status + name */}
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={cn(
                      'w-2.5 h-2.5 rounded-full flex-shrink-0',
                      (relay.liveOnline ?? relay.isOnline) ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                    )}
                  />
                  <h3 className="font-bold text-sm truncate">{relay.name}</h3>
                  {idx === bestScoreIdx && selectedRelays.length > 1 && (
                    <Crown className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                  )}
                </div>

                {/* URL + copy */}
                <div className="flex items-center gap-2 mb-3">
                  <code className="text-xs text-muted-foreground font-mono truncate flex-1">
                    {shortenUrl(relay.url)}
                  </code>
                  <button
                    onClick={() => handleCopy(relay.url, idx)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copiedIdx === idx ? (
                      <Check className="w-3 h-3 text-emerald-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>

                {/* Health score + grade */}
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl border flex items-center justify-center',
                      gradeBgColor(hs.grade)
                    )}
                  >
                    <span className={cn('text-lg font-black', gradeColor(hs.grade))}>{hs.grade}</span>
                  </div>
                  <div>
                    <div className="text-lg font-black">
                      {hs.total}
                      <span className="text-xs text-muted-foreground font-normal">/100</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Health Score</div>
                  </div>
                </div>

                {/* Quick stats */}
                <div className="flex items-center gap-3 text-xs mb-3">
                  <span className={cn('font-bold', idx === bestUptimeIdx && 'text-emerald-500')}>
                    {relay.uptimePercent30d.toFixed(1)}% uptime
                  </span>
                  <span className={cn('font-bold', idx === bestLatencyIdx && 'text-blue-500')}>
                    {formatLatency(relay.liveLatencyMs ?? relay.avgLatencyMs)}
                  </span>
                  <span className={cn('font-bold', idx === bestNipIdx && 'text-primary')}>
                    {(relay.liveNip11?.supported_nips ?? relay.nip11?.supported_nips ?? []).length} NIPs
                  </span>
                </div>

                {/* Sparkline */}
                {relay.uptimeSpark.length > 0 && (
                  <SparklineChart data={relay.uptimeSpark} height={20} uptime={relay.uptimePercent30d} className="w-full mb-3" />
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <div onClick={(e) => e.stopPropagation()}>
                    <AddToRelayListButton relayUrl={relay.url} variant="compact" />
                  </div>
                  <Link to={`/relay/${relayUrlToId(relay.url)}`}>
                    <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                      Details <ArrowRight className="w-3 h-3" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Add relay slot */}
        {selectedRelays.length < MAX_COMPARE && (
          <RelayPicker relays={relays} selected={selectedUrls} onSelect={handleAdd} />
        )}
      </div>

      {/* Comparison Table */}
      {hasRelays ? (
        <div className="border border-border/60 rounded-2xl overflow-hidden bg-card/50">
          {/* Section: Overview */}
          <div className="bg-muted/30 px-4 py-2.5 border-b border-border/40">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" />
              Overview
            </h3>
          </div>

          <CompareRow label="Health Score" icon={<BarChart3 className="w-3.5 h-3.5" />} highlight>
            {selectedRelays.map((_, idx) => (
              <CompareCell key={idx} best={idx === bestScoreIdx}>
                <div className={cn('w-7 h-7 rounded-lg border flex items-center justify-center text-xs font-black', gradeBgColor(healthScores[idx].grade))}>
                  <span className={gradeColor(healthScores[idx].grade)}>{healthScores[idx].grade}</span>
                </div>
                <span className="font-bold">{healthScores[idx].total}/100</span>
              </CompareCell>
            ))}
          </CompareRow>

          <CompareRow label="Status" icon={<Activity className="w-3.5 h-3.5" />}>
            {selectedRelays.map((r, idx) => (
              <CompareCell key={idx}>
                <div className={cn('w-2 h-2 rounded-full', (r.liveOnline ?? r.isOnline) ? 'bg-emerald-500 animate-pulse' : 'bg-red-500')} />
                <span className={cn('font-medium', (r.liveOnline ?? r.isOnline) ? 'text-emerald-500' : 'text-red-500')}>
                  {(r.liveOnline ?? r.isOnline) ? 'Online' : 'Offline'}
                </span>
              </CompareCell>
            ))}
          </CompareRow>

          <CompareRow label="30-Day Uptime" icon={<TrendingUp className="w-3.5 h-3.5" />} highlight>
            {selectedRelays.map((r, idx) => (
              <CompareCell key={idx} best={idx === bestUptimeIdx}>
                <span className="font-bold">{r.uptimePercent30d.toFixed(2)}%</span>
                {idx === bestUptimeIdx && selectedRelays.length > 1 && (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500">Best</Badge>
                )}
              </CompareCell>
            ))}
          </CompareRow>

          <CompareRow label="Latency" icon={<Wifi className="w-3.5 h-3.5" />}>
            {selectedRelays.map((r, idx) => {
              const lat = r.liveLatencyMs ?? r.avgLatencyMs;
              return (
                <CompareCell key={idx} best={idx === bestLatencyIdx}>
                  <span className="font-bold">{lat != null ? `${lat}ms` : 'N/A'}</span>
                  {idx === bestLatencyIdx && selectedRelays.length > 1 && lat != null && (
                    <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-500">Fastest</Badge>
                  )}
                </CompareCell>
              );
            })}
          </CompareRow>

          <CompareRow label="Pricing" icon={<DollarSign className="w-3.5 h-3.5" />} highlight>
            {selectedRelays.map((r, idx) => (
              <CompareCell key={idx}>
                {r.isFree ? (
                  <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-500">Free</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-500">
                    {r.priceTiers.length > 0 ? formatPrice(r.priceTiers[0]) : 'Paid'}
                  </Badge>
                )}
              </CompareCell>
            ))}
          </CompareRow>

          <CompareRow label="Software" icon={<Code2 className="w-3.5 h-3.5" />}>
            {selectedRelays.map((r, idx) => {
              const sw = r.liveNip11?.software ?? r.nip11?.software;
              const ver = r.liveNip11?.version ?? r.nip11?.version;
              return (
                <CompareCell key={idx}>
                  <span className="truncate">{sw ?? 'Unknown'}</span>
                  {ver && <span className="text-xs text-muted-foreground">v{ver}</span>}
                </CompareCell>
              );
            })}
          </CompareRow>

          <CompareRow label="Country" icon={<Globe2 className="w-3.5 h-3.5" />} highlight>
            {selectedRelays.map((r, idx) => (
              <CompareCell key={idx}>
                {r.countryName ?? r.countryCode ?? 'Unknown'}
              </CompareCell>
            ))}
          </CompareRow>

          <CompareRow label="Operator" icon={<Shield className="w-3.5 h-3.5" />}>
            {selectedRelays.map((r, idx) => (
              <CompareCell key={idx}>
                {r.operatorNpub ? (
                  <span className="font-mono text-xs truncate">{r.operatorNpub.slice(0, 16)}...</span>
                ) : r.nip11?.pubkey ? (
                  <span className="font-mono text-xs truncate">{r.nip11.pubkey.slice(0, 16)}...</span>
                ) : (
                  <span className="text-muted-foreground">Not listed</span>
                )}
              </CompareCell>
            ))}
          </CompareRow>

          {/* Section: NIP Support */}
          <div className="bg-muted/30 px-4 py-2.5 border-b border-border/40 border-t">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Radio className="w-3.5 h-3.5" />
              NIP Support ({allNips.length} unique)
            </h3>
          </div>

          <CompareRow label="Total NIPs" icon={<Radio className="w-3.5 h-3.5" />} highlight>
            {selectedRelays.map((r, idx) => (
              <CompareCell key={idx} best={idx === bestNipIdx}>
                <span className="font-bold">{(r.liveNip11?.supported_nips ?? r.nip11?.supported_nips ?? []).length}</span>
                {idx === bestNipIdx && selectedRelays.length > 1 && (
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">Most</Badge>
                )}
              </CompareCell>
            ))}
          </CompareRow>

          {allNips.slice(0, 30).map((nip) => (
            <CompareRow key={nip} label={`NIP-${String(nip).padStart(2, '0')}`}>
              {selectedRelays.map((r, idx) => {
                const supported = (r.liveNip11?.supported_nips ?? r.nip11?.supported_nips ?? []).includes(nip);
                return (
                  <CompareCell key={idx}>
                    {supported ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-muted-foreground/30" />
                    )}
                    <span className={cn('text-xs', supported ? 'text-foreground' : 'text-muted-foreground/40')}>
                      {getNipName(nip)}
                    </span>
                  </CompareCell>
                );
              })}
            </CompareRow>
          ))}

          {/* Section: Capabilities */}
          <div className="bg-muted/30 px-4 py-2.5 border-b border-border/40 border-t">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Zap className="w-3.5 h-3.5" />
              Capabilities & Features
            </h3>
          </div>

          <CompareRow label="Auth Required" icon={<Lock className="w-3.5 h-3.5" />}>
            {selectedRelays.map((r, idx) => {
              const auth = r.nip11?.limitation?.auth_required || r.monitorRequirements?.auth;
              return (
                <CompareCell key={idx}>
                  {auth ? (
                    <><CheckCircle2 className="w-4 h-4 text-yellow-500" /> <span>Yes</span></>
                  ) : (
                    <><XCircle className="w-4 h-4 text-muted-foreground/30" /> <span className="text-muted-foreground">No</span></>
                  )}
                </CompareCell>
              );
            })}
          </CompareRow>

          <CompareRow label="Payment Required" icon={<DollarSign className="w-3.5 h-3.5" />} highlight>
            {selectedRelays.map((r, idx) => {
              const pay = r.nip11?.limitation?.payment_required || r.monitorRequirements?.payment;
              return (
                <CompareCell key={idx}>
                  {pay ? (
                    <><CheckCircle2 className="w-4 h-4 text-yellow-500" /> <span>Yes</span></>
                  ) : (
                    <><XCircle className="w-4 h-4 text-muted-foreground/30" /> <span className="text-muted-foreground">No</span></>
                  )}
                </CompareCell>
              );
            })}
          </CompareRow>

          <CompareRow label="Blossom Support" icon={<Droplets className="w-3.5 h-3.5" />}>
            {selectedRelays.map((r, idx) => (
              <CompareCell key={idx}>
                {r.blossomSupported ? (
                  <><CheckCircle2 className="w-4 h-4 text-emerald-500" /> <span>Yes</span></>
                ) : (
                  <><XCircle className="w-4 h-4 text-muted-foreground/30" /> <span className="text-muted-foreground">No</span></>
                )}
              </CompareCell>
            ))}
          </CompareRow>

          <CompareRow label="NIP-66 Monitored" icon={<Activity className="w-3.5 h-3.5" />} highlight>
            {selectedRelays.map((r, idx) => (
              <CompareCell key={idx}>
                {r.nip66?.enriched ? (
                  <><CheckCircle2 className="w-4 h-4 text-emerald-500" /> <span>Yes</span></>
                ) : (
                  <><XCircle className="w-4 h-4 text-muted-foreground/30" /> <span className="text-muted-foreground">No</span></>
                )}
              </CompareCell>
            ))}
          </CompareRow>

          {/* Section: Limits */}
          <div className="bg-muted/30 px-4 py-2.5 border-b border-border/40 border-t">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5" />
              Relay Limits
            </h3>
          </div>

          <CompareRow label="Max Message Size" icon={<Minus className="w-3.5 h-3.5" />}>
            {selectedRelays.map((r, idx) => {
              const v = r.nip11?.limitation?.max_message_length;
              return (
                <CompareCell key={idx}>
                  {v != null ? `${(v / 1024).toFixed(0)} KB` : <span className="text-muted-foreground">Not set</span>}
                </CompareCell>
              );
            })}
          </CompareRow>

          <CompareRow label="Max Subscriptions" icon={<Minus className="w-3.5 h-3.5" />} highlight>
            {selectedRelays.map((r, idx) => {
              const v = r.nip11?.limitation?.max_subscriptions;
              return (
                <CompareCell key={idx}>
                  {v != null ? v : <span className="text-muted-foreground">Not set</span>}
                </CompareCell>
              );
            })}
          </CompareRow>

          <CompareRow label="Max Content Length" icon={<Minus className="w-3.5 h-3.5" />}>
            {selectedRelays.map((r, idx) => {
              const v = r.nip11?.limitation?.max_content_length;
              return (
                <CompareCell key={idx}>
                  {v != null ? `${(v / 1000).toFixed(0)}K chars` : <span className="text-muted-foreground">Not set</span>}
                </CompareCell>
              );
            })}
          </CompareRow>

          <CompareRow label="Max Event Tags" icon={<Minus className="w-3.5 h-3.5" />} highlight>
            {selectedRelays.map((r, idx) => {
              const v = r.nip11?.limitation?.max_event_tags;
              return (
                <CompareCell key={idx}>
                  {v != null ? v : <span className="text-muted-foreground">Not set</span>}
                </CompareCell>
              );
            })}
          </CompareRow>

          <CompareRow label="Min PoW Difficulty" icon={<Minus className="w-3.5 h-3.5" />}>
            {selectedRelays.map((r, idx) => {
              const v = r.nip11?.limitation?.min_pow_difficulty;
              return (
                <CompareCell key={idx}>
                  {v != null && v > 0 ? v : <span className="text-muted-foreground">None</span>}
                </CompareCell>
              );
            })}
          </CompareRow>

          {/* Section: Health Score Breakdown */}
          <div className="bg-muted/30 px-4 py-2.5 border-b border-border/40 border-t">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" />
              Health Score Breakdown
            </h3>
          </div>

          {healthScores[0]?.components.map((comp, compIdx) => (
            <CompareRow key={comp.name} label={comp.name} highlight={compIdx % 2 === 0}>
              {healthScores.map((hs, relayIdx) => {
                const c = hs.components[compIdx];
                return (
                  <CompareCell key={relayIdx}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold">{c.points.toFixed(1)}</span>
                        <span className="text-muted-foreground">/{c.maxPoints}</span>
                      </div>
                      <Progress value={c.percent * 100} className="h-1" />
                    </div>
                  </CompareCell>
                );
              })}
            </CompareRow>
          ))}
        </div>
      ) : (
        /* Empty state */
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <GitCompareArrows className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-bold text-lg mb-2">Select at Least 2 Relays</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
              Choose relays from the picker above to see a side-by-side comparison across every dimension.
            </p>
            <Link to="/relays">
              <Button variant="outline" className="gap-2">
                <Radio className="w-4 h-4" /> Browse All Relays
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
