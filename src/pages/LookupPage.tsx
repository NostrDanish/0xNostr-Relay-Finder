/**
 * LookupPage — npub Relay Lookup
 *
 * Input any npub/nprofile → queries kind:10002 → shows their read/write relay
 * configuration with live status of each relay. Killer feature for debugging
 * "why can't my followers see my posts".
 */

import { useState, useMemo } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import {
  Search, User, Wifi, WifiOff, ArrowRight, Info,
  BookOpen, Send, Loader2, AlertCircle, Radio, Copy, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useNpubLookup, resolveToHex } from '@/hooks/useNpubLookup';
import { useLiveRelayStore, type LiveRelayRecord } from '@/hooks/useLiveRelayStore';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { cn, shortenUrl, timeAgo, relayUrlToId } from '@/lib/utils';
import { UptimeBadge, OnlineIndicator } from '@/components/relay/UptimeBadge';
import { SparklineChart } from '@/components/relay/SparklineChart';
import { CheckNowButton } from '@/components/relay/LiveStatusBadges';

function ProfileHeader({ pubkey }: { pubkey: string }) {
  const author = useAuthor(pubkey);
  const meta = author.data?.metadata;
  const name = meta?.name ?? genUserName(pubkey);

  return (
    <div className="flex items-center gap-4 mb-6">
      <Avatar className="w-14 h-14 border-2 border-primary/20">
        <AvatarImage src={meta?.picture} alt={name} />
        <AvatarFallback className="text-lg font-bold">{name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <h2 className="text-xl font-bold truncate">{name}</h2>
        {meta?.nip05 && (
          <p className="text-sm text-primary truncate">{meta.nip05}</p>
        )}
        <p className="text-xs text-muted-foreground font-mono truncate">
          {pubkey.slice(0, 20)}…{pubkey.slice(-8)}
        </p>
      </div>
    </div>
  );
}

interface RelayRowProps {
  url: string;
  read: boolean;
  write: boolean;
  liveRelay?: LiveRelayRecord;
}

function RelayRow({ url, read, write, liveRelay }: RelayRowProps) {
  const [copied, setCopied] = useState(false);
  const isOnline = liveRelay?.liveOnline ?? liveRelay?.isOnline ?? undefined;
  const latency = liveRelay?.liveLatencyMs ?? liveRelay?.avgLatencyMs;
  const inDirectory = !!liveRelay;

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 border-b border-border/40 last:border-0">
      {/* Status + URL */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Online indicator */}
        <div className="flex-shrink-0">
          {isOnline === true && (
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          )}
          {isOnline === false && (
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          )}
          {isOnline === undefined && (
            <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" />
          )}
        </div>

        {/* URL */}
        <div className="min-w-0 flex-1">
          <code className="text-sm font-mono truncate block">{shortenUrl(url)}</code>
          <div className="flex items-center gap-2 mt-0.5">
            {/* Read/Write badges */}
            {read && (
              <span className="inline-flex items-center gap-0.5 text-xs bg-blue-500/10 text-blue-500 border border-blue-500/20 px-1.5 py-0.5 rounded-full font-medium">
                <BookOpen className="w-2.5 h-2.5" /> Read
              </span>
            )}
            {write && (
              <span className="inline-flex items-center gap-0.5 text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-medium">
                <Send className="w-2.5 h-2.5" /> Write
              </span>
            )}

            {/* Latency */}
            {latency != null && (
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded border font-mono',
                latency < 100
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  : latency < 200
                  ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                  : 'bg-red-500/10 text-red-500 border-red-500/20'
              )}>
                {latency}ms
              </span>
            )}

            {/* In directory? */}
            {!inDirectory && (
              <span className="text-xs text-muted-foreground/60 italic">Not in directory</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {inDirectory && liveRelay && (
          <div className="hidden sm:block">
            <SparklineChart data={liveRelay.uptimeSpark} height={16} uptime={liveRelay.uptimePercent30d} className="w-16" />
          </div>
        )}

        <CheckNowButton relayUrl={url} />

        <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground transition-colors p-1">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        {inDirectory && (
          <Link to={`/relay/${relayUrlToId(url)}`}>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
              Details <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

export function LookupPage() {
  const [input, setInput] = useState('');
  const [searchedPubkey, setSearchedPubkey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { relays: liveRelays } = useLiveRelayStore();

  useSeoMeta({
    title: 'npub Relay Lookup — 0xNostrRelays',
    description: "Look up any Nostr user's relay configuration. See which relays they use for reading and writing.",
  });

  const { data: lookupResult, isLoading, isFetching } = useNpubLookup(searchedPubkey);

  // Build a map of relay URL → live relay for quick lookup
  const relayMap = useMemo(() => {
    const map = new Map<string, LiveRelayRecord>();
    for (const r of liveRelays) {
      map.set(r.url, r);
    }
    return map;
  }, [liveRelays]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const hex = resolveToHex(input);
    if (!hex) {
      setError('Invalid input. Enter an npub (npub1…), nprofile (nprofile1…), or 64-char hex pubkey.');
      return;
    }

    setSearchedPubkey(hex);
  };

  const readRelays = lookupResult?.relays.filter((r) => r.read) ?? [];
  const writeRelays = lookupResult?.relays.filter((r) => r.write) ?? [];
  const allRelays = lookupResult?.relays ?? [];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-5 h-5 text-primary" />
          <h1 className="text-3xl font-black">npub Relay Lookup</h1>
        </div>
        <p className="text-muted-foreground text-sm max-w-xl">
          Look up any Nostr user's relay configuration (NIP-65). See which relays they publish to
          and read from, with live status checks. Perfect for debugging "why can't my followers see my posts".
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative search-glow rounded-xl border border-border/60 bg-card shadow-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Input
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(''); }}
            placeholder="Paste an npub, nprofile, or hex pubkey…"
            className="pl-12 pr-36 h-14 text-base border-0 bg-transparent focus-visible:ring-0 rounded-xl font-mono"
          />
          <Button
            type="submit"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-5 font-semibold glow-primary-sm"
            disabled={isLoading || !input.trim()}
          >
            {(isLoading || isFetching) ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Searching…</>
            ) : (
              'Lookup'
            )}
          </Button>
        </div>
        {error && (
          <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </p>
        )}
      </form>

      {/* Results */}
      {searchedPubkey && !isLoading && !lookupResult && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
              <WifiOff className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="font-bold text-lg mb-2">No Relay List Found</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              This user hasn't published a NIP-65 relay list (kind:10002) yet.
              They may be using a client that doesn't support NIP-65, or their relay list
              hasn't been propagated to the relays we're connected to.
            </p>
          </CardContent>
        </Card>
      )}

      {lookupResult && (
        <div className="space-y-6">
          {/* Profile header */}
          <ProfileHeader pubkey={lookupResult.pubkey} />

          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border/60">
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-2xl font-black">{allRelays.length}</div>
                <div className="text-xs text-muted-foreground">Total Relays</div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-2xl font-black text-blue-500">{readRelays.length}</div>
                <div className="text-xs text-muted-foreground">Read Relays</div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-2xl font-black text-emerald-500">{writeRelays.length}</div>
                <div className="text-xs text-muted-foreground">Write Relays</div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-2xl font-black text-muted-foreground">
                  {timeAgo(lookupResult.updatedAt * 1000)}
                </div>
                <div className="text-xs text-muted-foreground">Last Updated</div>
              </CardContent>
            </Card>
          </div>

          {/* Relay list */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className="w-4 h-4 text-primary" />
                Relay Configuration
                <Badge variant="secondary" className="text-xs ml-auto">{allRelays.length} relays</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 bg-muted/30 border border-border/40 rounded-lg px-3 py-2 mb-4 text-xs text-muted-foreground">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>
                  <strong>Read relays</strong> = where this user expects to receive events.{' '}
                  <strong>Write relays</strong> = where this user publishes events.
                  To see this user's posts, connect to their <strong>write</strong> relays.
                </span>
              </div>

              {allRelays.map((relay) => (
                <RelayRow
                  key={relay.url}
                  url={relay.url}
                  read={relay.read}
                  write={relay.write}
                  liveRelay={relayMap.get(relay.url)}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
