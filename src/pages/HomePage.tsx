import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSeoMeta } from "@unhead/react";
import { Search, Radio, TrendingUp, Globe2, Zap, Shield, ArrowRight, Star, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { RelayCard } from "@/components/relay/RelayCard";
import { UseCaseBadge } from "@/components/relay/UseCaseBadge";
import { RELAY_SEED_DATA, STATS, USE_CASE_OPTIONS } from "@/data/relays";
import type { UseCaseTag } from "@/types/relay";
import { Link } from "react-router-dom";

const FEATURED = RELAY_SEED_DATA.filter((r) => r.featured).slice(0, 4);
const TOP_RELAYS = [...RELAY_SEED_DATA].sort((a, b) => b.uptimePercent30d - a.uptimePercent30d).slice(0, 6);

const HERO_STATS = [
  { label: "Relays Tracked", value: STATS.total.toString(), icon: Radio, color: "text-primary" },
  { label: "Online Now", value: STATS.online.toString(), icon: TrendingUp, color: "text-emerald-500" },
  { label: "Free Relays", value: STATS.free.toString(), icon: Globe2, color: "text-sky-500" },
  { label: "Countries", value: "12+", icon: Globe2, color: "text-violet-500" },
];

const QUICK_FILTERS = [
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

export function HomePage() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  useSeoMeta({
    title: "0xNostrRelays — Find the Perfect Nostr Relay",
    description: `Discover and compare ${STATS.total}+ Nostr relays. Search by uptime, price, use case, and location. Find the perfect relay for your Nostr setup.`,
    ogTitle: "0xNostrRelays — Find the Perfect Nostr Relay",
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

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto animate-in fade-in-0 duration-500 delay-500">
            {HERO_STATS.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="bg-card/60 border border-border/40 rounded-xl p-4 backdrop-blur-sm"
                >
                  <Icon className={`w-5 h-5 mb-2 mx-auto ${stat.color}`} />
                  <div className="text-2xl font-black">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
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
            <RelayCard key={relay.id} relay={relay} view="grid" />
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
            <RelayCard key={relay.id} relay={relay} view="grid" />
          ))}
        </div>
      </section>

      {/* Why section */}
      <section className="bg-muted/20 border-y border-border/40 py-16">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Why Use 0xNostrRelays?</h2>
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

      {/* CTA */}
      <section className="container mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/5 rounded-3xl blur-3xl" />
          <div className="relative bg-card/60 border border-primary/20 rounded-3xl p-10 backdrop-blur-sm">
            <div className="w-14 h-14 bg-primary/15 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Radio className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-3xl font-black mb-3">Ready to find your relay?</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Explore our full directory with advanced filters to find the perfect relay for your Nostr journey.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/relays">
                <Button size="lg" className="gap-2 font-semibold glow-primary-sm">
                  <Zap className="w-4 h-4" />
                  Explore All Relays
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
