/**
 * ExplorePage — GitHub-style Explore page for relays
 *
 * Curated collections: Fastest Growing, Newest, Highest Uptime,
 * Best for DMs, etc. Each section surfaces interesting relays
 * that users might otherwise never find.
 */

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import {
  Compass, TrendingUp, Zap, Clock, Star, Radio, Shield, Lock,
  MessageCircle, Image, Code2, ArrowRight, Globe2, Wifi,
  Award, Crown, Flame, Sparkles, Droplets, Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RelayCard } from '@/components/relay/RelayCard';
import { SparklineChart } from '@/components/relay/SparklineChart';
import { AddToRelayListButton } from '@/components/relay/AddToRelayListButton';
import { useLiveRelayStore, type LiveRelayRecord } from '@/hooks/useLiveRelayStore';
import { computeHealthScore, gradeColor, gradeBgColor } from '@/lib/healthScore';
import { relayUrlToId, shortenUrl, formatLatency, cn } from '@/lib/utils';
import type { RelayRecord } from '@/types/relay';

// ─── Mini Relay Card ────────────────────────────────────────────────────────

function MiniRelayCard({ relay, rank, badge }: { relay: LiveRelayRecord; rank?: number; badge?: string }) {
  const hs = useMemo(() => computeHealthScore(relay), [relay]);
  return (
    <Link to={`/relay/${relayUrlToId(relay.url)}`} className="block">
      <div className="relay-card border border-border/60 rounded-xl p-4 bg-card hover:bg-card/80 transition-all">
        <div className="flex items-start gap-3">
          {rank != null && (
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-black',
              rank === 1 ? 'bg-yellow-500/15 text-yellow-500' :
              rank === 2 ? 'bg-zinc-400/15 text-zinc-400' :
              rank === 3 ? 'bg-amber-700/15 text-amber-700' :
              'bg-muted text-muted-foreground'
            )}>
              {rank <= 3 ? <Crown className="w-4 h-4" /> : `#${rank}`}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className={cn('w-2 h-2 rounded-full flex-shrink-0', (relay.liveOnline ?? relay.isOnline) ? 'bg-emerald-500 animate-pulse' : 'bg-red-500')} />
              <span className="font-bold text-sm truncate">{relay.name}</span>
              <div className={cn('w-5 h-5 rounded text-[9px] font-black flex items-center justify-center flex-shrink-0', gradeBgColor(hs.grade))}>
                <span className={gradeColor(hs.grade)}>{hs.grade}</span>
              </div>
              {badge && (
                <Badge variant="outline" className="text-[10px] ml-auto flex-shrink-0">{badge}</Badge>
              )}
            </div>
            <code className="text-xs text-muted-foreground font-mono block mb-2 truncate">{shortenUrl(relay.url)}</code>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                <span className="font-bold">{relay.uptimePercent30d.toFixed(1)}%</span>
              </span>
              {(relay.liveLatencyMs ?? relay.avgLatencyMs) != null && (
                <span className="flex items-center gap-1">
                  <Wifi className="w-3 h-3 text-blue-500" />
                  <span className="font-bold">{relay.liveLatencyMs ?? relay.avgLatencyMs}ms</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Radio className="w-3 h-3 text-primary" />
                <span className="font-bold">{(relay.nip11?.supported_nips?.length ?? 0)}</span>
              </span>
              {relay.uptimeSpark.length > 0 && (
                <SparklineChart data={relay.uptimeSpark} height={12} uptime={relay.uptimePercent30d} className="w-16 ml-auto" />
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function ExploreSection({
  title,
  subtitle,
  icon,
  color,
  relays,
  badges,
  linkTo,
  linkLabel,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  relays: LiveRelayRecord[];
  badges?: string[];
  linkTo?: string;
  linkLabel?: string;
}) {
  if (relays.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className={cn('w-6 h-6 rounded-md flex items-center justify-center', color)}>
              {icon}
            </div>
            <h2 className="text-lg font-bold">{title}</h2>
          </div>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {linkTo && (
          <Link to={linkTo}>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
              {linkLabel ?? 'View All'} <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {relays.map((relay, idx) => (
          <MiniRelayCard
            key={relay.id}
            relay={relay}
            rank={idx + 1}
            badge={badges?.[idx]}
          />
        ))}
      </div>
    </section>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function ExplorePage() {
  const { relays, stats } = useLiveRelayStore();

  useSeoMeta({
    title: 'Explore Relays — 0xRelay-Finder',
    description: 'Discover interesting Nostr relays. Browse the fastest, newest, most reliable, and best relays by category.',
  });

  // ── Curated collections ────────────────────────────────────────────────────

  const highestUptime = useMemo(
    () => [...relays].sort((a, b) => b.uptimePercent30d - a.uptimePercent30d).slice(0, 6),
    [relays]
  );

  const fastestRelays = useMemo(
    () => [...relays]
      .filter((r) => (r.liveLatencyMs ?? r.avgLatencyMs) != null)
      .sort((a, b) => (a.liveLatencyMs ?? a.avgLatencyMs ?? 9999) - (b.liveLatencyMs ?? b.avgLatencyMs ?? 9999))
      .slice(0, 6),
    [relays]
  );

  const newestRelays = useMemo(
    () => [...relays].sort((a, b) => b.addedAt - a.addedAt).slice(0, 6),
    [relays]
  );

  const mostNips = useMemo(
    () => [...relays]
      .sort((a, b) => (b.nip11?.supported_nips?.length ?? 0) - (a.nip11?.supported_nips?.length ?? 0))
      .slice(0, 6),
    [relays]
  );

  const bestForDMs = useMemo(
    () => relays
      .filter((r) => (r.nip11?.supported_nips ?? []).includes(17) || r.useCases.includes('DMs'))
      .sort((a, b) => b.uptimePercent30d - a.uptimePercent30d)
      .slice(0, 6),
    [relays]
  );

  const bestForMedia = useMemo(
    () => relays
      .filter((r) => r.blossomSupported || r.useCases.includes('Blossom') || r.useCases.includes('Images'))
      .sort((a, b) => b.uptimePercent30d - a.uptimePercent30d)
      .slice(0, 6),
    [relays]
  );

  const privacyRelays = useMemo(
    () => relays
      .filter((r) => r.nip11?.limitation?.auth_required || r.useCases.includes('Privacy'))
      .sort((a, b) => b.uptimePercent30d - a.uptimePercent30d)
      .slice(0, 6),
    [relays]
  );

  const freeRelays = useMemo(
    () => relays
      .filter((r) => r.isFree && (r.liveOnline ?? r.isOnline))
      .sort((a, b) => b.uptimePercent30d - a.uptimePercent30d)
      .slice(0, 6),
    [relays]
  );

  const paidRelays = useMemo(
    () => relays
      .filter((r) => !r.isFree)
      .sort((a, b) => b.trustScore - a.trustScore)
      .slice(0, 6),
    [relays]
  );

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-3">
          <Compass className="w-3.5 h-3.5" />
          Explore
        </div>
        <h1 className="text-3xl font-black mb-2">Explore Relays</h1>
        <p className="text-muted-foreground text-sm max-w-xl">
          Curated collections of the most interesting relays across the Nostr network.
          Discover the fastest, newest, most reliable, and best relays for every use case.
        </p>

        {/* Quick stats */}
        <div className="flex flex-wrap items-center gap-4 mt-4">
          <div className="flex items-center gap-2 text-sm">
            <Radio className="w-4 h-4 text-primary" />
            <span className="font-bold">{stats.totalRelays}</span>
            <span className="text-muted-foreground">relays tracked</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Wifi className="w-4 h-4 text-emerald-500" />
            <span className="font-bold">{stats.onlineNow}</span>
            <span className="text-muted-foreground">online now</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Globe2 className="w-4 h-4 text-blue-500" />
            <span className="font-bold">{stats.countriesRepresented}</span>
            <span className="text-muted-foreground">countries</span>
          </div>
        </div>
      </div>

      {/* Quick navigation */}
      <div className="flex flex-wrap gap-2 mb-10 pb-6 border-b border-border/40">
        {[
          { label: 'Highest Uptime', href: '#uptime', icon: <TrendingUp className="w-3 h-3" /> },
          { label: 'Fastest', href: '#fastest', icon: <Zap className="w-3 h-3" /> },
          { label: 'Newest', href: '#newest', icon: <Clock className="w-3 h-3" /> },
          { label: 'Most NIPs', href: '#nips', icon: <Radio className="w-3 h-3" /> },
          { label: 'Best for DMs', href: '#dms', icon: <Lock className="w-3 h-3" /> },
          { label: 'Media & Blossom', href: '#media', icon: <Image className="w-3 h-3" /> },
          { label: 'Privacy', href: '#privacy', icon: <Shield className="w-3 h-3" /> },
          { label: 'Free Relays', href: '#free', icon: <Sparkles className="w-3 h-3" /> },
          { label: 'Premium', href: '#paid', icon: <Crown className="w-3 h-3" /> },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="text-xs px-3 py-1.5 rounded-full border border-border/60 bg-card/80 hover:border-primary/50 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground font-medium flex items-center gap-1.5"
          >
            {item.icon}
            {item.label}
          </a>
        ))}
      </div>

      {/* Sections */}
      <div className="space-y-12">
        <div id="uptime">
          <ExploreSection
            title="Highest Uptime"
            subtitle="The most reliable relays on the network. These rarely go down."
            icon={<TrendingUp className="w-3.5 h-3.5 text-emerald-500" />}
            color="bg-emerald-500/15"
            relays={highestUptime}
            linkTo="/relays?sortBy=uptime"
            linkLabel="All by uptime"
          />
        </div>

        <div id="fastest">
          <ExploreSection
            title="Fastest Relays"
            subtitle="Ultra-low latency relays for snappy real-time experiences."
            icon={<Zap className="w-3.5 h-3.5 text-yellow-500" />}
            color="bg-yellow-500/15"
            relays={fastestRelays}
            badges={fastestRelays.map((r) => `${r.liveLatencyMs ?? r.avgLatencyMs}ms`)}
          />
        </div>

        <div id="newest">
          <ExploreSection
            title="Recently Added"
            subtitle="Fresh relays that just joined the directory."
            icon={<Clock className="w-3.5 h-3.5 text-blue-500" />}
            color="bg-blue-500/15"
            relays={newestRelays}
            linkTo="/relays?sortBy=newest"
            linkLabel="All newest"
          />
        </div>

        <div id="nips">
          <ExploreSection
            title="Most NIP Support"
            subtitle="Relays with the widest protocol support. Feature-rich and future-proof."
            icon={<Radio className="w-3.5 h-3.5 text-primary" />}
            color="bg-primary/15"
            relays={mostNips}
            badges={mostNips.map((r) => `${r.nip11?.supported_nips?.length ?? 0} NIPs`)}
          />
        </div>

        <div id="dms">
          <ExploreSection
            title="Best for Direct Messages"
            subtitle="Relays with NIP-17 support for private, encrypted conversations."
            icon={<Lock className="w-3.5 h-3.5 text-violet-500" />}
            color="bg-violet-500/15"
            relays={bestForDMs}
            linkTo="/relays?useCase=DMs"
          />
        </div>

        <div id="media">
          <ExploreSection
            title="Media & Blossom"
            subtitle="Built for images, video, and file storage. Blossom and NIP-94/96 support."
            icon={<Image className="w-3.5 h-3.5 text-pink-500" />}
            color="bg-pink-500/15"
            relays={bestForMedia}
            linkTo="/relays?blossomOnly=true"
          />
        </div>

        <div id="privacy">
          <ExploreSection
            title="Privacy Focused"
            subtitle="Auth-required relays that prioritize user privacy and access control."
            icon={<Shield className="w-3.5 h-3.5 text-rose-500" />}
            color="bg-rose-500/15"
            relays={privacyRelays}
            linkTo="/relays?useCase=Privacy"
          />
        </div>

        <div id="free">
          <ExploreSection
            title="Best Free Relays"
            subtitle="Top-rated relays with no cost. Open access for everyone."
            icon={<Sparkles className="w-3.5 h-3.5 text-cyan-500" />}
            color="bg-cyan-500/15"
            relays={freeRelays}
            linkTo="/relays?pricing=free"
          />
        </div>

        <div id="paid">
          <ExploreSection
            title="Premium Relays"
            subtitle="Paid relays with less spam, better performance, and dedicated support."
            icon={<Crown className="w-3.5 h-3.5 text-amber-500" />}
            color="bg-amber-500/15"
            relays={paidRelays}
            linkTo="/relays?pricing=paid"
          />
        </div>
      </div>

      {/* CTA */}
      <div className="mt-16 text-center">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent inline-block">
          <CardContent className="py-8 px-10">
            <Compass className="w-8 h-8 text-primary mx-auto mb-3" />
            <h3 className="font-black text-lg mb-2">Want something specific?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Use our advanced filters to find exactly what you need.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/build">
                <Button className="gap-2">
                  <Sparkles className="w-4 h-4" /> Build My Relay Set
                </Button>
              </Link>
              <Link to="/relays">
                <Button variant="outline" className="gap-2">
                  <Radio className="w-4 h-4" /> Full Directory
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
