/**
 * RecommenderPage — "Best Relay for Me" Quiz
 *
 * A short interactive quiz that surfaces the best relay for the user's needs.
 * 3-4 questions → personalized recommendations from the directory.
 */

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import {
  Sparkles, MessageCircle, Image, Lock, Zap, Globe2,
  ArrowRight, ArrowLeft, CheckCircle2, Radio, Crown,
  Wifi, TrendingUp, RefreshCw, DollarSign, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLiveRelayStore, type LiveRelayRecord } from '@/hooks/useLiveRelayStore';
import { AddToRelayListButton } from '@/components/relay/AddToRelayListButton';
import { SparklineChart } from '@/components/relay/SparklineChart';
import { relayUrlToId, shortenUrl } from '@/lib/utils';

type UseCase = 'general' | 'dms' | 'longform' | 'media' | 'communities';
type Pricing = 'free' | 'paid' | 'any';
type Privacy = 'public' | 'auth' | 'max';

interface QuizAnswers {
  useCase: UseCase | null;
  pricing: Pricing | null;
  privacy: Privacy | null;
}

const USE_CASE_OPTIONS: { value: UseCase; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'general', label: 'General Chat', icon: <MessageCircle className="w-5 h-5" />, desc: 'Notes, feeds, social interactions' },
  { value: 'dms', label: 'Direct Messages', icon: <Lock className="w-5 h-5" />, desc: 'Private conversations, NIP-17' },
  { value: 'longform', label: 'Long-Form Content', icon: <Globe2 className="w-5 h-5" />, desc: 'Articles, blogs, NIP-23' },
  { value: 'media', label: 'Images & Video', icon: <Image className="w-5 h-5" />, desc: 'Blossom, NIP-94/96 media' },
  { value: 'communities', label: 'Communities', icon: <Globe2 className="w-5 h-5" />, desc: 'Groups, moderated spaces' },
];

const PRICING_OPTIONS: { value: Pricing; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'free', label: 'Free Only', icon: <Zap className="w-5 h-5" />, desc: 'No cost, open access relays' },
  { value: 'paid', label: 'Happy to Pay', icon: <DollarSign className="w-5 h-5" />, desc: 'Premium quality, less spam' },
  { value: 'any', label: 'Either is Fine', icon: <CheckCircle2 className="w-5 h-5" />, desc: 'Show me the best options' },
];

const PRIVACY_OPTIONS: { value: Privacy; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'public', label: 'Public is Fine', icon: <Globe2 className="w-5 h-5" />, desc: 'Maximum reach and visibility' },
  { value: 'auth', label: 'Prefer Auth', icon: <Lock className="w-5 h-5" />, desc: 'NIP-42 auth for some protection' },
  { value: 'max', label: 'Maximum Privacy', icon: <Shield className="w-5 h-5" />, desc: 'Encrypted, auth-required relays' },
];

function QuizOption<T extends string>({
  value, selected, label, icon, desc, onSelect,
}: {
  value: T; selected: boolean; label: string; icon: React.ReactNode; desc: string;
  onSelect: (v: T) => void;
}) {
  return (
    <button
      onClick={() => onSelect(value)}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
        selected
          ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
          : 'border-border/60 hover:border-primary/30 hover:bg-card/80'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
        }`}>
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

function RecommendationCard({ relay, reason, rank }: { relay: LiveRelayRecord; reason: string; rank: number }) {
  return (
    <Card className="border-border/60 overflow-hidden">
      <div className="h-0.5 w-full bg-gradient-to-r from-primary/60 via-violet-500/40 to-transparent" />
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-black ${
            rank === 1 ? 'bg-yellow-500/15 text-yellow-500' :
            rank === 2 ? 'bg-zinc-400/15 text-zinc-400' :
            'bg-primary/10 text-primary'
          }`}>
            {rank === 1 ? <Crown className="w-5 h-5" /> : `#${rank}`}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <div className={`w-2 h-2 rounded-full ${(relay.liveOnline ?? relay.isOnline) ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              <h3 className="font-bold text-sm">{relay.name}</h3>
              {relay.isFree ? (
                <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-500">Free</Badge>
              ) : (
                <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-500">Paid</Badge>
              )}
            </div>
            <code className="text-xs text-muted-foreground font-mono block mb-2">{shortenUrl(relay.url)}</code>
            <p className="text-xs text-muted-foreground mb-3">{reason}</p>

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                <span className="font-bold">{relay.uptimePercent30d.toFixed(1)}%</span>
                <span className="text-muted-foreground">uptime</span>
              </div>
              {(relay.liveLatencyMs ?? relay.avgLatencyMs) != null && (
                <div className="flex items-center gap-1">
                  <Wifi className="w-3 h-3 text-blue-500" />
                  <span className="font-bold">{relay.liveLatencyMs ?? relay.avgLatencyMs}ms</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Radio className="w-3 h-3 text-primary" />
                <span className="font-bold">{(relay.nip11?.supported_nips?.length ?? 0)}</span>
                <span className="text-muted-foreground">NIPs</span>
              </div>
            </div>

            {/* Sparkline */}
            {relay.uptimeSpark.length > 0 && (
              <div className="mt-2">
                <SparklineChart data={relay.uptimeSpark} height={16} uptime={relay.uptimePercent30d} className="w-24" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 flex-shrink-0">
            <div onClick={(e) => e.stopPropagation()}>
              <AddToRelayListButton relayUrl={relay.url} variant="compact" />
            </div>
            <Link to={`/relay/${relayUrlToId(relay.url)}`}>
              <Button variant="ghost" size="sm" className="text-xs gap-1 h-7">
                Details <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RecommenderPage() {
  const { relays } = useLiveRelayStore();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({ useCase: null, pricing: null, privacy: null });

  useSeoMeta({
    title: 'Find the Best Relay for You - 0xRelay-Finder',
    description: 'Take a quick quiz to find the perfect Nostr relay for your needs. Personalized recommendations based on your use case, budget, and privacy requirements.',
  });

  const recommendations = useMemo(() => {
    if (step < 3) return [];

    let candidates = relays.filter(r => (r.liveOnline ?? r.isOnline));

    // Filter by pricing
    if (answers.pricing === 'free') candidates = candidates.filter(r => r.isFree);
    if (answers.pricing === 'paid') candidates = candidates.filter(r => !r.isFree);

    // Filter by privacy
    if (answers.privacy === 'auth') {
      candidates = candidates.filter(r =>
        r.nip11?.limitation?.auth_required || r.useCases.includes('Privacy')
      );
    }
    if (answers.privacy === 'max') {
      candidates = candidates.filter(r =>
        r.nip11?.limitation?.auth_required || r.useCases.includes('Privacy')
      );
    }

    // Score based on use case relevance
    const scored = candidates.map(relay => {
      let score = relay.uptimePercent30d;
      const reasons: string[] = [];
      const nips = relay.nip11?.supported_nips ?? [];

      if (answers.useCase === 'general') {
        if (relay.useCases.includes('General')) { score += 20; reasons.push('General purpose relay'); }
        if (relay.uptimePercent30d >= 99) { score += 10; reasons.push(`${relay.uptimePercent30d.toFixed(1)}% uptime`); }
      }
      if (answers.useCase === 'dms') {
        if (nips.includes(17)) { score += 30; reasons.push('NIP-17 private DM support'); }
        if (nips.includes(4)) { score += 10; reasons.push('NIP-04 encrypted DMs'); }
        if (relay.useCases.includes('DMs')) { score += 20; reasons.push('Optimized for DMs'); }
      }
      if (answers.useCase === 'longform') {
        if (nips.includes(23)) { score += 30; reasons.push('NIP-23 long-form support'); }
        if (relay.useCases.includes('Long Form')) { score += 20; reasons.push('Long-form content relay'); }
      }
      if (answers.useCase === 'media') {
        if (relay.blossomSupported) { score += 30; reasons.push('Blossom media server support'); }
        if (nips.includes(94) || nips.includes(96)) { score += 20; reasons.push('NIP-94/96 file storage'); }
        if (relay.useCases.includes('Blossom') || relay.useCases.includes('Images')) { score += 15; reasons.push('Media-optimized'); }
      }
      if (answers.useCase === 'communities') {
        if (nips.includes(29)) { score += 30; reasons.push('NIP-29 relay groups'); }
        if (nips.includes(72)) { score += 20; reasons.push('NIP-72 moderated communities'); }
        if (relay.useCases.includes('Communities')) { score += 15; reasons.push('Community relay'); }
      }

      // Bonus for latency
      const lat = relay.liveLatencyMs ?? relay.avgLatencyMs;
      if (lat != null && lat < 100) { score += 5; reasons.push('Low latency'); }

      // Bonus for NIP-66 data
      if (relay.nip66?.enriched) { score += 3; }

      const reason = reasons.length > 0 ? reasons.join(' / ') : 'Solid general-purpose relay';

      return { relay, score, reason };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [relays, answers, step]);

  const steps = [
    { title: 'What do you use Nostr for?', subtitle: 'Select your primary use case' },
    { title: 'Do you want a free relay?', subtitle: 'Free relays are great, but paid ones have less spam' },
    { title: 'How important is privacy?', subtitle: 'Public relays have more reach, auth relays offer more control' },
  ];

  const canProceed = step === 0 ? answers.useCase != null :
                     step === 1 ? answers.pricing != null :
                     step === 2 ? answers.privacy != null : true;

  const resetQuiz = () => {
    setStep(0);
    setAnswers({ useCase: null, pricing: null, privacy: null });
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          Relay Finder
        </div>
        <h1 className="text-3xl font-black mb-2">Find the Best Relay for You</h1>
        <p className="text-muted-foreground text-sm">
          Answer 3 quick questions and we'll recommend the perfect relays from our directory.
        </p>
      </div>

      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex-1">
              <div className={`h-1.5 rounded-full transition-all ${
                i < step ? 'bg-primary' :
                i === step ? 'bg-primary/50' :
                'bg-muted'
              }`} />
            </div>
          ))}
          <div className="flex-1">
            <div className={`h-1.5 rounded-full transition-all ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
          </div>
        </div>
        <div className="text-xs text-muted-foreground text-center">
          {step < 3 ? `Step ${step + 1} of 3` : 'Results'}
        </div>
      </div>

      {/* Quiz steps */}
      {step < 3 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-1">{steps[step].title}</h2>
            <p className="text-sm text-muted-foreground">{steps[step].subtitle}</p>
          </div>

          <div className="space-y-3">
            {step === 0 && USE_CASE_OPTIONS.map(opt => (
              <QuizOption
                key={opt.value}
                value={opt.value}
                selected={answers.useCase === opt.value}
                label={opt.label}
                icon={opt.icon}
                desc={opt.desc}
                onSelect={(v) => setAnswers({ ...answers, useCase: v })}
              />
            ))}
            {step === 1 && PRICING_OPTIONS.map(opt => (
              <QuizOption
                key={opt.value}
                value={opt.value}
                selected={answers.pricing === opt.value}
                label={opt.label}
                icon={opt.icon}
                desc={opt.desc}
                onSelect={(v) => setAnswers({ ...answers, pricing: v })}
              />
            ))}
            {step === 2 && PRIVACY_OPTIONS.map(opt => (
              <QuizOption
                key={opt.value}
                value={opt.value}
                selected={answers.privacy === opt.value}
                label={opt.label}
                icon={opt.icon}
                desc={opt.desc}
                onSelect={(v) => setAnswers({ ...answers, privacy: v })}
              />
            ))}
          </div>

          <div className="flex justify-between">
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
              {step === 2 ? 'Show Results' : 'Next'} <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Results */}
      {step >= 3 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-1">Your Perfect Relays</h2>
            <p className="text-sm text-muted-foreground">
              Based on your preferences: {answers.useCase}, {answers.pricing === 'any' ? 'any pricing' : answers.pricing}, {answers.privacy} privacy
            </p>
          </div>

          {recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <RecommendationCard
                  key={rec.relay.id}
                  relay={rec.relay}
                  reason={rec.reason}
                  rank={i + 1}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Radio className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <h3 className="font-bold text-lg mb-2">No Exact Matches</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  No relays perfectly match your criteria. Try adjusting your preferences or explore the full directory.
                </p>
                <Link to="/relays" className="inline-block mt-4">
                  <Button variant="outline" className="gap-2">
                    <Radio className="w-4 h-4" /> Browse All Relays
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={resetQuiz} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Start Over
            </Button>
            <Link to="/relays">
              <Button variant="outline" className="gap-2">
                <Radio className="w-4 h-4" /> Browse All Relays
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
