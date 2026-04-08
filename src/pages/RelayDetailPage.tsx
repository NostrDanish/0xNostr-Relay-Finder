import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Copy, Check, ExternalLink, Wifi, Globe2, Clock,
  Shield, Zap, Server, Code2, Users, Info, AlertCircle,
  CheckCircle2, XCircle, Loader2, ChevronRight, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { UptimeBadge, OnlineIndicator } from "@/components/relay/UptimeBadge";
import { SparklineChart } from "@/components/relay/SparklineChart";
import { UseCaseBadge } from "@/components/relay/UseCaseBadge";
import { UptimeHistoryChart } from "@/components/charts/UptimeHistoryChart";
import { useRelayById } from "@/hooks/useRelayData";
import { useRelayTest } from "@/hooks/useRelayTest";
import { shortenUrl, getNipName, formatPrice, timeAgo, formatLatency, relayUrlToId } from "@/lib/utils";

const CLIENT_INSTRUCTIONS: Record<string, { name: string; steps: string[] }> = {
  damus: {
    name: "Damus (iOS)",
    steps: ["Open Damus", "Go to Settings → Relays", "Tap + and paste the relay URL", "Tap Add"],
  },
  primal: {
    name: "Primal",
    steps: ["Open Primal", "Go to Settings → Network → Relays", "Tap Add Relay", "Paste the URL and confirm"],
  },
  snort: {
    name: "Snort.social",
    steps: ["Open Snort.social", "Click on Settings → Relays", "Click Add Relay", "Enter the relay URL"],
  },
  amethyst: {
    name: "Amethyst (Android)",
    steps: ["Open Amethyst", "Go to Settings → Network → Relays", "Tap Add Relay", "Paste the URL and save"],
  },
};

export function RelayDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { relay, loading, notFound } = useRelayById(id ?? "");
  const { result: testResult, test: runTest, reset: resetTest } = useRelayTest();
  const [copied, setCopied] = useState(false);
  const [selectedClient, setSelectedClient] = useState("damus");

  const handleCopy = () => {
    if (!relay) return;
    navigator.clipboard.writeText(relay.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (notFound || !relay) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-20 text-center">
        <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Relay Not Found</h2>
        <p className="text-muted-foreground mb-6">This relay isn't in our directory yet.</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate(-1)} variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Go Back
          </Button>
          <Link to="/submit">
            <Button className="gap-2">Submit This Relay</Button>
          </Link>
        </div>
      </div>
    );
  }

  const nips = relay.nip11.supported_nips ?? [];
  const minPriceTier = relay.priceTiers.find((t) => t.price > 0) ?? relay.priceTiers[0];

  const testStatusIcon = {
    idle: null,
    connecting: <Loader2 className="w-4 h-4 animate-spin text-primary" />,
    connected: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />,
    timeout: <XCircle className="w-4 h-4 text-yellow-500" />,
  }[testResult.status];

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/relays" className="hover:text-foreground transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Relay Explorer
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-medium truncate">{relay.name}</span>
      </div>

      {/* Header Card */}
      <Card className="border-border/60 mb-6 overflow-hidden">
        <div className={`h-1 w-full ${relay.isOnline ? "bg-gradient-to-r from-emerald-500 via-primary to-violet-500" : "bg-gradient-to-r from-red-500 to-orange-500"}`} />
        <CardContent className="pt-5 pb-5">
          <div className="flex flex-col md:flex-row md:items-start gap-4">
            {/* Left: Name + URL */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <OnlineIndicator isOnline={relay.isOnline} />
                {relay.featured && (
                  <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                    ⭐ Featured
                  </Badge>
                )}
                <UptimeBadge uptime={relay.uptimePercent30d} showLabel />
              </div>

              <h1 className="text-2xl md:text-3xl font-black mb-1">{relay.name}</h1>

              <div className="flex items-center gap-2 mb-3">
                <code className="text-sm font-mono text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-lg border border-border/40 flex-1 md:flex-none">
                  {relay.url}
                </code>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 h-8" onClick={handleCopy}>
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? "Copied!" : "Copy"}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p className="text-xs">Copy relay WSS URL</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {relay.websiteUrl && (
                  <a href={relay.websiteUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-2 h-8">
                      <ExternalLink className="w-3.5 h-3.5" /> Website
                    </Button>
                  </a>
                )}
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                {relay.description}
              </p>

              {/* Use cases */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {relay.useCases.map((uc) => (
                  <Link key={uc} to={`/relays?useCase=${encodeURIComponent(uc)}`}>
                    <UseCaseBadge tag={uc} size="md" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Right: Key stats */}
            <div className="flex md:flex-col gap-3 flex-wrap md:flex-nowrap flex-shrink-0">
              <div className="bg-muted/40 rounded-xl px-4 py-3 text-center min-w-[100px]">
                <div className="text-2xl font-black text-emerald-500">{relay.uptimePercent30d.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">30d Uptime</div>
              </div>
              <div className="bg-muted/40 rounded-xl px-4 py-3 text-center min-w-[100px]">
                <div className="text-2xl font-black text-primary">{relay.trustScore}</div>
                <div className="text-xs text-muted-foreground">Trust Score</div>
              </div>
              {relay.avgLatencyMs != null && (
                <div className="bg-muted/40 rounded-xl px-4 py-3 text-center min-w-[100px]">
                  <div className="text-2xl font-black">{relay.avgLatencyMs}ms</div>
                  <div className="text-xs text-muted-foreground">Avg Latency</div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main content tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="uptime">Uptime</TabsTrigger>
          <TabsTrigger value="nips">NIPs</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="add-to-client">Add to Client</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* NIP-11 Info */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="w-4 h-4 text-primary" />
                  Relay Information (NIP-11)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Name", value: relay.nip11.name },
                  { label: "Software", value: relay.nip11.software },
                  { label: "Version", value: relay.nip11.version },
                  { label: "Contact", value: relay.nip11.contact },
                  { label: "Pubkey", value: relay.nip11.pubkey ? `${relay.nip11.pubkey.slice(0, 16)}…` : undefined },
                  { label: "Location", value: relay.countryName },
                  { label: "Last Checked", value: timeAgo(relay.lastChecked) },
                ].map(({ label, value }) =>
                  value ? (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium font-mono text-xs text-right max-w-[200px] truncate">{value}</span>
                    </div>
                  ) : null
                )}
              </CardContent>
            </Card>

            {/* Limitations */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Limitations & Policies
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {relay.nip11.limitation && Object.entries(relay.nip11.limitation).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground text-xs">{key.replace(/_/g, " ")}</span>
                    <span className="font-medium text-xs">
                      {typeof val === "boolean" ? (
                        val ? (
                          <span className="text-yellow-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Yes</span>
                        ) : (
                          <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> No</span>
                        )
                      ) : (
                        String(val)
                      )}
                    </span>
                  </div>
                ))}
                {(!relay.nip11.limitation || Object.keys(relay.nip11.limitation).length === 0) && (
                  <p className="text-sm text-muted-foreground">No limitations specified</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Live Connection Test */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wifi className="w-4 h-4 text-primary" />
                Live Connection Test
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => {
                    resetTest();
                    setTimeout(() => runTest(relay.url), 50);
                  }}
                  disabled={testResult.status === "connecting"}
                  size="sm"
                  variant="outline"
                  className="gap-2"
                >
                  {testResult.status === "connecting" ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Testing…</>
                  ) : (
                    <><Wifi className="w-4 h-4" /> Test Connection</>
                  )}
                </Button>

                {testStatusIcon && (
                  <div className="flex items-center gap-2 text-sm">
                    {testStatusIcon}
                    <span className={
                      testResult.status === "connected" ? "text-emerald-500" :
                      testResult.status === "failed" || testResult.status === "timeout" ? "text-red-500" :
                      "text-muted-foreground"
                    }>
                      {testResult.status === "connected" && `Connected in ${testResult.latencyMs}ms`}
                      {testResult.status === "failed" && (testResult.error ?? "Connection failed")}
                      {testResult.status === "timeout" && "Timed out (8s)"}
                    </span>
                  </div>
                )}

                {testResult.status === "idle" && (
                  <span className="text-xs text-muted-foreground">
                    Test a live WebSocket connection to this relay
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* What it's best for */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                What This Relay Is Best For
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {relay.useCases.map((uc) => {
                  const descriptions: Partial<Record<typeof uc, string>> = {
                    General: "Ideal for everyday Nostr usage: posting notes, following users, and reading your feed.",
                    "High Performance": "Optimized for speed with low latency and high throughput for power users.",
                    "Paid Access": "Premium relay with payment-gated access ensuring higher quality content and less spam.",
                    Privacy: "Designed with privacy in mind, with strong data policies and minimal logging.",
                    "Censorship Resistant": "Committed to free speech with minimal moderation and content restrictions.",
                    Communities: "Great for Nostr communities, groups, and collaborative spaces.",
                    Inbox: "Perfect as a personal inbox relay for receiving DMs and mentions reliably.",
                    DMs: "Optimized for encrypted direct messages with reliable delivery.",
                    Archive: "Long-term event storage and retrieval for historical Nostr data.",
                    Zaps: "Supports Lightning zaps and payment integrations seamlessly.",
                  };
                  return (
                    <div key={uc} className="flex gap-3 p-3 bg-muted/30 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-sm">{uc}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {descriptions[uc] ?? `This relay supports ${uc} use cases.`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Uptime Tab */}
        <TabsContent value="uptime" className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "30-Day Uptime", value: `${relay.uptimePercent30d.toFixed(2)}%`, sub: "Last 30 days" },
              { label: "Avg Latency", value: formatLatency(relay.avgLatencyMs), sub: "Round-trip time" },
              { label: "Trust Score", value: `${relay.trustScore}/100`, sub: "Composite score" },
            ].map((s) => (
              <Card key={s.label} className="border-border/60 text-center">
                <CardContent className="pt-5 pb-4">
                  <div className="text-3xl font-black mb-1">{s.value}</div>
                  <div className="font-semibold text-sm">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Uptime History</CardTitle>
            </CardHeader>
            <CardContent>
              <UptimeHistoryChart relay={relay} />
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Checks (14 points)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-12">
                {relay.uptimeSpark.map((v, i) => (
                  <TooltipProvider key={i}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`flex-1 rounded transition-all cursor-help ${v === 1 ? "bg-emerald-500" : "bg-red-500/60"}`}
                          style={{ height: v === 1 ? "100%" : "30%" }}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{v === 1 ? "✅ Online" : "❌ Offline"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>14 checks ago</span>
                <span>Most recent</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* NIPs Tab */}
        <TabsContent value="nips" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Code2 className="w-4 h-4 text-primary" />
                Supported NIPs ({nips.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nips.length === 0 ? (
                <p className="text-sm text-muted-foreground">NIP support information not available.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {nips.map((nip) => (
                    <a
                      key={nip}
                      href={`https://github.com/nostr-protocol/nostr/blob/master/nips/${String(nip).padStart(2, "0")}.md`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 p-2.5 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all"
                    >
                      <span className="font-mono text-xs font-bold text-primary">
                        {String(nip).padStart(2, "0")}
                      </span>
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate">
                        {getNipName(nip)}
                      </span>
                      <ExternalLink className="w-2.5 h-2.5 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing Tab */}
        <TabsContent value="pricing" className="space-y-4">
          {relay.priceTiers.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="py-8 text-center text-muted-foreground">
                Pricing information not available for this relay.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {relay.priceTiers.map((tier, i) => (
                <Card
                  key={i}
                  className={`border-border/60 ${!relay.isFree && i === 1 ? "border-primary/30 bg-primary/5" : ""}`}
                >
                  {!relay.isFree && i === 1 && (
                    <div className="bg-primary text-primary-foreground text-xs font-bold text-center py-1 rounded-t-xl">
                      RECOMMENDED
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{tier.name}</CardTitle>
                      <div className="text-right">
                        <div className="text-2xl font-black">
                          {tier.price === 0 ? (
                            <span className="text-emerald-500">Free</span>
                          ) : (
                            <span>{formatPrice(tier)}</span>
                          )}
                        </div>
                        {tier.billing && <div className="text-xs text-muted-foreground">per {tier.billing === "monthly" ? "month" : tier.billing}</div>}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {tier.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    {tier.price > 0 && relay.paymentUrl && (
                      <a href={relay.paymentUrl} target="_blank" rel="noopener noreferrer" className="block mt-4">
                        <Button className="w-full gap-2" size="sm" variant={i === 1 ? "default" : "outline"}>
                          <DollarSign className="w-3.5 h-3.5" />
                          Subscribe
                        </Button>
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Add to Client Tab */}
        <TabsContent value="add-to-client" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Add to Your Nostr Client
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Relay URL with copy */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Relay URL</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted/60 border border-border/40 rounded-lg px-3 py-2 text-sm font-mono text-foreground">
                    {relay.url}
                  </code>
                  <Button variant="outline" size="sm" className="gap-1.5 flex-shrink-0" onClick={handleCopy}>
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Client selector */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Client Instructions</div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {Object.entries(CLIENT_INSTRUCTIONS).map(([key, client]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedClient(key)}
                      className={`text-sm px-3 py-1.5 rounded-lg border font-medium transition-all ${
                        selectedClient === key
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {client.name}
                    </button>
                  ))}
                </div>

                {selectedClient && CLIENT_INSTRUCTIONS[selectedClient] && (
                  <ol className="space-y-2">
                    {CLIENT_INSTRUCTIONS[selectedClient].steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-foreground">{step}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Report button */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-2">Found incorrect information?</p>
            <Link to="/submit">
              <Button variant="outline" size="sm" className="gap-2">
                <AlertCircle className="w-3.5 h-3.5" />
                Report an Issue / Submit Correction
              </Button>
            </Link>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
