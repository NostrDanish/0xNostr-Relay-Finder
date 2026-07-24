/**
 * BuildPage — "Build My Relay Set" Wizard
 *
 * The killer feature: users answer a few questions and get a complete,
 * optimized relay set they can export as JSON, kind:10002 event, or QR code.
 * Solves the #1 pain point every new Nostr user faces.
 */

import { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import {
  Wrench, ArrowRight, ArrowLeft, CheckCircle2, MessageCircle, Image, Lock,
  Globe2, Zap, DollarSign, Shield, Wifi, TrendingUp, Radio, Crown,
  Copy, Check, Download, QrCode, Sparkles, RefreshCw, Plus, X,
  Bot, FileText, Users, Inbox, Clock, MapPin, Code2, Send,
  BookOpen, Loader2, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QRCodeCanvas } from '@/components/ui/qrcode';
import { SparklineChart } from '@/components/relay/SparklineChart';
import { AddToRelayListButton } from '@/components/relay/AddToRelayListButton';
import { useLiveRelayStore, type LiveRelayRecord } from '@/hooks/useLiveRelayStore';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { computeHealthScore, gradeColor, gradeBgColor } from '@/lib/healthScore';
import { relayUrlToId, shortenUrl, formatLatency, cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type UseCase = 'notes' | 'messaging' | 'blossom' | 'longform' | 'bot' | 'everything';
type PricingPref = 'free' | 'paid' | 'both';
type Region = 'europe' | 'north-america' | 'asia' | 'worldwide';

interface WizardState {
  useCase: UseCase | null;
  pricing: PricingPref | null;
  authRequired: boolean;
  maxLatency: number; // ms
  minUptime: number; // percent
  region: Region | null;
  minNips: number;
}

const INITIAL_STATE: WizardState = {
  useCase: null,
  pricing: null,
  authRequired: false,
  maxLatency: 500,
  minUptime: 95,
  region: null,
  minNips: 10,
};

// ─── Step Configurations ────────────────────────────────────────────────────

const USE_CASE_OPTIONS: { value: UseCase; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'notes', label: 'Notes & Social', icon: <MessageCircle className="w-5 h-5" />, desc: 'Short posts, feeds, threads, reactions' },
  { value: 'messaging', label: 'Messaging & DMs', icon: <Lock className="w-5 h-5" />, desc: 'Private messages, NIP-17, giftwrap' },
  { value: 'blossom', label: 'Media & Blossom', icon: <Image className="w-5 h-5" />, desc: 'Images, video, file storage, NIP-94/96' },
  { value: 'longform', label: 'Long-Form Writing', icon: <FileText className="w-5 h-5" />, desc: 'Articles, blogs, NIP-23 content' },
  { value: 'bot', label: 'Bot / Automation', icon: <Bot className="w-5 h-5" />, desc: 'High-throughput, event relaying' },
  { value: 'everything', label: 'Everything', icon: <Globe2 className="w-5 h-5" />, desc: 'I want maximum coverage' },
];

const PRICING_OPTIONS: { value: PricingPref; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'free', label: 'Free Only', icon: <Zap className="w-5 h-5" />, desc: 'No cost, open access' },
  { value: 'paid', label: 'Paid Preferred', icon: <DollarSign className="w-5 h-5" />, desc: 'Better quality, less spam' },
  { value: 'both', label: 'Mix of Both', icon: <CheckCircle2 className="w-5 h-5" />, desc: 'Best balance of reach and quality' },
];

const REGION_OPTIONS: { value: Region; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'europe', label: 'Europe', icon: <MapPin className="w-5 h-5" />, desc: 'Relays in EU and UK' },
  { value: 'north-america', label: 'North America', icon: <MapPin className="w-5 h-5" />, desc: 'US and Canada' },
  { value: 'asia', label: 'Asia-Pacific', icon: <MapPin className="w-5 h-5" />, desc: 'Japan, Singapore, Australia' },
  { value: 'worldwide', label: 'Worldwide', icon: <Globe2 className="w-5 h-5" />, desc: 'Best from every region' },
];

const REGION_COUNTRIES: Record<Region, string[]> = {
  'europe': ['DE', 'FR', 'NL', 'GB', 'FI', 'SE', 'NO', 'CH', 'AT', 'IE', 'DK', 'IT', 'ES', 'PT', 'PL', 'CZ', 'RO', 'BG'],
  'north-america': ['US', 'CA', 'MX'],
  'asia': ['JP', 'SG', 'KR', 'AU', 'NZ', 'HK', 'TW', 'IN'],
  'worldwide': [],
};

// ─── Option Component ────────────────────────────────────────────────────────

function WizardOption<T extends string>({
  value, selected, label, icon, desc, onSelect,
}: {
  value: T; selected: boolean; label: string; icon: React.ReactNode; desc: string;
  onSelect: (v: T) => void;
}) {
  return (
    <button
      onClick={() => onSelect(value)}
      className={cn(
        'w-full text-left p-4 rounded-xl border-2 transition-all',
        selected
          ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
          : 'border-border/60 hover:border-primary/30 hover:bg-card/80'
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center',
          selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
        )}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm">{label}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
        {selected && <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />}
      </div>
    </button>
  );
}

// ─── Relay Result Card ──────────────────────────────────────────────────────

function BuildResultCard({
  relay, score, reasons, rank, mode, onSetMode,
}: {
  relay: LiveRelayRecord;
  score: number;
  reasons: string[];
  rank: number;
  mode: 'rw' | 'r' | 'w';
  onSetMode: (m: 'rw' | 'r' | 'w') => void;
}) {
  const hs = useMemo(() => computeHealthScore(relay), [relay]);

  return (
    <Card className="border-border/60 overflow-hidden">
      <div className={cn(
        'h-1 w-full',
        rank === 1 ? 'bg-gradient-to-r from-yellow-500 to-amber-400' :
        rank === 2 ? 'bg-gradient-to-r from-zinc-400 to-zinc-300' :
        rank === 3 ? 'bg-gradient-to-r from-amber-700 to-amber-600' :
        'bg-gradient-to-r from-primary/60 to-transparent'
      )} />
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-4">
          {/* Rank */}
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-black',
            rank === 1 ? 'bg-yellow-500/15 text-yellow-500' :
            rank === 2 ? 'bg-zinc-400/15 text-zinc-400' :
            rank === 3 ? 'bg-amber-700/15 text-amber-700' :
            'bg-primary/10 text-primary'
          )}>
            {rank === 1 ? <Crown className="w-5 h-5" /> : `#${rank}`}
          </div>

          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <div className={cn('w-2 h-2 rounded-full', (relay.liveOnline ?? relay.isOnline) ? 'bg-emerald-500 animate-pulse' : 'bg-red-500')} />
              <h3 className="font-bold text-sm">{relay.name}</h3>
              <div className={cn('w-6 h-6 rounded-md border text-[10px] font-black flex items-center justify-center', gradeBgColor(hs.grade))}>
                <span className={gradeColor(hs.grade)}>{hs.grade}</span>
              </div>
              {relay.isFree ? (
                <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500">Free</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-500">Paid</Badge>
              )}
            </div>

            <code className="text-xs text-muted-foreground font-mono block mb-2">{shortenUrl(relay.url)}</code>
            <p className="text-xs text-muted-foreground mb-2">{reasons.join(' / ')}</p>

            {/* Stats row */}
            <div className="flex items-center gap-4 text-xs mb-2">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                <span className="font-bold">{relay.uptimePercent30d.toFixed(1)}%</span>
              </div>
              {(relay.liveLatencyMs ?? relay.avgLatencyMs) != null && (
                <div className="flex items-center gap-1">
                  <Wifi className="w-3 h-3 text-blue-500" />
                  <span className="font-bold">{relay.liveLatencyMs ?? relay.avgLatencyMs}ms</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Radio className="w-3 h-3 text-primary" />
                <span className="font-bold">{(relay.nip11?.supported_nips?.length ?? 0)} NIPs</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-primary">{Math.round(score)} pts</span>
              </div>
            </div>

            {/* Sparkline */}
            {relay.uptimeSpark.length > 0 && (
              <SparklineChart data={relay.uptimeSpark} height={14} uptime={relay.uptimePercent30d} className="w-24" />
            )}
          </div>

          {/* R/W mode selector */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <div className="flex border border-border rounded-lg overflow-hidden text-xs">
              <button
                onClick={() => onSetMode('rw')}
                className={cn('px-2 py-1 transition-colors', mode === 'rw' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
                title="Read + Write"
              >
                R+W
              </button>
              <button
                onClick={() => onSetMode('r')}
                className={cn('px-2 py-1 transition-colors border-x border-border', mode === 'r' ? 'bg-blue-500 text-white' : 'text-muted-foreground hover:bg-accent')}
                title="Read only"
              >
                R
              </button>
              <button
                onClick={() => onSetMode('w')}
                className={cn('px-2 py-1 transition-colors', mode === 'w' ? 'bg-emerald-500 text-white' : 'text-muted-foreground hover:bg-accent')}
                title="Write only"
              >
                W
              </button>
            </div>
            <Link to={`/relay/${relayUrlToId(relay.url)}`}>
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 w-full">
                Details <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Wizard ────────────────────────────────────────────────────────────

export function BuildPage() {
  const { relays } = useLiveRelayStore();
  const { user } = useCurrentUser();
  const { mutate: publishEvent, isPending: publishing } = useNostrPublish();

  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [modes, setModes] = useState<Record<string, 'rw' | 'r' | 'w'>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [publishedRelays, setPublishedRelays] = useState(false);

  useSeoMeta({
    title: 'Build My Relay Set — 0xRelay-Finder',
    description: 'Answer a few questions and get an optimized Nostr relay set. Export as JSON, kind:10002 event, or QR code.',
  });

  const TOTAL_STEPS = 4;

  // ── Score & recommend relays ──────────────────────────────────────────────

  const recommendations = useMemo(() => {
    if (step < TOTAL_STEPS) return [];

    let candidates = relays.filter((r) => (r.liveOnline ?? r.isOnline));

    // Filter by pricing
    if (state.pricing === 'free') candidates = candidates.filter((r) => r.isFree);
    if (state.pricing === 'paid') candidates = candidates.filter((r) => !r.isFree);

    // Filter by latency
    candidates = candidates.filter((r) => {
      const lat = r.liveLatencyMs ?? r.avgLatencyMs;
      return lat == null || lat <= state.maxLatency;
    });

    // Filter by uptime
    candidates = candidates.filter((r) => r.uptimePercent30d >= state.minUptime);

    // Filter by auth
    if (state.authRequired) {
      candidates = candidates.filter(
        (r) => r.nip11?.limitation?.auth_required || r.monitorRequirements?.auth || r.useCases.includes('Privacy')
      );
    }

    // Filter by region
    if (state.region && state.region !== 'worldwide') {
      const countries = REGION_COUNTRIES[state.region];
      const regionFiltered = candidates.filter((r) => r.countryCode && countries.includes(r.countryCode));
      // Fall back to all if region filtering leaves too few
      if (regionFiltered.length >= 3) candidates = regionFiltered;
    }

    // Filter by min NIP count
    candidates = candidates.filter(
      (r) => (r.nip11?.supported_nips?.length ?? 0) >= state.minNips
    );

    // Score each relay
    const scored = candidates.map((relay) => {
      let score = 0;
      const reasons: string[] = [];
      const nips = relay.nip11?.supported_nips ?? [];

      // Uptime (40 points)
      score += (relay.uptimePercent30d / 100) * 40;
      if (relay.uptimePercent30d >= 99.5) reasons.push(`${relay.uptimePercent30d.toFixed(1)}% uptime`);

      // Latency (25 points)
      const lat = relay.liveLatencyMs ?? relay.avgLatencyMs;
      if (lat != null) {
        score += Math.max(0, 25 - (lat / 20));
        if (lat < 100) reasons.push(`Low latency (${lat}ms)`);
      }

      // NIP support (15 points)
      const nipScore = Math.min(nips.length / 3, 15);
      score += nipScore;

      // Use-case relevance (10 points)
      if (state.useCase === 'notes') {
        if (nips.includes(1)) score += 3;
        if (relay.useCases.includes('General')) { score += 5; reasons.push('General relay'); }
      }
      if (state.useCase === 'messaging') {
        if (nips.includes(17)) { score += 8; reasons.push('NIP-17 DMs'); }
        if (nips.includes(4)) { score += 3; reasons.push('NIP-04 DMs'); }
        if (relay.useCases.includes('DMs')) { score += 5; reasons.push('DM relay'); }
      }
      if (state.useCase === 'blossom') {
        if (relay.blossomSupported) { score += 10; reasons.push('Blossom support'); }
        if (nips.includes(94) || nips.includes(96)) { score += 5; reasons.push('NIP-94/96'); }
        if (relay.useCases.includes('Blossom') || relay.useCases.includes('Images')) { score += 3; reasons.push('Media relay'); }
      }
      if (state.useCase === 'longform') {
        if (nips.includes(23)) { score += 8; reasons.push('NIP-23 long-form'); }
        if (relay.useCases.includes('Long Form')) { score += 5; reasons.push('Long-form relay'); }
      }
      if (state.useCase === 'bot') {
        if (relay.useCases.includes('High Performance')) { score += 5; reasons.push('High performance'); }
        const maxSubs = relay.nip11?.limitation?.max_subscriptions;
        if (maxSubs && maxSubs >= 50) { score += 5; reasons.push(`${maxSubs} max subscriptions`); }
      }
      if (state.useCase === 'everything') {
        score += Math.min(nips.length * 0.5, 5);
        if (relay.useCases.length >= 3) { score += 3; reasons.push('Multi-purpose'); }
      }

      // Region bonus (5 points)
      if (state.region && state.region !== 'worldwide' && relay.countryCode) {
        if (REGION_COUNTRIES[state.region].includes(relay.countryCode)) {
          score += 5;
          reasons.push(`In ${state.region}`);
        }
      }

      // Community trust (5 points)
      score += (relay.trustScore / 100) * 5;

      if (reasons.length === 0) reasons.push('Solid general-purpose relay');

      return { relay, score, reasons };
    });

    return scored.sort((a, b) => b.score - a.score).slice(0, 8);
  }, [relays, state, step]);

  // ── Set mode for a relay ──────────────────────────────────────────────────

  const getMode = useCallback(
    (url: string) => modes[url] ?? 'rw',
    [modes]
  );

  const setMode = useCallback(
    (url: string, mode: 'rw' | 'r' | 'w') => {
      setModes((prev) => ({ ...prev, [url]: mode }));
    },
    []
  );

  // ── Export helpers ─────────────────────────────────────────────────────────

  const exportRelays = useMemo(() => {
    return recommendations.map((rec) => ({
      url: rec.relay.url,
      read: getMode(rec.relay.url) !== 'w',
      write: getMode(rec.relay.url) !== 'r',
    }));
  }, [recommendations, getMode]);

  const jsonExport = useMemo(
    () => JSON.stringify(exportRelays, null, 2),
    [exportRelays]
  );

  const kind10002Tags = useMemo(() => {
    return exportRelays.map((r) => {
      if (r.read && r.write) return ['r', r.url];
      if (r.read) return ['r', r.url, 'read'];
      return ['r', r.url, 'write'];
    });
  }, [exportRelays]);

  const kind10002Export = useMemo(
    () => JSON.stringify({ kind: 10002, content: '', tags: kind10002Tags }, null, 2),
    [kind10002Tags]
  );

  const nostrUriList = useMemo(
    () => exportRelays.map((r) => r.url).join('\n'),
    [exportRelays]
  );

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handlePublishRelayList = () => {
    if (!user) return;
    publishEvent(
      {
        kind: 10002,
        content: '',
        tags: kind10002Tags,
      },
      {
        onSuccess: () => {
          setPublishedRelays(true);
          setTimeout(() => setPublishedRelays(false), 5000);
        },
      }
    );
  };

  const resetWizard = () => {
    setStep(0);
    setState(INITIAL_STATE);
    setModes({});
    setPublishedRelays(false);
  };

  // ── Navigation ────────────────────────────────────────────────────────────

  const canProceed =
    step === 0 ? state.useCase != null :
    step === 1 ? state.pricing != null :
    step === 2 ? state.region != null :
    true;

  const steps = [
    { title: 'What do you use Nostr for?', subtitle: 'Choose your primary use case' },
    { title: 'Budget preference?', subtitle: 'Free relays are great, paid ones have less spam' },
    { title: 'Region & performance', subtitle: 'Fine-tune your relay preferences' },
    { title: 'Advanced settings', subtitle: 'Optional — adjust NIP support and authentication' },
  ];

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-3">
          <Wrench className="w-3.5 h-3.5" />
          Relay Set Builder
        </div>
        <h1 className="text-3xl font-black mb-2">Build My Relay Set</h1>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto">
          Answer a few questions and we'll generate the optimal relay set for your needs.
          Export as JSON, publish to Nostr, or scan a QR code.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className="flex-1">
              <div className={cn(
                'h-1.5 rounded-full transition-all',
                i < step ? 'bg-primary' : i === step ? 'bg-primary/50' : 'bg-muted'
              )} />
            </div>
          ))}
          <div className="flex-1">
            <div className={cn('h-1.5 rounded-full transition-all', step >= TOTAL_STEPS ? 'bg-primary' : 'bg-muted')} />
          </div>
        </div>
        <div className="text-xs text-muted-foreground text-center">
          {step < TOTAL_STEPS ? `Step ${step + 1} of ${TOTAL_STEPS}` : 'Your Relay Set'}
        </div>
      </div>

      {/* Wizard Steps */}
      {step < TOTAL_STEPS && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-1">{steps[step].title}</h2>
            <p className="text-sm text-muted-foreground">{steps[step].subtitle}</p>
          </div>

          <div className="space-y-3">
            {/* Step 0: Use Case */}
            {step === 0 && USE_CASE_OPTIONS.map((opt) => (
              <WizardOption
                key={opt.value}
                value={opt.value}
                selected={state.useCase === opt.value}
                label={opt.label}
                icon={opt.icon}
                desc={opt.desc}
                onSelect={(v) => setState({ ...state, useCase: v })}
              />
            ))}

            {/* Step 1: Pricing */}
            {step === 1 && PRICING_OPTIONS.map((opt) => (
              <WizardOption
                key={opt.value}
                value={opt.value}
                selected={state.pricing === opt.value}
                label={opt.label}
                icon={opt.icon}
                desc={opt.desc}
                onSelect={(v) => setState({ ...state, pricing: v })}
              />
            ))}

            {/* Step 2: Region */}
            {step === 2 && (
              <>
                <div className="space-y-3">
                  {REGION_OPTIONS.map((opt) => (
                    <WizardOption
                      key={opt.value}
                      value={opt.value}
                      selected={state.region === opt.value}
                      label={opt.label}
                      icon={opt.icon}
                      desc={opt.desc}
                      onSelect={(v) => setState({ ...state, region: v })}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Step 3: Advanced settings */}
            {step === 3 && (
              <div className="space-y-6">
                {/* Max Latency Slider */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      Maximum Latency
                    </label>
                    <span className="text-sm font-bold text-primary">&lt;{state.maxLatency}ms</span>
                  </div>
                  <Slider
                    value={[state.maxLatency]}
                    onValueChange={([v]) => setState({ ...state, maxLatency: v })}
                    min={50}
                    max={2000}
                    step={50}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>50ms</span>
                    <span>2000ms</span>
                  </div>
                </div>

                {/* Min Uptime Slider */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      Minimum Uptime
                    </label>
                    <span className="text-sm font-bold text-primary">{state.minUptime}%+</span>
                  </div>
                  <Slider
                    value={[state.minUptime]}
                    onValueChange={([v]) => setState({ ...state, minUptime: v })}
                    min={80}
                    max={99.9}
                    step={0.5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>80%</span>
                    <span>99.9%</span>
                  </div>
                </div>

                {/* Min NIPs Slider */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium flex items-center gap-2">
                      <Radio className="w-4 h-4 text-muted-foreground" />
                      Minimum NIP Support
                    </label>
                    <span className="text-sm font-bold text-primary">{state.minNips}+ NIPs</span>
                  </div>
                  <Slider
                    value={[state.minNips]}
                    onValueChange={([v]) => setState({ ...state, minNips: v })}
                    min={1}
                    max={40}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>1</span>
                    <span>40</span>
                  </div>
                </div>

                {/* Auth toggle */}
                <button
                  onClick={() => setState({ ...state, authRequired: !state.authRequired })}
                  className={cn(
                    'w-full text-left p-4 rounded-xl border-2 transition-all',
                    state.authRequired
                      ? 'border-primary bg-primary/5'
                      : 'border-border/60 hover:border-primary/30'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center',
                      state.authRequired ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    )}>
                      <Lock className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm">Require NIP-42 Auth</div>
                      <div className="text-xs text-muted-foreground">Only include relays with authentication</div>
                    </div>
                    {state.authRequired && <CheckCircle2 className="w-5 h-5 text-primary" />}
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed}
              className="gap-2"
            >
              {step === TOTAL_STEPS - 1 ? 'Build Relay Set' : 'Next'}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Results */}
      {step >= TOTAL_STEPS && (
        <div className="space-y-6">
          {/* Summary */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-primary/15 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-black text-lg">Your Optimized Relay Set</h3>
                  <p className="text-xs text-muted-foreground">
                    {recommendations.length} relays selected for {state.useCase}, {state.pricing === 'both' ? 'mixed pricing' : state.pricing}, {state.region}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">{state.useCase}</Badge>
                <Badge variant="secondary" className="text-xs">{state.pricing}</Badge>
                <Badge variant="secondary" className="text-xs">{state.region}</Badge>
                <Badge variant="secondary" className="text-xs">&lt;{state.maxLatency}ms</Badge>
                <Badge variant="secondary" className="text-xs">{state.minUptime}%+ uptime</Badge>
                <Badge variant="secondary" className="text-xs">{state.minNips}+ NIPs</Badge>
                {state.authRequired && <Badge variant="secondary" className="text-xs">NIP-42 auth</Badge>}
              </div>
            </CardContent>
          </Card>

          {/* Recommended relays */}
          {recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <BuildResultCard
                  key={rec.relay.id}
                  relay={rec.relay}
                  score={rec.score}
                  reasons={rec.reasons}
                  rank={i + 1}
                  mode={getMode(rec.relay.url)}
                  onSetMode={(m) => setMode(rec.relay.url, m)}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Radio className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-bold text-lg mb-2">No Matches Found</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Try relaxing your requirements — increase latency, lower uptime threshold, or change region to worldwide.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Export Section */}
          {recommendations.length > 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Download className="w-4 h-4 text-primary" />
                  Export Your Relay Set
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="json" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 mb-4">
                    <TabsTrigger value="json" className="text-xs gap-1.5">
                      <Code2 className="w-3 h-3" /> JSON
                    </TabsTrigger>
                    <TabsTrigger value="kind10002" className="text-xs gap-1.5">
                      <Radio className="w-3 h-3" /> kind:10002
                    </TabsTrigger>
                    <TabsTrigger value="urls" className="text-xs gap-1.5">
                      <Globe2 className="w-3 h-3" /> URLs
                    </TabsTrigger>
                    <TabsTrigger value="qr" className="text-xs gap-1.5">
                      <QrCode className="w-3 h-3" /> QR Code
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="json">
                    <div className="relative">
                      <pre className="bg-muted/50 border border-border/50 rounded-xl p-4 text-xs font-mono overflow-x-auto max-h-64">
                        {jsonExport}
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2 gap-1.5 text-xs"
                        onClick={() => handleCopy(jsonExport, 'json')}
                      >
                        {copied === 'json' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === 'json' ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="kind10002">
                    <div className="relative">
                      <pre className="bg-muted/50 border border-border/50 rounded-xl p-4 text-xs font-mono overflow-x-auto max-h-64">
                        {kind10002Export}
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2 gap-1.5 text-xs"
                        onClick={() => handleCopy(kind10002Export, 'kind10002')}
                      >
                        {copied === 'kind10002' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === 'kind10002' ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>

                    {/* Publish to Nostr button */}
                    {user && (
                      <div className="mt-3">
                        <Button
                          onClick={handlePublishRelayList}
                          disabled={publishing || publishedRelays}
                          className="gap-2 glow-primary-sm"
                        >
                          {publishing ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Publishing...</>
                          ) : publishedRelays ? (
                            <><CheckCircle2 className="w-4 h-4" /> Published to Nostr!</>
                          ) : (
                            <><Send className="w-4 h-4" /> Publish as My Relay List</>
                          )}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          This will publish a kind:10002 event to set this as your relay list.
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="urls">
                    <div className="relative">
                      <pre className="bg-muted/50 border border-border/50 rounded-xl p-4 text-xs font-mono overflow-x-auto max-h-64 whitespace-pre-wrap">
                        {nostrUriList}
                      </pre>
                      <Button
                        variant="outline"
                        size="sm"
                        className="absolute top-2 right-2 gap-1.5 text-xs"
                        onClick={() => handleCopy(nostrUriList, 'urls')}
                      >
                        {copied === 'urls' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied === 'urls' ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="qr">
                    <div className="flex flex-col items-center gap-4 py-4">
                      <div className="bg-white p-4 rounded-xl">
                        <QRCodeCanvas value={nostrUriList} size={200} />
                      </div>
                      <p className="text-xs text-muted-foreground text-center max-w-sm">
                        Scan this QR code to copy your relay URLs. Works great for sharing
                        your relay set with others or importing on mobile.
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Button variant="outline" onClick={resetWizard} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Start Over
            </Button>
            <Link to="/relays">
              <Button variant="outline" className="gap-2 w-full sm:w-auto">
                <Radio className="w-4 h-4" /> Browse All Relays
              </Button>
            </Link>
            <Link to="/compare">
              <Button variant="outline" className="gap-2 w-full sm:w-auto">
                <Sparkles className="w-4 h-4" /> Compare Relays
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
