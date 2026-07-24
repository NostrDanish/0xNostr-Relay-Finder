import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useSeoMeta } from "@unhead/react";
import {
  Search, Radio, TrendingUp, Globe2, Zap, Shield, ArrowRight, Star, CheckCircle2,
  Code2, Activity, User, Wifi, MessageCircle, Image, Lock, Stethoscope, Skull,
  Sparkles, BarChart3, GitCompareArrows, Wrench, Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { RelayCard } from "@/components/relay/RelayCard";
import { UseCaseBadge } from "@/components/relay/UseCaseBadge";
import { USE_CASE_OPTIONS } from "@/data/relays";
import { useLiveRelayStore } from "@/hooks/useLiveRelayStore";
import type { UseCaseTag, RelayRecord } from "@/types/relay";

const QUICK_FILTERS: { label: string; params: string; emoji: string }[] = [
  { label: "Free Relays", params: "?pricing=free", emoji: "🆓" },
  { label: "High Uptime", params: "?minUptime=99", emoji: "⚡" },
  { label: "Privacy Focused", params: "?useCase=Privacy", emoji: "🛡️" },
  { label: "High Performance", params: "?useCase=High+Performance", emoji: "🚀" },
  { label: "Censorship Resistant", params: "?useCase=Censorship+Resistant", emoji: "🔓" },
  { label: "Paid Premium", params: "?pricing=paid", emoji: "💎" },
];

const WHY_POINTS = [
  { icon: TrendingUp, title: "Real-Time Uptime", desc: "Every relay monitored around the clock with historical data and sparkline charts." },
  { icon: Globe2, title: "Global Coverage", desc: "Relays from 15+ countries so you can minimize latency no matter where you are." },
  { icon: Zap, title: "Use-Case Matching", desc: "Find relays optimized for DMs, images, long-form content, communities, and more." },
  { icon: Shield, title: "Trust Scores", desc: "Objective trust scores based on uptime history, operator reputation, and NIP support." },
];

/** Animated number counter */
function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    const start = ref.current;
    const diff = value - start;
    const startTime = Date.now();

    function tick() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + diff * eased);
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(tick);
      else ref.current = value;
    }
    requestAnimationFrame(tick);
  }, [value, duration]);

  return <>{display}</>;
}

export function HomePage() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { relays, stats } = useLiveRelayStore();

  const FEATURED = useMemo(() => relays.filter((r) => r.featured).slice(0, 4), [relays]);
  const TOP_RELAYS = useMemo(() => [...relays].sort((a, b) => b.uptimePercent30d - a.uptimePercent30d).slice(0, 6), [relays]);

  useSeoMeta({
    title: "0xRelay-Finder — Find the Perfect Nostr Relay",
    description: `Discover and compare ${stats.totalRelays}+ Nostr relays. Search by uptime, price, use case, and location. Find the perfect relay for your Nostr setup.`,
    ogTitle: "0xRelay-Finder — Find the Perfect Nostr Relay",
    ogDescription: "The most comprehensive Nostr relay directory. Compare relays by uptime, pricing, NIPs, and use cases.",
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/relays?q=${encodeURIComponent(query.trim())}`);
    else navigate("/relays");
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden pb-16 pt-10 md:pt-20">
        {/* Gradient background */}
        <div className="absolute inset-0 gradient-hero pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.08)_0%,transparent_60%)] pointer-events-none" />

        {/* Animated grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: "50px 50px",
          }}
        />

        <div className="container mx-auto max-w-5xl px-4 text-center relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            <Radio className="w-3.5 h-3.5" />
            The Nostr Relay Directory
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight mb-4 animate-in fade-in-0 slide-in-from-bottom-6 duration-500 delay-100">
            Find the perfect{" "}
            <span className="gradient-text">Nostr relay</span>
            <br />
            in seconds
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed animate-in fade-in-0 slide-in-from-bottom-8 duration-500 delay-200">
            Search, compare, and evaluate Nostr relays by uptime, price, use case, and location.
            Make informed decisions for your Nostr setup.
          </p>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-6 animate-in fade-in-0 slide-in-from-bottom-10 duration-500 delay-300">
            <div className="relative search-glow rounded-xl border border-border/60 bg-card shadow-lg">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, URL, use case, or NIP…"
                className="pl-12 pr-36 h-14 text-base border-0 bg-transparent focus-visible:ring-0 rounded-xl"
              />
              <Button
                type="submit"
                size="sm"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 px-5 font-semibold glow-primary-sm"
              >
                Search
              </Button>
            </div>
          </form>

          {/* Quick filter pills */}
          <div className="flex flex-wrap justify-center gap-2 mb-10 animate-in fade-in-0 duration-500 delay-400">
            {QUICK_FILTERS.map((f) => (
              <Link
                key={f.params}
                to={`/relays${f.params}`}
                className="text-sm px-3 py-1.5 rounded-full border border-border/60 bg-card/80 hover:border-primary/50 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground font-medium"
              >
                {f.emoji} {f.label}
              </Link>
            ))}
          </div>

          {/* Live Network Stats — primary row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto mb-4 animate-in fade-in-0 duration-500 delay-500">
            {[
              { label: "Relays Tracked", value: stats.totalRelays, icon: Radio, color: "text-primary" },
              { label: "Online Now", value: stats.onlineNow, icon: Wifi, color: "text-emerald-500" },
              { label: "Avg Latency", value: stats.avgLatencyMs, icon: Zap, color: "text-yellow-500", suffix: "ms" },
              { label: "Free Relays", value: stats.freeRelays, icon: Globe2, color: "text-sky-500" },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-card/60 border border-border/40 rounded-xl p-4 backdrop-blur-sm">
                  <Icon className={`w-5 h-5 mb-2 mx-auto ${stat.color}`} />
                  <div className="text-2xl font-black">
                    <AnimatedCounter value={stat.value} />
                    {stat.suffix && <span className="text-sm text-muted-foreground font-medium ml-0.5">{stat.suffix}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
                </div>
              );
            })}
          </div>

          {/* Live NIP stats — secondary row */}
          <div className="grid grid-cols-3 md:grid-cols-7 gap-2 max-w-3xl mx-auto animate-in fade-in-0 duration-500 delay-600">
            {[
              { label: "Countries", value: stats.countriesRepresented, icon: Globe2, color: "text-emerald-500" },
              { label: "NIP-50 Search", value: stats.nip50Search, icon: Search, color: "text-orange-500" },
              { label: "NIP-17 DMs", value: stats.nip17DMs, icon: MessageCircle, color: "text-violet-500" },
              { label: "NIP-42 Auth", value: stats.nip42Auth, icon: Lock, color: "text-rose-500" },
              { label: "NIP-57 Zaps", value: stats.nip57Zaps, icon: Zap, color: "text-amber-500" },
              { label: "Blossom", value: stats.blossomEnabled, icon: Image, color: "text-pink-500" },
              { label: "NIP-66", value: stats.nip66Enriched, icon: Activity, color: "text-cyan-500" },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-card/40 border border-border/30 rounded-lg p-2.5 backdrop-blur-sm">
                  <Icon className={`w-3.5 h-3.5 mx-auto mb-1 ${stat.color}`} />
                  <div className="text-base font-bold"><AnimatedCounter value={stat.value} /></div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Featured Relays */}
      <section className="container mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Star className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary uppercase tracking-wide">Featured</span>
            </div>
            <h2 className="text-2xl font-bold">Top Relays</h2>
            <p className="text-sm text-muted-foreground mt-1">Hand-picked for reliability, performance, and community trust</p>
          </div>
          <Link to="/relays">
            <Button variant="outline" size="sm" className="gap-2 hidden sm:flex">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURED.map((relay) => (
            <RelayCard key={relay.id} relay={relay as RelayRecord} view="grid" />
          ))}
        </div>

        <div className="mt-4 flex justify-center sm:hidden">
          <Link to="/relays">
            <Button variant="outline" size="sm" className="gap-2">
              View All Relays <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Browse by Use Case */}
      <section className="bg-muted/30 border-y border-border/40 py-12">
        <div className="container mx-auto max-w-7xl px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Browse by Use Case</h2>
            <p className="text-muted-foreground text-sm">Find relays optimized for your specific needs</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {USE_CASE_OPTIONS.map((uc) => (
              <Link key={uc} to={`/relays?useCase=${encodeURIComponent(uc)}`}>
                <UseCaseBadge tag={uc as UseCaseTag} size="md" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Top Uptime Relays */}
      <section className="container mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-500 uppercase tracking-wide">Most Reliable</span>
            </div>
            <h2 className="text-2xl font-bold">Highest Uptime Relays</h2>
          </div>
          <Link to="/relays?sortBy=uptime">
            <Button variant="outline" size="sm" className="gap-2 hidden sm:flex">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOP_RELAYS.map((relay) => (
            <RelayCard key={relay.id} relay={relay as RelayRecord} view="grid" />
          ))}
        </div>
      </section>

      {/* Why section */}
      <section className="bg-muted/20 border-y border-border/40 py-16">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Why Use 0xRelay-Finder?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              We monitor hundreds of relays 24/7 so you don't have to. Make data-driven decisions for your Nostr setup.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {WHY_POINTS.map((p) => {
              const Icon = p.icon;
              return (
                <Card key={p.title} className="border-border/50 bg-card/50 text-center">
                  <CardContent className="pt-6 pb-5">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="font-bold text-sm mb-2">{p.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tools CTA grid */}
      <section className="container mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Nostr Protocol query */}
          <div className="lg:col-span-2 bg-gradient-to-br from-primary/10 via-violet-500/5 to-transparent border border-primary/20 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <Code2 className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-black text-lg">Query via Nostr Protocol</h3>
                  <span className="text-xs bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 px-2 py-0.5 rounded-full font-bold">OPEN</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  All data is stored as signed Nostr events on our relays. Query directly via WebSocket using the standard NIP-01 protocol. No API keys, no rate limits — fully decentralised.
                </p>
                <code className="block text-xs bg-background/80 border border-border/50 rounded-lg px-3 py-2 font-mono text-muted-foreground mb-3">
                  ["REQ","sub",{`{"kinds":[30078],"#t":["relay-submission"],"limit":50}`}]
                </code>
                <div className="flex gap-2">
                  <Link to="/api">
                    <Button size="sm" className="gap-2">
                      <Code2 className="w-3.5 h-3.5" />
                      Protocol Docs
                    </Button>
                  </Link>
                  <span className="text-xs text-muted-foreground self-center">WebSocket · No auth · Decentralised</span>
                </div>
              </div>
            </div>
          </div>

          {/* NIP-66 promo */}
          <div className="bg-gradient-to-br from-violet-500/10 to-transparent border border-violet-500/20 rounded-2xl p-6">
            <div className="w-10 h-10 bg-violet-500/15 rounded-xl flex items-center justify-center mb-3">
              <Activity className="w-5 h-5 text-violet-500" />
            </div>
            <h3 className="font-bold mb-1.5">NIP-66 Enriched Data</h3>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Official health data from nostr.watch-style monitors via kind:30166 and kind:10166 events.
              {stats.nip66Enriched > 0 ? ` ${stats.nip66Enriched} relays enriched so far.` : ''}
            </p>
            <Link to="/relays?nip66Only=true">
              <Button size="sm" variant="outline" className="gap-2 text-xs border-violet-500/30 text-violet-500 hover:bg-violet-500/10">
                <Activity className="w-3 h-3" />
                View NIP-66 Relays
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* npub Diagnostic + Graveyard CTAs */}
      <section className="container mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* npub Diagnostic */}
          <div className="bg-gradient-to-br from-cyan-500/10 via-emerald-500/5 to-transparent border border-cyan-500/20 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-cyan-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <Stethoscope className="w-6 h-6 text-cyan-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-black text-lg">Fix My Nostr</h3>
                  <span className="text-xs bg-cyan-500/15 text-cyan-500 border border-cyan-500/25 px-2 py-0.5 rounded-full font-bold">DIAGNOSTIC</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Paste any npub to diagnose their relay config. See which relays are online, get a health score, and find better alternatives.
                </p>
                <Link to="/lookup">
                  <Button size="sm" className="gap-2">
                    <Stethoscope className="w-3.5 h-3.5" />
                    Diagnose npub
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Graveyard teaser */}
          <div className="bg-gradient-to-br from-zinc-500/10 via-red-500/5 to-transparent border border-zinc-500/20 rounded-2xl p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-zinc-500/15 rounded-xl flex items-center justify-center flex-shrink-0">
                <Skull className="w-6 h-6 text-zinc-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-black text-lg">Relay Graveyard</h3>
                  <span className="text-xs bg-zinc-500/15 text-zinc-400 border border-zinc-500/25 px-2 py-0.5 rounded-full font-bold">RIP</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  See relays that were once in the directory but have gone permanently offline. A memorial to the fallen relays of Nostr.
                </p>
                <Link to="/graveyard">
                  <Button size="sm" variant="outline" className="gap-2">
                    <Skull className="w-3.5 h-3.5" />
                    View Graveyard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Build + Compare + Atlas — Hero tools */}
      <section className="container mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Build My Relay Set */}
          <div className="bg-gradient-to-br from-primary/10 via-violet-500/5 to-transparent border border-primary/20 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-3 right-3">
              <span className="text-xs bg-primary/15 text-primary border border-primary/25 px-2 py-0.5 rounded-full font-bold animate-pulse">NEW</span>
            </div>
            <div className="w-12 h-12 bg-primary/15 rounded-xl flex items-center justify-center mb-3">
              <Wrench className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-black text-lg mb-1">Build My Relay Set</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Answer a few questions and get an optimized relay set. Export as JSON, publish as kind:10002, or scan a QR code.
            </p>
            <Link to="/build">
              <Button size="sm" className="gap-2 glow-primary-sm">
                <Wrench className="w-3.5 h-3.5" /> Build My Set
              </Button>
            </Link>
          </div>

          {/* Compare Relays */}
          <div className="bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent border border-blue-500/20 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-3 right-3">
              <span className="text-xs bg-blue-500/15 text-blue-500 border border-blue-500/25 px-2 py-0.5 rounded-full font-bold animate-pulse">NEW</span>
            </div>
            <div className="w-12 h-12 bg-blue-500/15 rounded-xl flex items-center justify-center mb-3">
              <GitCompareArrows className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="font-black text-lg mb-1">Compare Relays</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Side-by-side comparison of up to 4 relays. Compare uptime, latency, NIPs, limits, health scores, and more.
            </p>
            <Link to="/compare">
              <Button size="sm" variant="outline" className="gap-2 border-blue-500/30 text-blue-500 hover:bg-blue-500/10">
                <GitCompareArrows className="w-3.5 h-3.5" /> Compare Now
              </Button>
            </Link>
          </div>

          {/* Nostr Atlas */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-3 right-3">
              <span className="text-xs bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 px-2 py-0.5 rounded-full font-bold animate-pulse">NEW</span>
            </div>
            <div className="w-12 h-12 bg-emerald-500/15 rounded-xl flex items-center justify-center mb-3">
              <Globe2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="font-black text-lg mb-1">Nostr Atlas</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Interactive world map of every known relay. Green for healthy, yellow for slow, red for offline. Filter and explore.
            </p>
            <Link to="/atlas">
              <Button size="sm" variant="outline" className="gap-2 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10">
                <Globe2 className="w-3.5 h-3.5" /> Open Atlas
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Recommender + Software + Explore */}
      <section className="container mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Relay Recommender */}
          <div className="bg-gradient-to-br from-violet-500/10 via-pink-500/5 to-transparent border border-violet-500/20 rounded-2xl p-6">
            <div className="w-10 h-10 bg-violet-500/15 rounded-xl flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5 text-violet-500" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold">Quick Quiz</h3>
              <span className="text-[10px] bg-violet-500/15 text-violet-500 border border-violet-500/25 px-1.5 py-0.5 rounded-full font-bold">QUIZ</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              3 questions to find your perfect relay.
            </p>
            <Link to="/recommend">
              <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-violet-500 hover:text-violet-500 hover:bg-violet-500/10 p-0 h-auto">
                Take the Quiz <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>

          {/* Software Leaderboard */}
          <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 rounded-2xl p-6">
            <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center mb-3">
              <BarChart3 className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold">Relay Software</h3>
              <span className="text-[10px] bg-amber-500/15 text-amber-500 border border-amber-500/25 px-1.5 py-0.5 rounded-full font-bold">STATS</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Which software powers the network?
            </p>
            <Link to="/software">
              <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-amber-500 hover:text-amber-500 hover:bg-amber-500/10 p-0 h-auto">
                View Leaderboard <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>

          {/* Explore */}
          <div className="bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 rounded-2xl p-6">
            <div className="w-10 h-10 bg-emerald-500/15 rounded-xl flex items-center justify-center mb-3">
              <Compass className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold">Explore</h3>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 px-1.5 py-0.5 rounded-full font-bold">CURATED</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
              Curated collections: fastest, newest, best for DMs, and more.
            </p>
            <Link to="/explore">
              <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-emerald-500 hover:text-emerald-500 hover:bg-emerald-500/10 p-0 h-auto">
                Explore Relays <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-3xl" />
          <div className="relative bg-card/60 border border-primary/20 rounded-3xl p-10 backdrop-blur-sm">
            <div className="w-14 h-14 bg-primary/15 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Wrench className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-3xl font-black mb-3">Build your perfect relay set</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Answer a few questions and we'll generate an optimized relay list you can export and use anywhere.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/build">
                <Button size="lg" className="gap-2 font-semibold glow-primary-sm">
                  <Wrench className="w-4 h-4" />
                  Build My Relay Set
                </Button>
              </Link>
              <Link to="/explore">
                <Button size="lg" variant="outline" className="gap-2">
                  <Compass className="w-4 h-4" />
                  Explore Relays
                </Button>
              </Link>
              <Link to="/submit">
                <Button size="lg" variant="outline" className="gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Submit a Relay
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
