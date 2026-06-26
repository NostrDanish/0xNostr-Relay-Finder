/**
 * DiagnosticPage — "Fix My Nostr" Diagnostic Wizard
 *
 * Paste your npub → auto-analyzes relay health → gives actionable recommendations.
 * The most useful thing a relay finder could do.
 *
 * Steps:
 * 1. Fetch kind:10002 relay list
 * 2. Ping each relay (WS connect + RTT)
 * 3. Test critical NIPs on each relay
 * 4. Score overall health
 * 5. Give plain-English recommendations
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import {
  Stethoscope, Search, Loader2, AlertCircle, CheckCircle2, XCircle,
  Wifi, WifiOff, ArrowRight, BookOpen, Send, Shield, AlertTriangle,
  Zap, RefreshCw, Copy, Check, Radio, Info, Clock, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNpubLookup, resolveToHex, type UserRelay } from '@/hooks/useNpubLookup';
import { useLiveRelayStore, type LiveRelayRecord } from '@/hooks/useLiveRelayStore';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { cn, shortenUrl, relayUrlToId } from '@/lib/utils';
import { AddToRelayListButton } from '@/components/relay/AddToRelayListButton';

// ─── Types ────────────────────────────────────────────────────────────────────

type RelayHealth = 'healthy' | 'degraded' | 'dead' | 'untested';

interface RelayProbeResult {
  url: string;
  health: RelayHealth;
  latencyMs?: number;
  error?: string;
  read: boolean;
  write: boolean;
  inDirectory: boolean;
}

interface DiagnosticIssue {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  action?: string;
  relayUrl?: string;
}

interface DiagnosticReport {
  probes: RelayProbeResult[];
  issues: DiagnosticIssue[];
  overallScore: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
}

// ─── Probe a single relay ─────────────────────────────────────────────────────

async function probeRelay(url: string): Promise<{ latencyMs?: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    let opened = false;

    try {
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        ws.close();
        resolve({ error: 'Connection timeout (8s)' });
      }, 8000);

      ws.onopen = () => {
        opened = true;
        const latencyMs = Date.now() - start;
        clearTimeout(timeout);
        ws.close();
        resolve({ latencyMs });
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        if (!opened) resolve({ error: 'Connection failed (CORS or offline)' });
      };

      ws.onclose = (e) => {
        clearTimeout(timeout);
        if (!opened) resolve({ error: `Connection closed: code ${e.code}` });
      };
    } catch (err) {
      resolve({ error: String(err) });
    }
  });
}

// ─── Grade calculation ────────────────────────────────────────────────────────

function calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

const GRADE_COLORS = {
  A: 'text-emerald-500 bg-emerald-500/15 border-emerald-500/25',
  B: 'text-green-500 bg-green-500/15 border-green-500/25',
  C: 'text-yellow-500 bg-yellow-500/15 border-yellow-500/25',
  D: 'text-orange-500 bg-orange-500/15 border-orange-500/25',
  F: 'text-red-500 bg-red-500/15 border-red-500/25',
};

// ─── Components ───────────────────────────────────────────────────────────────

function ProfileHeader({ pubkey }: { pubkey: string }) {
  const author = useAuthor(pubkey);
  const meta = author.data?.metadata;
  const name = meta?.name ?? genUserName(pubkey);

  return (
    <div className="flex items-center gap-4">
      <Avatar className="w-12 h-12 border-2 border-primary/20">
        <AvatarImage src={meta?.picture} alt={name} />
        <AvatarFallback className="text-lg font-bold">{name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <h2 className="text-lg font-bold truncate">{name}</h2>
        <p className="text-xs text-muted-foreground font-mono truncate">
          {pubkey.slice(0, 16)}…{pubkey.slice(-8)}
        </p>
      </div>
    </div>
  );
}

function RelayProbeRow({ probe }: { probe: RelayProbeResult }) {
  const [detailOpen, setDetailOpen] = useState(false);

  const healthIcon = {
    healthy: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    degraded: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
    dead: <XCircle className="w-4 h-4 text-red-500" />,
    untested: <Clock className="w-4 h-4 text-muted-foreground" />,
  }[probe.health];

  const healthLabel = {
    healthy: 'Healthy',
    degraded: 'Slow',
    dead: 'Dead',
    untested: 'Untested',
  }[probe.health];

  return (
    <div className={cn(
      'flex flex-col sm:flex-row sm:items-center gap-2 py-3 border-b border-border/40 last:border-0',
      probe.health === 'dead' && 'opacity-75',
    )}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {healthIcon}
        <div className="min-w-0 flex-1">
          <code className="text-sm font-mono truncate block">{shortenUrl(probe.url)}</code>
          <div className="flex items-center gap-2 mt-0.5">
            {probe.read && (
              <span className="text-xs bg-blue-500/10 text-blue-500 border border-blue-500/20 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                <BookOpen className="w-2.5 h-2.5" /> R
              </span>
            )}
            {probe.write && (
              <span className="text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-0.5">
                <Send className="w-2.5 h-2.5" /> W
              </span>
            )}
            <span className={cn(
              'text-xs font-medium',
              probe.health === 'healthy' ? 'text-emerald-500' :
              probe.health === 'degraded' ? 'text-yellow-500' :
              probe.health === 'dead' ? 'text-red-500' :
              'text-muted-foreground',
            )}>
              {healthLabel}
            </span>
            {probe.latencyMs != null && (
              <span className="text-xs text-muted-foreground tabular-nums">{probe.latencyMs}ms</span>
            )}
            {probe.error && (
              <span className="text-xs text-red-500/80 truncate max-w-[200px]">{probe.error}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {probe.inDirectory && (
          <Link to={`/relay/${relayUrlToId(probe.url)}`}>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
              Details <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function IssueCard({ issue }: { issue: DiagnosticIssue }) {
  const severityConfig = {
    critical: { icon: XCircle, color: 'border-red-500/30 bg-red-500/5', iconColor: 'text-red-500' },
    warning: { icon: AlertTriangle, color: 'border-yellow-500/30 bg-yellow-500/5', iconColor: 'text-yellow-500' },
    info: { icon: Info, color: 'border-blue-500/30 bg-blue-500/5', iconColor: 'text-blue-500' },
  }[issue.severity];

  const Icon = severityConfig.icon;

  return (
    <div className={cn('rounded-lg border p-3 space-y-1.5', severityConfig.color)}>
      <div className="flex items-start gap-2">
        <Icon className={cn('w-4 h-4 flex-shrink-0 mt-0.5', severityConfig.iconColor)} />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold">{issue.title}</h4>
          <p className="text-xs text-muted-foreground">{issue.description}</p>
          {issue.action && (
            <p className="text-xs font-medium mt-1 text-foreground">{issue.action}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function DiagnosticPage() {
  const [input, setInput] = useState('');
  const [searchedPubkey, setSearchedPubkey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [diagState, setDiagState] = useState<'idle' | 'probing' | 'done'>('idle');
  const [probeProgress, setProbeProgress] = useState(0);
  const [report, setReport] = useState<DiagnosticReport | null>(null);

  const { relays: liveRelays } = useLiveRelayStore();
  const { data: lookupResult, isLoading: lookupLoading } = useNpubLookup(searchedPubkey);

  useSeoMeta({
    title: 'Fix My Nostr — Relay Health Diagnostic',
    description: "Diagnose your Nostr relay setup. Find dead relays, slow connections, and get actionable recommendations to fix your Nostr experience.",
  });

  // Build relay map for directory lookups
  const relayMap = useMemo(() => {
    const map = new Map<string, LiveRelayRecord>();
    for (const r of liveRelays) map.set(r.url, r);
    return map;
  }, [liveRelays]);

  // Recommended replacements for dead relays
  const recommendations = useMemo(() => {
    return [...liveRelays]
      .filter((r) => r.isOnline && r.isFree && r.uptimePercent30d >= 97)
      .sort((a, b) => b.uptimePercent30d - a.uptimePercent30d)
      .slice(0, 5);
  }, [liveRelays]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setReport(null);
    setDiagState('idle');

    const hex = resolveToHex(input);
    if (!hex) {
      setError('Invalid input. Enter an npub (npub1…), nprofile (nprofile1…), or 64-char hex pubkey.');
      return;
    }
    setSearchedPubkey(hex);
  };

  // Run diagnostic when lookup completes
  const runDiagnostic = useCallback(async (relays: UserRelay[]) => {
    setDiagState('probing');
    setProbeProgress(0);

    const probes: RelayProbeResult[] = [];
    const total = relays.length;

    // Probe each relay
    for (let i = 0; i < relays.length; i++) {
      const relay = relays[i];
      const result = await probeRelay(relay.url);
      const inDirectory = relayMap.has(relay.url);

      let health: RelayHealth = 'untested';
      if (result.error) {
        health = 'dead';
      } else if (result.latencyMs != null) {
        health = result.latencyMs > 500 ? 'degraded' : 'healthy';
      }

      probes.push({
        url: relay.url,
        health,
        latencyMs: result.latencyMs,
        error: result.error,
        read: relay.read,
        write: relay.write,
        inDirectory,
      });

      setProbeProgress(Math.round(((i + 1) / total) * 100));
    }

    // Analyze issues
    const issues: DiagnosticIssue[] = [];

    const deadRelays = probes.filter((p) => p.health === 'dead');
    const degradedRelays = probes.filter((p) => p.health === 'degraded');
    const healthyRelays = probes.filter((p) => p.health === 'healthy');
    const writeRelays = probes.filter((p) => p.write);
    const readRelays = probes.filter((p) => p.read);

    // Critical: Dead write relays
    const deadWriteRelays = deadRelays.filter((p) => p.write);
    if (deadWriteRelays.length > 0) {
      issues.push({
        severity: 'critical',
        title: `${deadWriteRelays.length} write relay${deadWriteRelays.length > 1 ? 's are' : ' is'} dead`,
        description: `Your posts may not be reaching followers who look for your content on: ${deadWriteRelays.map(r => shortenUrl(r.url)).join(', ')}`,
        action: `Replace ${deadWriteRelays.length > 1 ? 'these' : 'this'} with a working relay. We recommend ${recommendations[0] ? shortenUrl(recommendations[0].url) : 'checking our directory'}.`,
      });
    }

    // Critical: All relays dead
    if (deadRelays.length === probes.length) {
      issues.push({
        severity: 'critical',
        title: 'All your relays are unreachable!',
        description: 'Nobody can see your posts or send you messages. Your Nostr presence is effectively offline.',
        action: 'Add at least 2-3 reliable relays immediately. Visit our Explore page for recommendations.',
      });
    }

    // Critical: No write relays alive
    if (writeRelays.length > 0 && writeRelays.every((r) => r.health === 'dead')) {
      issues.push({
        severity: 'critical',
        title: 'No working write relays',
        description: 'None of your write relays are responding. Your posts cannot be published.',
        action: 'Add a working write relay like wss://relay.damus.io or wss://nos.lol.',
      });
    }

    // Warning: Dead read relays
    const deadReadRelays = deadRelays.filter((p) => p.read && !p.write);
    if (deadReadRelays.length > 0) {
      issues.push({
        severity: 'warning',
        title: `${deadReadRelays.length} read-only relay${deadReadRelays.length > 1 ? 's are' : ' is'} dead`,
        description: `You may be missing mentions and replies sent to: ${deadReadRelays.map(r => shortenUrl(r.url)).join(', ')}`,
        action: 'Remove dead read relays and replace with working ones.',
      });
    }

    // Warning: High latency
    if (degradedRelays.length > 0) {
      issues.push({
        severity: 'warning',
        title: `${degradedRelays.length} relay${degradedRelays.length > 1 ? 's have' : ' has'} high latency (>500ms)`,
        description: `Slow relays cause noticeable delays: ${degradedRelays.map(r => `${shortenUrl(r.url)} (${r.latencyMs}ms)`).join(', ')}`,
        action: 'Consider replacing slow relays or adding faster alternatives.',
      });
    }

    // Warning: Too few relays
    if (probes.length < 3) {
      issues.push({
        severity: 'warning',
        title: 'Too few relays',
        description: `You only have ${probes.length} relay${probes.length === 1 ? '' : 's'}. If one goes down, you lose significant connectivity. Best practice is 3-5 relays.`,
        action: 'Add 2-3 more relays for redundancy.',
      });
    }

    // Warning: Too many relays
    if (probes.length > 10) {
      issues.push({
        severity: 'info',
        title: 'Many relays configured',
        description: `You have ${probes.length} relays. More than 5-7 relays rarely improves reach but increases connection overhead for your client.`,
        action: 'Consider trimming to your best 5-7 relays.',
      });
    }

    // Info: No relay list published
    if (probes.length === 0) {
      issues.push({
        severity: 'critical',
        title: 'No relay list published',
        description: "You haven't published a NIP-65 relay list. Other users' clients can't efficiently find your content or send you messages.",
        action: 'Use the Lookup page or a Nostr client to publish your relay preferences.',
      });
    }

    // Info: Good health
    if (healthyRelays.length >= 3 && deadRelays.length === 0) {
      issues.push({
        severity: 'info',
        title: 'Your relay setup looks great!',
        description: `All ${healthyRelays.length} relays are healthy with good response times.`,
      });
    }

    // Calculate score
    const total2 = probes.length || 1;
    const healthyPct = (healthyRelays.length / total2) * 100;
    const degradedPenalty = (degradedRelays.length / total2) * 20;
    const deadPenalty = (deadRelays.length / total2) * 60;
    const countBonus = probes.length >= 3 && probes.length <= 7 ? 10 : 0;
    const writeBonus = writeRelays.some((r) => r.health === 'healthy') ? 10 : -20;
    const readBonus = readRelays.some((r) => r.health === 'healthy') ? 5 : -10;

    let score = Math.round(
      Math.min(100, Math.max(0,
        healthyPct - degradedPenalty - deadPenalty + countBonus + writeBonus + readBonus
      ))
    );

    // Clamp for edge cases
    if (probes.length === 0) score = 0;
    if (deadRelays.length === probes.length && probes.length > 0) score = 0;

    const grade = calculateGrade(score);

    // Summary
    let summary: string;
    if (score >= 90) summary = 'Excellent! Your relay setup is healthy and well-configured.';
    else if (score >= 75) summary = 'Good setup with minor issues. A few tweaks would optimize your experience.';
    else if (score >= 60) summary = 'Moderate issues detected. Some relays need attention for reliable connectivity.';
    else if (score >= 40) summary = 'Significant problems. Multiple relays are down or unreachable.';
    else summary = 'Critical issues! Your Nostr connectivity is severely impaired.';

    setReport({ probes, issues, overallScore: score, grade, summary });
    setDiagState('done');
  }, [relayMap, recommendations]);

  // Auto-run diagnostic when lookup completes
  useEffect(() => {
    if (lookupResult && diagState === 'idle' && lookupResult.relays.length > 0) {
      runDiagnostic(lookupResult.relays);
    }
  }, [lookupResult, diagState, runDiagnostic]);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Stethoscope className="w-5 h-5 text-primary" />
          <h1 className="text-3xl font-black">Fix My Nostr</h1>
        </div>
        <p className="text-muted-foreground text-sm max-w-xl">
          Paste your npub to diagnose your relay setup. We'll check every relay in your list,
          find problems, and tell you exactly how to fix them.
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative search-glow rounded-xl border border-border/60 bg-card shadow-lg">
          <Stethoscope className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <Input
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(''); }}
            placeholder="Paste your npub to start diagnosis…"
            className="pl-12 pr-36 h-14 text-base border-0 bg-transparent focus-visible:ring-0 rounded-xl font-mono"
          />
          <Button
            type="submit"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-5 font-semibold glow-primary-sm"
            disabled={lookupLoading || !input.trim()}
          >
            {lookupLoading ? (
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

      {/* No relay list found */}
      {searchedPubkey && !lookupLoading && !lookupResult && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <WifiOff className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="font-bold text-lg mb-2">No Relay List Found</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              This user hasn't published a NIP-65 relay list. Without one, other users' clients
              can't efficiently find content or route messages.
            </p>
            <p className="text-sm font-medium text-foreground">
              Publish a relay list using your Nostr client or visit the <Link to="/lookup" className="text-primary underline">Lookup page</Link>.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Probing progress */}
      {diagState === 'probing' && searchedPubkey && (
        <div className="space-y-4">
          <ProfileHeader pubkey={searchedPubkey} />
          <Card className="border-border/60">
            <CardContent className="py-8 text-center space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
              <h3 className="font-bold text-lg">Diagnosing Relay Health…</h3>
              <p className="text-sm text-muted-foreground">
                Testing {lookupResult?.relays.length ?? 0} relays for connectivity and latency
              </p>
              <Progress value={probeProgress} className="max-w-xs mx-auto" />
              <p className="text-xs text-muted-foreground tabular-nums">{probeProgress}% complete</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results */}
      {diagState === 'done' && report && searchedPubkey && (
        <div className="space-y-6">
          <ProfileHeader pubkey={searchedPubkey} />

          {/* Grade card */}
          <Card className="border-border/60 overflow-hidden">
            <div className={cn(
              'h-1.5 w-full',
              report.grade === 'A' || report.grade === 'B' ? 'bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-500' :
              report.grade === 'C' ? 'bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-500' :
              'bg-gradient-to-r from-red-500 via-orange-500 to-red-500',
            )} />
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Grade badge */}
                <div className={cn(
                  'w-20 h-20 rounded-2xl border-2 flex items-center justify-center flex-shrink-0',
                  GRADE_COLORS[report.grade],
                )}>
                  <span className="text-4xl font-black">{report.grade}</span>
                </div>

                {/* Score + summary */}
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-baseline gap-2 justify-center sm:justify-start">
                    <span className="text-3xl font-black">{report.overallScore}</span>
                    <span className="text-sm text-muted-foreground">/100</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{report.summary}</p>
                  <div className="flex items-center gap-3 mt-2 justify-center sm:justify-start text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      {report.probes.filter((p) => p.health === 'healthy').length} healthy
                    </span>
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-yellow-500" />
                      {report.probes.filter((p) => p.health === 'degraded').length} slow
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-red-500" />
                      {report.probes.filter((p) => p.health === 'dead').length} dead
                    </span>
                  </div>
                </div>

                {/* Re-run button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 flex-shrink-0"
                  onClick={() => {
                    setDiagState('idle');
                    setReport(null);
                    if (lookupResult) runDiagnostic(lookupResult.relays);
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Re-run
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Issues */}
          {report.issues.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-primary" />
                Issues & Recommendations
              </h3>
              {report.issues.map((issue, i) => (
                <IssueCard key={i} issue={issue} />
              ))}
            </div>
          )}

          {/* Relay probe results */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className="w-4 h-4 text-primary" />
                Relay Probe Results
                <Badge variant="secondary" className="text-xs ml-auto">
                  {report.probes.length} relays
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {report.probes.map((probe) => (
                <RelayProbeRow key={probe.url} probe={probe} />
              ))}
            </CardContent>
          </Card>

          {/* Recommended replacements */}
          {report.probes.some((p) => p.health === 'dead') && recommendations.length > 0 && (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-violet-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Recommended Replacements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground mb-3">
                  These relays have 97%+ uptime and are free to use. Click "Add to Relays" to update your relay list instantly via NIP-07.
                </p>
                {recommendations.map((relay) => (
                  <div
                    key={relay.id}
                    className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0"
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <code className="text-sm font-mono truncate block">{shortenUrl(relay.url)}</code>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{relay.uptimePercent30d.toFixed(1)}% uptime</span>
                        {relay.avgLatencyMs && <span>{relay.avgLatencyMs}ms</span>}
                        <span>{relay.countryName}</span>
                      </div>
                    </div>
                    <AddToRelayListButton relayUrl={relay.url} variant="compact" />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
