import { Radio, Shield, TrendingUp, Globe2, Zap, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SCORING_FACTORS = [
  { weight: "40%", label: "Uptime History", desc: "30-day rolling uptime percentage is the most important factor." },
  { weight: "25%", label: "Response Latency", desc: "Average round-trip time to the relay matters for user experience." },
  { weight: "20%", label: "NIP Support", desc: "More NIPs supported = more functionality for your clients." },
  { weight: "10%", label: "Operator Info", desc: "Relays with clear operator info, NIP-11 metadata, and contact details." },
  { weight: "5%", label: "Community Trust", desc: "Signals from the Nostr community, such as inclusion in popular relay lists." },
];

const RELAY_TYPES = [
  {
    icon: Globe2,
    name: "General Purpose",
    desc: "Accept any event from any user. Suitable as a default relay in most clients.",
    examples: "relay.damus.io, relay.primal.net, nos.lol",
  },
  {
    icon: Shield,
    name: "Paid / Member-Only",
    desc: "Require a subscription or payment to write events. Often higher quality and less spam.",
    examples: "nostr.wine, atlas.nostr.land",
  },
  {
    icon: Zap,
    name: "Inbox / Personal",
    desc: "Store events specifically addressed to you. Used as a personal mailbox relay.",
    examples: "filter.nostr.wine, purplepag.es",
  },
  {
    icon: TrendingUp,
    name: "High Performance",
    desc: "Optimized for low latency and high throughput, often backed by global CDN infrastructure.",
    examples: "relay.primal.net, relay.damus.io",
  },
];

export function AboutPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      {/* Hero */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-4">
          <Radio className="w-3.5 h-3.5" />
          Learn About Nostr Relays
        </div>
        <h1 className="text-4xl font-black mb-4">What Are Nostr Relays?</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
          In the Nostr protocol, relays are servers that store and forward events. They are the infrastructure of the decentralized social network.
        </p>
      </div>

      {/* Explanation */}
      <div className="prose prose-slate dark:prose-invert max-w-none mb-12 space-y-6">
        <div className="bg-card border border-border/60 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            How Nostr Works
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Nostr (Notes and Other Stuff Transmitted by Relays) is a decentralized protocol where users control their own identity through cryptographic key pairs. Unlike Twitter or Facebook, there's no central server. Instead, your posts and follows are signed with your private key and broadcast to multiple relays simultaneously.
          </p>
          <p className="text-muted-foreground leading-relaxed mt-3">
            When someone wants to read your content, their Nostr client connects to relays and fetches events authored by your public key. This means the relays you choose directly impact your reach and who can see your content.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: "Why Choose Carefully?",
              points: [
                "Different relays have different uptime and reliability",
                "Some relays are paid for better spam protection",
                "Location affects latency for international users",
                "Some relays specialize in specific content types",
              ],
            },
            {
              title: "Best Practices",
              points: [
                "Use 3-7 relays for redundancy",
                "Include at least one inbox relay for DMs",
                "Mix free and paid relays for reliability",
                "Include geographically diverse relays",
              ],
            },
          ].map((section) => (
            <div key={section.title} className="bg-card border border-border/60 rounded-xl p-5">
              <h3 className="font-bold mb-3">{section.title}</h3>
              <ul className="space-y-2">
                {section.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Relay Types */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-6">Types of Relays</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {RELAY_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <Card key={type.name} className="border-border/60">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="w-4.5 h-4.5 text-primary" />
                    </div>
                    <h3 className="font-bold text-sm">{type.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{type.desc}</p>
                  <div className="text-xs text-muted-foreground bg-muted/40 rounded px-2 py-1">
                    Examples: {type.examples}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Trust Scoring */}
      <section id="scoring" className="mb-12">
        <h2 className="text-2xl font-bold mb-2">How Trust Scores Are Calculated</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Our trust score (0-100) is a composite metric weighing multiple factors:
        </p>
        <div className="space-y-3">
          {SCORING_FACTORS.map((f) => (
            <div key={f.label} className="flex items-center gap-4 bg-card border border-border/60 rounded-xl px-4 py-3">
              <div className="text-xl font-black text-primary w-14 flex-shrink-0 text-center">{f.weight}</div>
              <div>
                <div className="font-semibold text-sm">{f.label}</div>
                <div className="text-xs text-muted-foreground">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How we monitor */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-2">How We Monitor Relays</h2>
        <div className="bg-card border border-border/60 rounded-xl p-6 text-sm text-muted-foreground space-y-3 leading-relaxed">
          <p>
            Every relay in our directory is automatically checked every <strong className="text-foreground">4-6 hours</strong> by our monitoring system.
            During each check, we:
          </p>
          <ul className="space-y-1.5">
            {[
              "Attempt a WebSocket connection and measure round-trip time",
              "Fetch the relay's NIP-11 JSON document from its HTTP endpoint",
              "Send a REQ message and verify it responds properly",
              "Record the timestamp and result in our database",
              "Calculate rolling 30-day uptime percentage",
            ].map((s) => (
              <li key={s} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
          <p>
            Data is displayed with a small delay. Uptime history goes back up to 90 days for established relays.
          </p>
        </div>
      </section>

      {/* NIP-11 */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-2">What Is NIP-11?</h2>
        <div className="bg-card border border-border/60 rounded-xl p-6 text-sm text-muted-foreground space-y-3 leading-relaxed">
          <p>
            <a
              href="https://github.com/nostr-protocol/nostr/blob/master/nips/11.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              NIP-11
            </a>{" "}
            defines how relays expose their capabilities via an HTTP endpoint at the relay's domain. When you request a relay's URL with the HTTP header <code className="bg-muted px-1 py-0.5 rounded text-xs">Accept: application/nostr+json</code>, it returns a JSON document with metadata including:
          </p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>Relay name, description, and contact info</li>
            <li>Supported NIPs (Nostr Implementation Possibilities)</li>
            <li>Usage limitations (message size, subscriptions, etc.)</li>
            <li>Payment requirements and pricing URLs</li>
            <li>Software version and operator public key</li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <div className="text-center bg-primary/5 border border-primary/20 rounded-2xl p-8">
        <h3 className="text-2xl font-bold mb-3">Ready to find your relay?</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Use our advanced search and filters to find the perfect Nostr relay for your setup.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/relays">
            <Button size="lg" className="gap-2">
              Explore Relays <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link to="/submit">
            <Button size="lg" variant="outline" className="gap-2">
              Submit a Relay
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
