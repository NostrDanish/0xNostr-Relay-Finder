/**
 * LookupPage — npub Relay Diagnostic Wizard ("Fix My Nostr")
 *
 * Input any npub/nprofile → queries kind:10002 → shows their read/write relay
 * configuration with live status, diagnostic scoring, warnings, and suggestions
 * for better relays from the directory.
 */

import { useState, useMemo } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import {
  Search, User, Wifi, WifiOff, ArrowRight, Info,
  BookOpen, Send, Loader2, AlertCircle, Radio, Copy, Check,
  AlertTriangle, CheckCircle2, XCircle, Shield, Zap, Plus,
  Stethoscope, Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useNpubLookup, resolveToHex, isNIP05, resolveNIP05 } from '@/hooks/useNpubLookup';
import { useLiveRelayStore, type LiveRelayRecord } from '@/hooks/useLiveRelayStore';
import { useAuthor } from '@/hooks/useAuthor';
import { AddToRelayListButton } from '@/components/relay/AddToRelayListButton';
import { genUserName } from '@/lib/genUserName';
import { cn, shortenUrl, timeAgo, relayUrlToId } from '@/lib/utils';
import { SparklineChart } from '@/components/relay/SparklineChart';
import { CheckNowButton } from '@/components/relay/LiveStatusBadges';

// ─── Types ────────────────────────────────────────────────────────────────────
type DiagnosticSeverity = 'critical' | 'warning' | 'info' | 'ok';

interface DiagnosticIssue {
  severity: DiagnosticSeverity;
  title: string;
  description: string;
}

// ─── Diagnostic Engine ────────────────────────────────────────────────────────
function computeDiagnostics(
  relays: { url: string; read: boolean; write: boolean }[],
  relayMap: Map<string, LiveRelayRecord>,
): { score: number; grade: string; issues: DiagnosticIssue[] } {
  const issues: DiagnosticIssue[] = [];
  let score = 100;

  if (relays.length === 0) {
    return { score: 0, grade: 'F', issues: [{ severity: 'critical', title: 'No relays', description: 'No NIP-65 relay list published. Your profile and events may not be visible to others.' }] };
  }

  // Check online status
  const withStatus = relays.map(r => ({ ...r, live: relayMap.get(r.url) }));
  const onlineCount = withStatus.filter(r => r.live?.liveOnline ?? r.live?.isOnline).length;
  const offlineCount = withStatus.filter(r => {
    const live = r.live;
    if (!live) return false;
    return (live.liveOnline === false) || (!live.liveOnline && !live.isOnline);
  }).length;

  const readRelays = relays.filter(r => r.read);
  const writeRelays = relays.filter(r => r.write);

  // Critical: All relays offline
  if (onlineCount === 0 && relays.length > 0) {
    issues.push({ severity: 'critical', title: 'All relays appear offline', description: 'None of your relays are responding. Your posts and profile are unreachable. Consider adding well-known relays.' });
    score -= 50;
  } else if (offlineCount > 0) {
    issues.push({ severity: 'warning', title: `${offlineCount} relay${offlineCount > 1 ? 's' : ''} offline`, description: 'Some of your relays are not responding. This reduces your visibility but isn\'t critical.' });
    score -= offlineCount * 5;
  }

  // Too few relays
  if (relays.length === 1) {
    issues.push({ severity: 'warning', title: 'Only 1 relay configured', description: 'Single point of failure. If this relay goes down, you\'re invisible. Add at least 2-3 more relays.' });
    score -= 15;
  } else if (relays.length < 3) {
    issues.push({ severity: 'warning', title: 'Few relays configured', description: `Only ${relays.length} relays. Consider adding more for redundancy and better reach.` });
    score -= 10;
  }

  // Too many relays
  if (relays.length > 15) {
    issues.push({ severity: 'info', title: 'Many relays configured', description: `${relays.length} relays is a lot. Some clients may slow down trying to connect to all of them. Consider trimming to 5-10 quality relays.` });
    score -= 5;
  }

  // No write relays
  if (writeRelays.length === 0) {
    issues.push({ severity: 'critical', title: 'No write relays', description: 'You have no relays marked for writing. Your posts won\'t be published anywhere.' });
    score -= 30;
  }

  // No read relays
  if (readRelays.length === 0) {
    issues.push({ severity: 'critical', title: 'No read relays', description: 'You have no relays marked for reading. Others won\'t know where to send events for you.' });
    score -= 30;
  }

  // Check if all relays are paid/auth-required
  const authRelays = withStatus.filter(r => r.live?.nip11?.limitation?.auth_required || r.live?.nip11?.limitation?.payment_required);
  if (authRelays.length === relays.length && relays.length > 0) {
    issues.push({ severity: 'warning', title: 'All relays require auth/payment', description: 'All your relays require authentication or payment. This limits who can see your posts — new followers may not have access.' });
    score -= 10;
  }

  // Check for NIP-17 DM support
  const dmRelays = withStatus.filter(r => {
    const nips = r.live?.nip11?.supported_nips ?? [];
    return nips.includes(17) || nips.includes(4);
  });
  if (dmRelays.length === 0 && relays.length > 0) {
    issues.push({ severity: 'warning', title: 'No relays with DM support', description: 'None of your relays support NIP-17 (private DMs) or NIP-04 (encrypted DMs). You may not receive direct messages.' });
    score -= 5;
  }

  // Check geographic diversity
  const countries = new Set(withStatus.map(r => r.live?.countryCode).filter(Boolean));
  if (countries.size <= 1 && relays.length >= 3) {
    issues.push({ severity: 'info', title: 'Low geographic diversity', description: 'All relays appear to be in the same country. Consider adding relays in different regions for better resilience.' });
    score -= 3;
  }

  // Good things
  if (onlineCount >= 3) {
    issues.push({ severity: 'ok', title: `${onlineCount} relays online`, description: 'Good relay coverage — your events are well distributed.' });
  }

  if (readRelays.length >= 2 && writeRelays.length >= 2) {
    issues.push({ severity: 'ok', title: 'Balanced read/write config', description: 'You have both read and write relays configured properly.' });
  }

  if (dmRelays.length > 0) {
    issues.push({ severity: 'ok', title: 'DM support available', description: `${dmRelays.length} relay${dmRelays.length > 1 ? 's' : ''} support encrypted direct messages.` });
  }

  score = Math.max(0, Math.min(100, score));

  let grade: string;
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 65) grade = 'C';
  else if (score >= 50) grade = 'D';
  else grade = 'F';

  return { score, grade, issues };
}

// ─── Components ───────────────────────────────────────────────────────────────

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
        <div className="flex-shrink-0">
          {isOnline === true && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Online" />}
          {isOnline === false && <div className="w-2.5 h-2.5 rounded-full bg-red-500" title="Offline" />}
          {isOnline === undefined && <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40" title="Unknown" />}
        </div>

        <div className="min-w-0 flex-1">
          <code className="text-sm font-mono truncate block">{shortenUrl(url)}</code>
          <div className="flex items-center gap-2 mt-0.5">
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
            {latency != null && (
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded border font-mono',
                latency < 100 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                latency < 300 ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                'bg-red-500/10 text-red-500 border-red-500/20'
              )}>
                {latency}ms
              </span>
            )}
            {!inDirectory && (
              <span className="text-xs text-muted-foreground/60 italic">Not in directory</span>
            )}
          </div>
        </div>
      </div>

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

function DiagnosticCard({ score, grade, issues }: { score: number; grade: string; issues: DiagnosticIssue[] }) {
  const gradeColors: Record<string, string> = {
    A: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    B: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    C: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
    D: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
    F: 'text-red-500 bg-red-500/10 border-red-500/30',
  };

  const severityIcons = {
    critical: <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />,
    info: <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />,
    ok: <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />,
  };

  const severityBg = {
    critical: 'bg-red-500/5 border-red-500/20',
    warning: 'bg-yellow-500/5 border-yellow-500/20',
    info: 'bg-blue-500/5 border-blue-500/20',
    ok: 'bg-emerald-500/5 border-emerald-500/20',
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-primary" />
          Relay Health Diagnostic
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Score and Grade */}
        <div className="flex items-center gap-6 mb-6">
          <div className={cn('w-16 h-16 rounded-2xl border-2 flex items-center justify-center', gradeColors[grade])}>
            <span className="text-3xl font-black">{grade}</span>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Health Score</div>
            <div className="text-3xl font-black">{score}<span className="text-lg text-muted-foreground">/100</span></div>
          </div>
        </div>

        {/* Issues */}
        <div className="space-y-2">
          {issues.map((issue, i) => (
            <div key={i} className={cn('border rounded-lg px-3 py-2.5', severityBg[issue.severity])}>
              <div className="flex items-start gap-2">
                {severityIcons[issue.severity]}
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{issue.title}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{issue.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SuggestedRelays({ currentRelayUrls, liveRelays }: { currentRelayUrls: Set<string>; liveRelays: LiveRelayRecord[] }) {
  // Find relays not in the user's list that are online, free, high uptime
  const suggestions = useMemo(() => {
    return liveRelays
      .filter(r =>
        !currentRelayUrls.has(r.url) &&
        (r.liveOnline ?? r.isOnline) &&
        r.isFree &&
        r.uptimePercent30d >= 95
      )
      .sort((a, b) => b.uptimePercent30d - a.uptimePercent30d)
      .slice(0, 5);
  }, [liveRelays, currentRelayUrls]);

  if (suggestions.length === 0) return null;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-yellow-500" />
          Suggested Relays
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-4">
          These free, high-uptime relays from our directory could improve your relay configuration.
        </p>
        <div className="space-y-3">
          {suggestions.map(relay => (
            <div key={relay.url} className="flex flex-col sm:flex-row sm:items-center gap-2 py-2 border-b border-border/30 last:border-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{relay.name}</div>
                  <code className="text-xs font-mono text-muted-foreground truncate block">{shortenUrl(relay.url)}</code>
                </div>
                <Badge variant="secondary" className="text-xs flex-shrink-0">
                  {relay.uptimePercent30d.toFixed(1)}%
                </Badge>
                {relay.avgLatencyMs && (
                  <span className="text-xs text-muted-foreground font-mono flex-shrink-0">{relay.avgLatencyMs}ms</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <AddToRelayListButton relayUrl={relay.url} variant="compact" />
                <Link to={`/relay/${relayUrlToId(relay.url)}`}>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">Details</Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function LookupPage() {
  const [input, setInput] = useState('');
  const [searchedPubkey, setSearchedPubkey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const { relays: liveRelays } = useLiveRelayStore();

  useSeoMeta({
    title: 'npub Relay Diagnostic — 0xNostrRelays',
    description: "Diagnose any Nostr user's relay configuration. Find offline relays, missing coverage, and get better relay suggestions.",
  });

  const { data: lookupResult, isLoading, isFetching } = useNpubLookup(searchedPubkey);

  const relayMap = useMemo(() => {
    const map = new Map<string, LiveRelayRecord>();
    for (const r of liveRelays) map.set(r.url, r);
    return map;
  }, [liveRelays]);

  const [resolving, setResolving] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Check NIP-05 first
    if (isNIP05(input)) {
      setResolving(true);
      const hex = await resolveNIP05(input);
      setResolving(false);
      if (hex) {
        setSearchedPubkey(hex);
        return;
      }
      setError(`Could not resolve NIP-05 identifier "${input}". Check the address and try again.`);
      return;
    }

    const hex = resolveToHex(input);
    if (!hex) {
      setError('Invalid input. Enter an npub, nprofile, NIP-05 address (user@domain.com), or 64-char hex pubkey.');
      return;
    }
    setSearchedPubkey(hex);
  };

  const readRelays = lookupResult?.relays.filter((r) => r.read) ?? [];
  const writeRelays = lookupResult?.relays.filter((r) => r.write) ?? [];
  const allRelays = lookupResult?.relays ?? [];

  const diagnostics = useMemo(() => {
    if (!lookupResult) return null;
    return computeDiagnostics(lookupResult.relays, relayMap);
  }, [lookupResult, relayMap]);

  const currentRelayUrls = useMemo(() => new Set(allRelays.map(r => r.url)), [allRelays]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-3">
          <Stethoscope className="w-3.5 h-3.5" />
          Relay Diagnostic
        </div>
        <h1 className="text-3xl font-black mb-2">Fix My Nostr</h1>
        <p className="text-muted-foreground text-sm max-w-xl">
          Diagnose any Nostr user's relay configuration. See which relays are online, find problems,
          and get suggestions for better relays. Perfect for debugging "why can't my followers see my posts".
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative search-glow rounded-xl border border-border/60 bg-card shadow-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Input
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(''); }}
            placeholder="npub, nprofile, NIP-05 (user@domain.com), or hex…"
            className="pl-12 pr-36 h-14 text-base border-0 bg-transparent focus-visible:ring-0 rounded-xl font-mono"
          />
          <Button
            type="submit"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-5 font-semibold glow-primary-sm"
            disabled={isLoading || resolving || !input.trim()}
          >
            {resolving ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Resolving NIP-05…</>
            ) : (isLoading || isFetching) ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Diagnosing…</>
            ) : (
              'Diagnose'
            )}
          </Button>
        </div>
        {error && (
          <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </p>
        )}
      </form>

      {/* No results */}
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

      {/* Results */}
      {lookupResult && (
        <div className="space-y-6">
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

          {/* Diagnostic */}
          {diagnostics && (
            <DiagnosticCard score={diagnostics.score} grade={diagnostics.grade} issues={diagnostics.issues} />
          )}

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

          {/* Suggestions */}
          {diagnostics && diagnostics.score < 90 && (
            <SuggestedRelays currentRelayUrls={currentRelayUrls} liveRelays={liveRelays} />
          )}
        </div>
      )}
    </div>
  );
}
