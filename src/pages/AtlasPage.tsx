/**
 * AtlasPage — Nostr Atlas: interactive world map of all relays
 *
 * Visualizes the global Nostr relay network with:
 * - Color-coded health status (green/yellow/red)
 * - Marker clustering by zoom level
 * - Filters by status, software, country, features
 * - Side panel listing visible/marked relays
 * - Continent-level summaries
 */

import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import {
  Globe2, MapPin, Radio, Wifi, Filter, Search, CheckCircle2,
  XCircle, AlertCircle, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { RelayMap } from '@/components/relay/RelayMap';
import { useLiveRelayStore, type LiveRelayRecord } from '@/hooks/useLiveRelayStore';
import { decodeGeohash } from '@/hooks/useNIP66Monitor';
import { relayUrlToId, shortenUrl, cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────

type FilterStatus = 'all' | 'online' | 'slow' | 'offline';
type FilterFeature = 'all' | 'auth' | 'payment' | 'blossom' | 'nip66';

interface AtlasFilters {
  status: FilterStatus;
  software: string;
  country: string;
  feature: FilterFeature;
  search: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRelayStatus(relay: LiveRelayRecord): 'online' | 'slow' | 'offline' {
  const online = relay.liveOnline ?? relay.isOnline;
  if (!online) return 'offline';
  const lat = relay.liveLatencyMs ?? relay.avgLatencyMs;
  if (lat != null && lat > 250) return 'slow';
  return 'online';
}

function hasCoordinates(relay: LiveRelayRecord): boolean {
  if (relay.geohash) return !!decodeGeohash(relay.geohash);
  return false;
}

function parseSoftwareName(software?: string): string {
  if (!software) return 'Unknown';
  return software
    .replace(/^.*\//, '')
    .replace(/\.git$/, '')
    .replace(/-/g, ' ')
    .replace(/nostr[-_]?/i, '')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-card/60 border border-border/40 rounded-xl p-3 flex items-center gap-3">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-lg font-black leading-none">{value}</div>
        <div className="text-[10px] text-muted-foreground truncate">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground/70 truncate">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Filter Panel ────────────────────────────────────────────────────────────

function FilterSection({
  filters,
  onChange,
  softwareOptions,
  countryOptions,
}: {
  filters: AtlasFilters;
  onChange: (f: AtlasFilters) => void;
  softwareOptions: string[];
  countryOptions: string[];
}) {
  return (
    <div className="space-y-5">
      {/* Status */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
          <Wifi className="w-3 h-3" /> Status
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {(['all', 'online', 'slow', 'offline'] as FilterStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => onChange({ ...filters, status: s })}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                filters.status === s
                  ? s === 'online'
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
                    : s === 'slow'
                      ? 'bg-yellow-500/15 border-yellow-500/30 text-yellow-500'
                      : s === 'offline'
                        ? 'bg-red-500/15 border-red-500/30 text-red-500'
                        : 'bg-primary/15 border-primary/30 text-primary'
                  : 'bg-card border-border/60 text-muted-foreground hover:border-primary/30'
              )}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Features */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
          <Layers className="w-3 h-3" /> Features
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {([
            { value: 'all', label: 'All' },
            { value: 'auth', label: 'Auth' },
            { value: 'payment', label: 'Paid' },
            { value: 'blossom', label: 'Blossom' },
            { value: 'nip66', label: 'NIP-66' },
          ] as { value: FilterFeature; label: string }[]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => onChange({ ...filters, feature: opt.value })}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                filters.feature === opt.value
                  ? 'bg-primary/15 border-primary/30 text-primary'
                  : 'bg-card border-border/60 text-muted-foreground hover:border-primary/30'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Software */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
          <Radio className="w-3 h-3" /> Software
        </h4>
        <select
          value={filters.software}
          onChange={(e) => onChange({ ...filters, software: e.target.value })}
          className="w-full h-9 px-2.5 rounded-lg border border-border/60 bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All software</option>
          {softwareOptions.map((sw) => (
            <option key={sw} value={sw}>{parseSoftwareName(sw)}</option>
          ))}
        </select>
      </div>

      {/* Country */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
          <MapPin className="w-3 h-3" /> Country
        </h4>
        <select
          value={filters.country}
          onChange={(e) => onChange({ ...filters, country: e.target.value })}
          className="w-full h-9 px-2.5 rounded-lg border border-border/60 bg-card text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All countries</option>
          {countryOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Search */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
          <Search className="w-3 h-3" /> Search
        </h4>
        <Input
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Relay name or URL"
          className="h-9 text-xs"
        />
      </div>
    </div>
  );
}

// ─── Main Page Component ────────────────────────────────────────────────────

export function AtlasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { relays, loading, stats } = useLiveRelayStore();
  const [selectedRelayUrl, setSelectedRelayUrl] = useState<string | null>(searchParams.get('relay'));

  const [filters, setFilters] = useState<AtlasFilters>({
    status: (searchParams.get('status') as FilterStatus) ?? 'all',
    software: searchParams.get('software') ?? '',
    country: searchParams.get('country') ?? '',
    feature: (searchParams.get('feature') as FilterFeature) ?? 'all',
    search: searchParams.get('q') ?? '',
  });

  useSeoMeta({
    title: 'Nostr Atlas — 0xNostrRelays',
    description: 'Interactive world map of every known Nostr relay. Green for healthy, yellow for slow, red for offline. Explore the global relay network.',
  });

  // Track selected relay in URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (selectedRelayUrl) {
      params.set('relay', selectedRelayUrl);
    } else {
      params.delete('relay');
    }
    setSearchParams(params, { replace: true });
  }, [selectedRelayUrl]);

  // Filter relays
  const filteredRelays = useMemo(() => {
    let result = relays.filter(hasCoordinates);

    if (filters.status !== 'all') {
      result = result.filter((r) => getRelayStatus(r) === filters.status);
    }

    if (filters.software) {
      result = result.filter((r) => (r.nip11?.software ?? '').includes(filters.software));
    }

    if (filters.country) {
      result = result.filter((r) => r.countryCode === filters.country || r.countryName === filters.country);
    }

    switch (filters.feature) {
      case 'auth':
        result = result.filter((r) => r.nip11?.limitation?.auth_required);
        break;
      case 'payment':
        result = result.filter((r) => !r.isFree || r.nip11?.limitation?.payment_required);
        break;
      case 'blossom':
        result = result.filter((r) => r.blossomSupported);
        break;
      case 'nip66':
        result = result.filter((r) => r.nip66?.enriched);
        break;
    }

    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.url.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      );
    }

    return result;
  }, [relays, filters]);

  // Options for filters
  const softwareOptions = useMemo(
    () => Array.from(new Set(relays.map((r) => r.nip11?.software).filter(Boolean))).sort() as string[],
    [relays]
  );
  const countryOptions = useMemo(
    () => Array.from(new Set(relays.map((r) => r.countryName ?? r.countryCode).filter(Boolean))).sort() as string[],
    [relays]
  );

  // Counts
  const onlineCount = filteredRelays.filter((r) => getRelayStatus(r) === 'online').length;
  const slowCount = filteredRelays.filter((r) => getRelayStatus(r) === 'slow').length;
  const offlineCount = filteredRelays.filter((r) => getRelayStatus(r) === 'offline').length;
  const geoTotal = relays.filter(hasCoordinates).length;

  const handleShowNearby = (url: string) => {
    setSelectedRelayUrl(url);
    // Could later filter to relays within certain radius
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-3">
              <Globe2 className="w-3.5 h-3.5" />
              Nostr Atlas
            </div>
            <h1 className="text-3xl font-black mb-1">Global Relay Map</h1>
            <p className="text-muted-foreground text-sm max-w-xl">
              Explore the Nostr relay network across the world. Green is healthy, yellow is slow, red is offline.
              Click any marker for details.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/build">
              <Button size="sm" className="gap-2">
                <Radio className="w-3.5 h-3.5" /> Build Relay Set
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
          <StatCard label="Mapped Relays" value={geoTotal} sub={`of ${stats.totalRelays} tracked`} icon={<MapPin className="w-4 h-4 text-primary" />} color="bg-primary/15" />
          <StatCard label="Online" value={onlineCount} icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} color="bg-emerald-500/15" />
          <StatCard label="Slow" value={slowCount} icon={<AlertCircle className="w-4 h-4 text-yellow-500" />} color="bg-yellow-500/15" />
          <StatCard label="Offline" value={offlineCount} icon={<XCircle className="w-4 h-4 text-red-500" />} color="bg-red-500/15" />
          <StatCard label="Countries" value={stats.countriesRepresented} icon={<Globe2 className="w-4 h-4 text-blue-500" />} color="bg-blue-500/15" />
        </div>
      </div>

      {/* Map + Sidebar */}
      <div className="flex-1 container mx-auto max-w-7xl px-4 pb-8 min-h-[600px]">
        <div className="flex flex-col lg:flex-row gap-4 h-full">
          {/* Sidebar (desktop) */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-24 bg-card/60 border border-border/50 rounded-xl p-4 backdrop-blur-sm max-h-[calc(100vh-8rem)] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5" /> Filters
                </h3>
                <button
                  onClick={() =>
                    setFilters({
                      status: 'all',
                      software: '',
                      country: '',
                      feature: 'all',
                      search: '',
                    })
                  }
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Reset
                </button>
              </div>
              <ScrollArea className="flex-1 -mx-2 px-2">
                <FilterSection
                  filters={filters}
                  onChange={setFilters}
                  softwareOptions={softwareOptions}
                  countryOptions={countryOptions}
                />
              </ScrollArea>

              {/* Legend */}
              <div className="mt-4 pt-4 border-t border-border/40">
                <h4 className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Legend</h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Online & fast</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <span>Online but slow (&gt;250ms)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span>Offline / unreachable</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full border-2 border-primary" />
                    <span>Selected relay</span>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Mobile filter trigger */}
          <div className="lg:hidden flex items-center justify-between mb-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="w-3.5 h-3.5" /> Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 overflow-y-auto">
                <SheetHeader className="mb-4">
                  <SheetTitle>Atlas Filters</SheetTitle>
                </SheetHeader>
                <FilterSection
                  filters={filters}
                  onChange={setFilters}
                  softwareOptions={softwareOptions}
                  countryOptions={countryOptions}
                />
              </SheetContent>
            </Sheet>
            <span className="text-xs text-muted-foreground">{filteredRelays.length} relays on map</span>
          </div>

          {/* Map container */}
          <div className="flex-1 min-h-[500px] lg:min-h-0">
            <RelayMap
              relays={filteredRelays}
              selectedRelayUrl={selectedRelayUrl}
              onShowNearby={handleShowNearby}
              height="100%"
              className="h-full min-h-[500px] lg:min-h-0"
            />
          </div>

          {/* Right side relay list */}
          <aside className="hidden xl:block w-64 flex-shrink-0">
            <div className="sticky top-24 bg-card/60 border border-border/50 rounded-xl p-0 backdrop-blur-sm max-h-[calc(100vh-8rem)] flex flex-col overflow-hidden">
              <div className="p-3 border-b border-border/40">
                <h3 className="font-bold text-sm">Visible Relays</h3>
                <p className="text-[10px] text-muted-foreground">{filteredRelays.length} mapped</p>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {loading && Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                  {!loading && filteredRelays.slice(0, 50).map((relay) => {
                    const status = getRelayStatus(relay);
                    const selected = selectedRelayUrl === relay.url;
                    return (
                      <button
                        key={relay.url}
                        onClick={() => setSelectedRelayUrl(relay.url)}
                        className={cn(
                          'w-full text-left p-2 rounded-lg border transition-all text-xs',
                          selected
                            ? 'border-primary bg-primary/5'
                            : 'border-transparent hover:bg-card hover:border-border/60'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={cn('w-2 h-2 rounded-full flex-shrink-0', status === 'online' ? 'bg-emerald-500' : status === 'slow' ? 'bg-yellow-500' : 'bg-red-500')} />
                          <span className="font-bold truncate flex-1">{relay.name}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono truncate">{shortenUrl(relay.url)}</div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <span>{relay.uptimePercent30d.toFixed(1)}% uptime</span>
                          {(relay.liveLatencyMs ?? relay.avgLatencyMs) != null && (
                            <span>{relay.liveLatencyMs ?? relay.avgLatencyMs}ms</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {!loading && filteredRelays.length > 50 && (
                    <div className="text-center text-[10px] text-muted-foreground py-2">
                      +{filteredRelays.length - 50} more — zoom to see
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
