import { useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Copy, Check, Code2, Zap, Globe2, Shield, ExternalLink, ChevronRight, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { RELAY_SEED_DATA } from '@/data/relays';
import { cn } from '@/lib/utils';

// Simulate an API response using seed data
function buildApiResponse(params: {
  limit?: number;
  uptime_gte?: number;
  blossom?: boolean;
  pricing?: string;
  best_for?: string;
  country?: string;
}) {
  let results = [...RELAY_SEED_DATA];

  if (params.uptime_gte != null)
    results = results.filter((r) => r.uptimePercent30d >= params.uptime_gte!);
  if (params.blossom === true)
    results = results.filter((r) => r.blossomSupported);
  if (params.pricing === 'free')
    results = results.filter((r) => r.isFree);
  if (params.pricing === 'paid')
    results = results.filter((r) => !r.isFree);
  if (params.country)
    results = results.filter((r) => r.countryCode?.toLowerCase() === params.country!.toLowerCase());
  if (params.best_for) {
    const bf = params.best_for.toLowerCase();
    results = results.filter((r) =>
      r.communityTags?.some((t) => t.tag.toLowerCase().includes(bf))
    );
  }

  const limit = params.limit ?? 10;
  results = results.slice(0, limit);

  return {
    ok: true,
    count: results.length,
    data: results.map((r) => ({
      url: r.url,
      name: r.name,
      description: r.description,
      is_online: r.isOnline,
      uptime_30d: r.uptimePercent30d,
      latency_ms: r.avgLatencyMs,
      is_free: r.isFree,
      country_code: r.countryCode,
      trust_score: r.trustScore,
      blossom_supported: r.blossomSupported ?? false,
      nip66_enriched: r.nip66?.enriched ?? false,
      supported_nips: r.nip11.supported_nips ?? [],
      use_cases: r.useCases,
      community_top_tag: r.communityTags?.[0]?.tag ?? null,
      payment_url: r.paymentUrl ?? null,
      relay_tools_url: r.relayToolsUrl ?? null,
      last_checked: new Date(r.lastChecked).toISOString(),
    })),
    meta: {
      source: '0xNostrRelays API',
      version: '1.0',
      cached_at: new Date().toISOString(),
      rate_limit: '100 req/min per IP',
      docs: 'https://0xnostrrelays.xyz/api',
    },
  };
}

// ─── Code snippet component ──────────────────────────────────────────────────
function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="relative group">
      <pre className={cn(
        'rounded-xl bg-[hsl(240_12%_6%)] border border-border/40 p-4 overflow-x-auto text-xs font-mono leading-relaxed',
        'text-slate-300'
      )}>
        <code>{code}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity bg-muted hover:bg-muted/80 border border-border/50 rounded-md px-2 py-1 text-xs flex items-center gap-1"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

// ─── Interactive Try-it box ──────────────────────────────────────────────────
function TryItBox() {
  const [params, setParams] = useState({
    limit: 5,
    uptime_gte: 98,
    blossom: false,
    pricing: 'any',
    best_for: '',
    country: '',
  });
  const [response, setResponse] = useState<string | null>(null);

  const run = () => {
    const p = {
      limit: params.limit,
      uptime_gte: params.uptime_gte || undefined,
      blossom: params.blossom || undefined,
      pricing: params.pricing !== 'any' ? params.pricing : undefined,
      best_for: params.best_for || undefined,
      country: params.country || undefined,
    };
    const data = buildApiResponse(p);
    setResponse(JSON.stringify(data, null, 2));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'limit', type: 'number', key: 'limit', min: 1, max: 100 },
          { label: 'uptime_gte (%)', type: 'number', key: 'uptime_gte', min: 0, max: 100 },
          { label: 'country (e.g. US, DE)', type: 'text', key: 'country' },
          { label: 'best_for (e.g. images)', type: 'text', key: 'best_for' },
        ].map((f) => (
          <div key={f.key} className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
            <input
              type={f.type}
              value={(params as Record<string, unknown>)[f.key] as string | number}
              onChange={(e) => setParams({ ...params, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value })}
              min={(f as { min?: number }).min}
              max={(f as { max?: number }).max}
              className="w-full h-8 px-2 rounded-md border border-border bg-background text-sm font-mono"
            />
          </div>
        ))}

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">pricing</label>
          <select
            value={params.pricing}
            onChange={(e) => setParams({ ...params, pricing: e.target.value })}
            className="w-full h-8 px-2 rounded-md border border-border bg-background text-sm"
          >
            <option value="any">any</option>
            <option value="free">free</option>
            <option value="paid">paid</option>
          </select>
        </div>

        <div className="space-y-1 flex flex-col justify-end">
          <label className="text-xs font-medium text-muted-foreground">blossom=true</label>
          <button
            onClick={() => setParams({ ...params, blossom: !params.blossom })}
            className={cn(
              'h-8 w-full rounded-md border text-xs font-medium transition-all',
              params.blossom
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            )}
          >
            {params.blossom ? '✓ blossom=true' : 'blossom'}
          </button>
        </div>
      </div>

      <Button onClick={run} size="sm" className="gap-2">
        <Play className="w-3.5 h-3.5" />
        Run Query
      </Button>

      {response && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">Response (simulated — live when deployed)</div>
          <CodeBlock code={response} language="json" />
        </div>
      )}
    </div>
  );
}

// ─── Endpoint card ───────────────────────────────────────────────────────────
function EndpointCard({
  method, path, description, params, response,
}: {
  method: 'GET' | 'POST';
  path: string;
  description: string;
  params?: { name: string; type: string; desc: string; required?: boolean }[];
  response?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card className={cn('border-border/60 overflow-hidden', open && 'border-primary/30')}>
      <button
        className="w-full text-left"
        onClick={() => setOpen(!open)}
      >
        <CardHeader className="pb-3 pt-3 px-4">
          <div className="flex items-center gap-3">
            <span className={cn(
              'text-xs font-bold px-2 py-0.5 rounded border',
              method === 'GET'
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                : 'bg-blue-500/10 text-blue-500 border-blue-500/30'
            )}>
              {method}
            </span>
            <code className="text-sm font-mono font-semibold text-foreground">{path}</code>
            <ChevronRight className={cn('w-4 h-4 text-muted-foreground ml-auto transition-transform', open && 'rotate-90')} />
          </div>
          <p className="text-xs text-muted-foreground mt-1 pl-0">{description}</p>
        </CardHeader>
      </button>

      {open && (
        <CardContent className="px-4 pb-4 pt-0 space-y-4 border-t border-border/40">
          {params && params.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Query Parameters</div>
              <div className="space-y-2">
                {params.map((p) => (
                  <div key={p.name} className="flex items-start gap-3 text-sm">
                    <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded text-primary flex-shrink-0">{p.name}</code>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{p.type}</span>
                    <span className="text-xs text-muted-foreground">{p.desc}</span>
                    {p.required && <Badge variant="outline" className="text-xs ml-auto flex-shrink-0 h-4">required</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {response && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Example Response</div>
              <CodeBlock code={response} language="json" />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export function ApiDocsPage() {
  useSeoMeta({
    title: 'Public API — 0xNostrRelays',
    description: 'Free REST API for Nostr clients. Query relays by uptime, pricing, NIP support, Blossom, country, and community votes.',
  });

  const exampleListResponse = JSON.stringify(
    buildApiResponse({ limit: 2, uptime_gte: 99 }),
    null, 2
  );

  const exampleSingleResponse = JSON.stringify({
    ok: true,
    data: {
      url: 'wss://relay.damus.io',
      name: 'Damus Relay',
      uptime_30d: 99.7,
      latency_ms: 45,
      is_free: true,
      trust_score: 98,
      nip66_enriched: true,
      blossom_supported: false,
      community_top_tag: 'Best for General Chat',
    },
    meta: { source: '0xNostrRelays API', version: '1.0' },
  }, null, 2);

  const curlExample = `curl -X GET \\
  "https://api.0xnostrrelays.xyz/api/relays?uptime_gte=99&blossom=true&limit=10" \\
  -H "Accept: application/json"`;

  const jsExample = `// JavaScript / TypeScript
const res = await fetch(
  'https://api.0xnostrrelays.xyz/api/relays?' +
  new URLSearchParams({
    uptime_gte: '99',
    pricing: 'free',
    best_for: 'blossom',
    limit: '10',
    sort: 'latency',
  })
);
const { data } = await res.json();
// data is RelayApiRecord[]
console.log(data[0].url); // wss://relay.primal.net`;

  const pythonExample = `# Python
import requests

resp = requests.get(
    'https://api.0xnostrrelays.xyz/api/relays',
    params={
        'uptime_gte': 98,
        'country': 'DE',
        'best_for': 'general',
        'limit': 20,
    }
)
relays = resp.json()['data']
for r in relays:
    print(r['url'], r['uptime_30d'])`;

  const coracle = `// Coracle / NDK integration example
import { NDK } from '@nostr-dev-kit/ndk';

// Fetch top free relays from 0xNostrRelays API
const res = await fetch('https://api.0xnostrrelays.xyz/api/relays?pricing=free&uptime_gte=99&limit=5');
const { data: topRelays } = await res.json();

const ndk = new NDK({
  explicitRelayUrls: topRelays.map(r => r.url),
});
await ndk.connect();`;

  const amethyst = `// Amethyst Android — relay list import
// Paste this URL in Amethyst → Settings → Relay Sources:
// https://api.0xnostrrelays.xyz/api/relays?pricing=free&uptime_gte=98&format=nip65

// Or use the nostr:// deep link:
// nostr://relaylist?source=0xnostrrelays&filter=free&min_uptime=98`;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      {/* Hero */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-4">
          <Code2 className="w-3.5 h-3.5" />
          Developer API
        </div>
        <h1 className="text-4xl font-black mb-3">
          Free Public API for Nostr Clients
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed mb-4">
          Query the most comprehensive Nostr relay directory programmatically.
          Filter by uptime, pricing, NIP support, Blossom, country, and community votes.
          <strong className="text-foreground"> Free forever, no API key required.</strong>
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            { icon: Zap, label: '100 req/min', desc: 'Rate limit per IP' },
            { icon: Globe2, label: 'CORS enabled', desc: 'Use from any browser' },
            { icon: Shield, label: 'No auth needed', desc: 'Free forever' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center gap-2 bg-card border border-border/50 rounded-lg px-3 py-2">
                <Icon className="w-4 h-4 text-primary" />
                <div>
                  <div className="text-sm font-semibold">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Base URL */}
      <Card className="border-border/60 mb-8 bg-[hsl(240_12%_8%)]">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Base URL</div>
              <code className="text-base font-mono text-primary">https://api.0xnostrrelays.xyz</code>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Version</div>
              <span className="text-sm font-mono">v1.0</span>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Format</div>
              <span className="text-sm font-mono">JSON (application/json)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="endpoints" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="try">Try It Live</TabsTrigger>
          <TabsTrigger value="examples">Client Examples</TabsTrigger>
          <TabsTrigger value="schema">Data Schema</TabsTrigger>
          <TabsTrigger value="ratelimit">Rate Limits</TabsTrigger>
        </TabsList>

        {/* ─── Endpoints ──────────────────────────────────────────────────────── */}
        <TabsContent value="endpoints" className="space-y-3">
          <EndpointCard
            method="GET"
            path="/api/relays"
            description="List relays with optional filtering, sorting, and pagination. Returns rich JSON with NIP-11 data, community votes, NIP-66 health, and geo info."
            params={[
              { name: 'limit', type: 'integer', desc: 'Max results to return (default: 50, max: 200)' },
              { name: 'offset', type: 'integer', desc: 'Pagination offset (default: 0)' },
              { name: 'uptime_gte', type: 'float', desc: 'Minimum 30d uptime percentage (e.g. 99)' },
              { name: 'pricing', type: 'enum', desc: 'free | paid | any (default: any)' },
              { name: 'blossom', type: 'boolean', desc: 'true = only Blossom-enabled relays' },
              { name: 'country', type: 'string', desc: 'ISO 3166-1 alpha-2 country code (e.g. DE, US)' },
              { name: 'nips', type: 'string', desc: 'Comma-separated NIP numbers (e.g. 1,9,17)' },
              { name: 'best_for', type: 'string', desc: 'Community voted tag (e.g. images, blossom, dms)' },
              { name: 'sort', type: 'enum', desc: 'uptime | latency | trust_score | newest (default: uptime)' },
              { name: 'online_only', type: 'boolean', desc: 'true = only currently online relays' },
              { name: 'nip66', type: 'boolean', desc: 'true = only NIP-66 enriched relays' },
              { name: 'format', type: 'enum', desc: 'json | nip65 — nip65 returns a kind:10002 event body' },
              { name: 'policy', type: 'enum', desc: 'public | auth | pow — filter by write policy' },
            ]}
            response={exampleListResponse}
          />

          <EndpointCard
            method="GET"
            path="/api/relays/:url"
            description="Get full details for a single relay by its WSS URL. URL-encode the relay URL (e.g. wss%3A%2F%2Frelay.damus.io). Returns NIP-11, NIP-66, community votes, uptime history, pricing."
            params={[
              { name: 'url', type: 'string', desc: 'URL-encoded WSS relay URL (path param)', required: true },
            ]}
            response={exampleSingleResponse}
          />

          <EndpointCard
            method="GET"
            path="/api/relays/search"
            description="Full-text search across relay names, descriptions, URLs, and use-case tags."
            params={[
              { name: 'q', type: 'string', desc: 'Search query string', required: true },
              { name: 'limit', type: 'integer', desc: 'Max results (default: 20)' },
            ]}
          />

          <EndpointCard
            method="GET"
            path="/api/relays/nip66"
            description="Get relays with the latest NIP-66 health data. Useful for monitoring dashboards. Sorted by monitor recency."
            params={[
              { name: 'status', type: 'enum', desc: 'online | offline | degraded | any (default: any)' },
              { name: 'monitor', type: 'string', desc: 'Filter by specific monitor pubkey' },
            ]}
          />

          <EndpointCard
            method="GET"
            path="/api/votes/:url"
            description="Get community vote aggregates for a relay."
            params={[
              { name: 'url', type: 'string', desc: 'URL-encoded WSS relay URL', required: true },
            ]}
          />

          <EndpointCard
            method="GET"
            path="/api/stats"
            description="Global directory statistics: total relays, online count, average uptime, top countries, NIP-66 coverage, etc."
          />
        </TabsContent>

        {/* ─── Try it ──────────────────────────────────────────────────────────── */}
        <TabsContent value="try">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Play className="w-4 h-4 text-primary" />
                Interactive API Explorer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                ⚡ Results are simulated from local seed data. When deployed, this queries the live database.
              </div>
              <TryItBox />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Examples ─────────────────────────────────────────────────────────── */}
        <TabsContent value="examples" className="space-y-5">
          <div>
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">cURL</span>
              Basic request
            </h3>
            <CodeBlock code={curlExample} language="bash" />
          </div>

          <Separator />

          <div>
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <span className="text-xs bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 px-2 py-0.5 rounded font-mono">JS/TS</span>
              JavaScript / TypeScript
            </h3>
            <CodeBlock code={jsExample} language="typescript" />
          </div>

          <Separator />

          <div>
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <span className="text-xs bg-blue-500/10 text-blue-500 border border-blue-500/30 px-2 py-0.5 rounded font-mono">Python</span>
              Python
            </h3>
            <CodeBlock code={pythonExample} language="python" />
          </div>

          <Separator />

          <div>
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <span className="text-xs bg-violet-500/10 text-violet-500 border border-violet-500/30 px-2 py-0.5 rounded font-mono">NDK</span>
              Coracle / NDK Integration
            </h3>
            <CodeBlock code={coracle} language="typescript" />
          </div>

          <Separator />

          <div>
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <span className="text-xs bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">Android</span>
              Amethyst Android
            </h3>
            <CodeBlock code={amethyst} language="kotlin" />
          </div>
        </TabsContent>

        {/* ─── Schema ──────────────────────────────────────────────────────────── */}
        <TabsContent value="schema">
          <Card className="border-border/60">
            <CardContent className="pt-5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">RelayApiRecord</div>
              <div className="space-y-2">
                {[
                  { field: 'url', type: 'string', desc: 'WebSocket URL (wss://)' },
                  { field: 'name', type: 'string', desc: 'Human-readable relay name' },
                  { field: 'description', type: 'string', desc: 'Short relay description' },
                  { field: 'is_online', type: 'boolean', desc: 'Current online status (checked every 4-6h)' },
                  { field: 'uptime_30d', type: 'float', desc: '30-day uptime percentage (0-100)' },
                  { field: 'latency_ms', type: 'integer | null', desc: 'Average round-trip latency in milliseconds' },
                  { field: 'trust_score', type: 'integer', desc: 'Composite trust score (0-100)' },
                  { field: 'is_free', type: 'boolean', desc: 'Whether basic write access is free' },
                  { field: 'country_code', type: 'string | null', desc: 'ISO 3166-1 alpha-2 country code' },
                  { field: 'blossom_supported', type: 'boolean', desc: 'Native Blossom media server support' },
                  { field: 'nip66_enriched', type: 'boolean', desc: 'Has official NIP-66 monitor health data' },
                  { field: 'supported_nips', type: 'integer[]', desc: 'NIP numbers supported by this relay' },
                  { field: 'use_cases', type: 'string[]', desc: 'Editor-curated use-case categories' },
                  { field: 'community_top_tag', type: 'string | null', desc: 'Highest-voted community tag' },
                  { field: 'payment_url', type: 'string | null', desc: 'Subscription / payment URL for paid relays' },
                  { field: 'relay_tools_url', type: 'string | null', desc: 'relay.tools one-click add URL' },
                  { field: 'last_checked', type: 'ISO 8601 string', desc: 'Timestamp of last monitoring check' },
                  { field: 'nip11', type: 'NIP11Object', desc: 'Full NIP-11 relay info document' },
                  { field: 'nip66', type: 'NIP66Object | null', desc: 'NIP-66 health data if enriched' },
                  { field: 'community_votes', type: 'VoteAggregate[]', desc: 'Community voted tags with percentages' },
                  { field: 'price_tiers', type: 'PriceTier[]', desc: 'Pricing plans with features and limits' },
                ].map((f) => (
                  <div key={f.field} className="flex items-start gap-3 py-1.5 border-b border-border/30 last:border-0">
                    <code className="font-mono text-xs text-primary min-w-[160px] flex-shrink-0">{f.field}</code>
                    <span className="text-xs text-muted-foreground min-w-[100px] flex-shrink-0 font-mono">{f.type}</span>
                    <span className="text-xs text-muted-foreground">{f.desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Rate limits ────────────────────────────────────────────────────── */}
        <TabsContent value="ratelimit" className="space-y-4">
          <Card className="border-border/60">
            <CardContent className="pt-5 space-y-4">
              <div>
                <h3 className="font-bold mb-3">Rate Limiting</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>All API requests are rate-limited per IP address using a sliding window algorithm.</p>
                  <ul className="space-y-1 ml-4 list-disc">
                    <li><strong className="text-foreground">100 requests/minute</strong> per IP (anonymous)</li>
                    <li><strong className="text-foreground">500 requests/minute</strong> with API key (contact us)</li>
                    <li>Bulk export endpoints: <strong className="text-foreground">10 requests/minute</strong></li>
                  </ul>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-bold mb-3">Response Headers</h3>
                <CodeBlock code={`X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1704067200
X-Cache: HIT
X-Data-Updated: 2024-01-01T12:00:00Z
Access-Control-Allow-Origin: *`} language="http" />
              </div>

              <Separator />

              <div>
                <h3 className="font-bold mb-3">Error Responses</h3>
                <CodeBlock code={`// 429 Too Many Requests
{
  "ok": false,
  "error": "rate_limit_exceeded",
  "message": "100 req/min exceeded. Retry after 23 seconds.",
  "retry_after": 23
}

// 400 Bad Request
{
  "ok": false,
  "error": "invalid_param",
  "message": "uptime_gte must be between 0 and 100"
}

// 404 Not Found
{
  "ok": false,
  "error": "not_found",
  "message": "Relay wss://unknown.relay not in directory"
}`} language="json" />
              </div>

              <Separator />

              <div>
                <h3 className="font-bold mb-3">CORS Policy</h3>
                <p className="text-sm text-muted-foreground">
                  All API endpoints return <code className="bg-muted px-1 rounded text-xs">Access-Control-Allow-Origin: *</code>{' '}
                  so they can be called from any browser or Nostr client without a proxy.
                  Preflight OPTIONS requests are handled automatically.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="text-center border border-primary/20 rounded-xl p-6 bg-primary/5">
            <h3 className="font-bold mb-2">Need higher limits?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Building a Nostr client or tool that needs more throughput?
              Contact us for a free API key with 500 req/min.
            </p>
            <a href="https://nostr.com" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-2">
                Contact via Nostr <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
