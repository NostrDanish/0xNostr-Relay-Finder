/**
 * GraveyardPage — Relay Graveyard
 *
 * Shows relays that were once in the directory but are now permanently offline.
 * Data source: seed relays + approved submissions that are currently offline
 * and have no recent NIP-66 monitor events.
 */

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import {
  Skull, Clock, Calendar, ArrowUpDown, Search,
  Radio, ExternalLink, Copy, Check, WifiOff,
  TrendingDown, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useLiveRelayStore, type LiveRelayRecord } from '@/hooks/useLiveRelayStore';
import { shortenUrl, relayUrlToId, timeAgo } from '@/lib/utils';

type SortKey = 'recent' | 'oldest' | 'name';

function isRelayDead(relay: LiveRelayRecord): boolean {
  const isOnline = relay.liveOnline ?? relay.isOnline;
  if (isOnline) return false;

  // If NIP-66 says it was seen recently, it's not dead
  if (relay.liveLastSeen) {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - relay.liveLastSeen < thirtyDaysMs) return false;
  }

  // If it has no NIP-66 data and isOnline is false, it's dead
  return true;
}

function TombstoneCard({ relay }: { relay: LiveRelayRecord }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(relay.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const lastSeen = relay.liveLastSeen ?? relay.lastChecked;
  const deadForMs = Date.now() - lastSeen;
  const deadDays = Math.floor(deadForMs / (24 * 60 * 60 * 1000));

  return (
    <div className="border border-border/40 rounded-xl bg-card/50 p-5 hover:bg-card/80 transition-all group relative overflow-hidden">
      {/* Tombstone cross */}
      <div className="absolute top-3 right-3 text-muted-foreground/10 text-6xl font-serif leading-none select-none pointer-events-none">
        †
      </div>

      <div className="flex items-start gap-4">
        {/* Skull icon */}
        <div className="w-10 h-10 rounded-xl bg-zinc-500/10 flex items-center justify-center flex-shrink-0">
          <Skull className="w-5 h-5 text-zinc-400" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Name */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-sm truncate">{relay.name}</h3>
            <Badge variant="outline" className="text-xs border-red-500/30 text-red-500 flex-shrink-0">
              <WifiOff className="w-2.5 h-2.5 mr-0.5" /> Offline
            </Badge>
          </div>

          {/* URL */}
          <code className="text-xs font-mono text-muted-foreground truncate block mb-2">
            {shortenUrl(relay.url)}
          </code>

          {/* Death info */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Added {timeAgo(relay.addedAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Last seen {timeAgo(lastSeen)}
            </span>
            {deadDays > 0 && (
              <span className="flex items-center gap-1 text-red-500/80">
                <TrendingDown className="w-3 h-3" />
                Dead for {deadDays}d
              </span>
            )}
          </div>

          {/* Use cases if any */}
          {relay.useCases.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {relay.useCases.slice(0, 3).map((uc) => (
                <span key={uc} className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground/70">{uc}</span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          <button
            onClick={handleCopy}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted"
            title="Copy WSS URL"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <Link to={`/relay/${relayUrlToId(relay.url)}`}>
            <button
              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-muted"
              title="View details"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function GraveyardPage() {
  const { relays } = useLiveRelayStore();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');

  useSeoMeta({
    title: 'Relay Graveyard — 0xNostrRelays',
    description: 'A memorial to Nostr relays that have gone permanently offline. See which relays no longer respond and when they were last seen.',
  });

  const deadRelays = useMemo(() => {
    let dead = relays.filter(isRelayDead);

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      dead = dead.filter(r =>
        r.url.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
    }

    // Sort
    dead.sort((a, b) => {
      switch (sort) {
        case 'recent': {
          const aLast = a.liveLastSeen ?? a.lastChecked;
          const bLast = b.liveLastSeen ?? b.lastChecked;
          return bLast - aLast; // Most recently died first
        }
        case 'oldest': {
          const aLast = a.liveLastSeen ?? a.lastChecked;
          const bLast = b.liveLastSeen ?? b.lastChecked;
          return aLast - bLast; // Longest dead first
        }
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return dead;
  }, [relays, search, sort]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-zinc-500/10 border border-zinc-500/20 rounded-full px-4 py-1.5 text-sm text-zinc-400 font-medium mb-3">
          <Skull className="w-3.5 h-3.5" />
          Memorial
        </div>
        <h1 className="text-3xl font-black mb-2">Relay Graveyard</h1>
        <p className="text-muted-foreground text-sm max-w-xl">
          A memorial to Nostr relays that have gone permanently offline. These relays were once part of the directory
          but no longer respond to WebSocket connections or NIP-11 HTTP requests.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4 text-center">
            <Skull className="w-5 h-5 mx-auto mb-1.5 text-zinc-400" />
            <div className="text-2xl font-black">{deadRelays.length}</div>
            <div className="text-xs text-muted-foreground">Offline Relays</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4 text-center">
            <Radio className="w-5 h-5 mx-auto mb-1.5 text-emerald-500" />
            <div className="text-2xl font-black text-emerald-500">{relays.length - deadRelays.length}</div>
            <div className="text-xs text-muted-foreground">Still Alive</div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4 text-center">
            <AlertTriangle className="w-5 h-5 mx-auto mb-1.5 text-yellow-500" />
            <div className="text-2xl font-black text-yellow-500">
              {deadRelays.length > 0 ? Math.round((deadRelays.length / relays.length) * 100) : 0}%
            </div>
            <div className="text-xs text-muted-foreground">Dead Rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Sort */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dead relays…"
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex gap-2">
          {([
            { key: 'recent' as SortKey, label: 'Recently died' },
            { key: 'oldest' as SortKey, label: 'Longest dead' },
            { key: 'name' as SortKey, label: 'A-Z' },
          ]).map((s) => (
            <Button
              key={s.key}
              variant={sort === s.key ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => setSort(s.key)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Tombstones */}
      {deadRelays.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Radio className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="font-bold text-lg mb-2">No Dead Relays</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {search
                ? 'No offline relays match your search.'
                : 'All relays in the directory are currently alive. The graveyard is empty for now.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {deadRelays.map((relay) => (
            <TombstoneCard key={relay.id} relay={relay} />
          ))}
        </div>
      )}

      {/* Rest in peace */}
      {deadRelays.length > 0 && (
        <div className="mt-12 text-center">
          <Separator className="mb-8" />
          <p className="text-sm text-muted-foreground/50 italic">
            "In the decentralised web, relays may go down — but the protocol endures."
          </p>
          <p className="text-xs text-muted-foreground/30 mt-2">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}
