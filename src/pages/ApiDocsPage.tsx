import { useState, useCallback, useRef } from 'react';
import { useSeoMeta } from '@unhead/react';
import { Copy, Check, Code2, Zap, Globe2, Shield, Radio, Play, Square, Terminal, ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { APP_RELAY_PRIMARY, APP_RELAY_SECONDARY, APP_RELAY_URLS, KIND_RELAY_SUBMISSION, RELAY_SUBMISSION_D_PREFIX } from '@/lib/constants';
import { cn } from '@/lib/utils';

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

// ─── Live WebSocket Try-It Box ───────────────────────────────────────────────
function LiveTryItBox() {
  const [relayUrl, setRelayUrl] = useState(APP_RELAY_PRIMARY);
  const [filter, setFilter] = useState(JSON.stringify(
    { kinds: [KIND_RELAY_SUBMISSION], '#t': ['relay-submission'], limit: 5 },
    null, 2
  ));
  const [results, setResults] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'open' | 'error' | 'closed'>('idle');
  const [error, setError] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  const run = useCallback(() => {
    // Clean up existing connection
    if (wsRef.current) {
      try { wsRef.current.close(); } catch { /* noop */ }
    }
    setResults([]);
    setError('');
    setStatus('connecting');

    let parsedFilter: Record<string, unknown>;
    try {
      parsedFilter = JSON.parse(filter);
    } catch {
      setError('Invalid JSON filter');
      setStatus('error');
      return;
    }

    try {
      const ws = new WebSocket(relayUrl);
      wsRef.current = ws;
      const subId = 'tryit-' + Math.random().toString(36).slice(2, 8);

      ws.onopen = () => {
        setStatus('open');
        const req = JSON.stringify(['REQ', subId, parsedFilter]);
        setResults(prev => [...prev, `→ ${req}`]);
        ws.send(req);
      };

      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string) as unknown[];
          if (msg[0] === 'EVENT' && msg[2]) {
            const ev = msg[2] as Record<string, unknown>;
            const summary = JSON.stringify(ev, null, 2);
            setResults(prev => [...prev, `← EVENT ${(ev.id as string)?.slice(0, 12)}…\n${summary}`]);
          } else if (msg[0] === 'EOSE') {
            setResults(prev => [...prev, '← EOSE (End of stored events)']);
            // Close after EOSE
            ws.send(JSON.stringify(['CLOSE', subId]));
            setTimeout(() => {
              try { ws.close(); } catch { /* noop */ }
              setStatus('closed');
            }, 500);
          } else if (msg[0] === 'NOTICE') {
            setResults(prev => [...prev, `← NOTICE: ${msg[1]}`]);
          } else if (msg[0] === 'OK') {
            setResults(prev => [...prev, `← OK: ${JSON.stringify(msg.slice(1))}`]);
          } else {
            setResults(prev => [...prev, `← ${JSON.stringify(msg)}`]);
          }
        } catch {
          setResults(prev => [...prev, `← ${e.data}`]);
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection failed. The relay may be down or unreachable.');
        setStatus('error');
      };

      ws.onclose = () => {
        if (status !== 'error') setStatus('closed');
      };

      // Timeout after 15 seconds
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          try {
            ws.send(JSON.stringify(['CLOSE', subId]));
            ws.close();
          } catch { /* noop */ }
          setStatus('closed');
          setResults(prev => [...prev, '⚠ Connection timed out after 15s']);
        }
      }, 15000);
    } catch (err) {
      setError(`Failed to connect: ${err}`);
      setStatus('error');
    }
  }, [relayUrl, filter, status]);

  const stop = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch { /* noop */ }
    }
    setStatus('closed');
  }, []);

  const statusColors: Record<string, string> = {
    idle: 'bg-muted text-muted-foreground',
    connecting: 'bg-yellow-500/15 text-yellow-500',
    open: 'bg-emerald-500/15 text-emerald-500',
    error: 'bg-red-500/15 text-red-500',
    closed: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-4">
      {/* Relay picker */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Relay URL</label>
        <div className="flex gap-2 flex-wrap">
          {[APP_RELAY_PRIMARY, APP_RELAY_SECONDARY, 'wss://relay.damus.io', 'wss://nos.lol'].map((url) => (
            <button
              key={url}
              onClick={() => setRelayUrl(url)}
              className={cn(
                'text-xs px-2.5 py-1.5 rounded-lg border font-mono transition-all',
                relayUrl === url
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'border-border text-muted-foreground hover:border-primary/30'
              )}
            >
              {url.replace('wss://', '')}
            </button>
          ))}
        </div>
      </div>

      {/* Filter editor */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">REQ Filter (JSON)</label>
        <textarea
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          rows={5}
          className="w-full rounded-xl bg-[hsl(240_12%_6%)] border border-border/40 p-3 text-xs font-mono text-slate-300 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter(JSON.stringify({ kinds: [KIND_RELAY_SUBMISSION], '#t': ['relay-submission'], limit: 5 }, null, 2))}
            className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
          >
            Submissions
          </button>
          <button
            onClick={() => setFilter(JSON.stringify({ kinds: [KIND_RELAY_SUBMISSION], '#t': ['relay-approval'], limit: 5 }, null, 2))}
            className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
          >
            Approvals
          </button>
          <button
            onClick={() => setFilter(JSON.stringify({ kinds: [30166], limit: 3 }, null, 2))}
            className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
          >
            NIP-66 Monitor
          </button>
          <button
            onClick={() => setFilter(JSON.stringify({ kinds: [0], limit: 1 }, null, 2))}
            className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
          >
            Profile (kind:0)
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <Button
          onClick={run}
          size="sm"
          className="gap-2"
          disabled={status === 'connecting' || status === 'open'}
        >
          <Play className="w-3.5 h-3.5" />
          Send REQ
        </Button>
        {(status === 'connecting' || status === 'open') && (
          <Button onClick={stop} size="sm" variant="outline" className="gap-2">
            <Square className="w-3 h-3" />
            Stop
          </Button>
        )}
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', statusColors[status])}>
          {status}
        </span>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Terminal className="w-3 h-3" />
            WebSocket Messages ({results.length})
          </div>
          <div className="rounded-xl bg-[hsl(240_12%_6%)] border border-border/40 p-3 max-h-96 overflow-y-auto space-y-2">
            {results.map((msg, i) => (
              <pre key={i} className={cn(
                'text-xs font-mono whitespace-pre-wrap break-all',
                msg.startsWith('→') ? 'text-blue-400' :
                msg.startsWith('←') ? 'text-emerald-400' :
                msg.startsWith('⚠') ? 'text-yellow-400' :
                'text-slate-400'
              )}>
                {msg}
              </pre>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────
export function ApiDocsPage() {
  useSeoMeta({
    title: 'Query via Nostr Protocol — 0xRelay-Finder',
    description: 'Query the 0xRelay-Finder directory directly via the Nostr protocol. Connect to our relays over WebSocket and fetch relay submission events. No REST API — pure decentralised Nostr.',
  });

  const wsReqExample = `// Connect to our relay via WebSocket
const ws = new WebSocket('${APP_RELAY_PRIMARY}');

ws.onopen = () => {
  // Send a REQ to fetch approved relay submissions
  ws.send(JSON.stringify([
    'REQ',
    'my-sub-id',
    {
      kinds: [${KIND_RELAY_SUBMISSION}],
      '#t': ['relay-submission'],
      limit: 50
    }
  ]));
};

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);

  if (msg[0] === 'EVENT') {
    const event = msg[2];
    const payload = JSON.parse(event.content);
    console.log(payload.url, payload.name);
    // → wss://relay.damus.io, Damus Relay
  }

  if (msg[0] === 'EOSE') {
    // End of stored events — all results received
    ws.send(JSON.stringify(['CLOSE', 'my-sub-id']));
  }
};`;

  const nostrifyExample = `import { useNostr } from '@nostrify/react';

function useRelaySubmissions() {
  const { nostr } = useNostr();

  // Connect to the 0xPrivacy relay group
  const relayGroup = nostr.group([
    '${APP_RELAY_PRIMARY}',
    '${APP_RELAY_SECONDARY}',
  ]);

  // Fetch relay submissions
  const events = await relayGroup.query([{
    kinds: [${KIND_RELAY_SUBMISSION}],
    '#t': ['relay-submission'],
    limit: 50,
  }]);

  // Parse each event's content
  return events.map(ev => ({
    ...JSON.parse(ev.content),
    status: ev.tags.find(([t]) => t === 'status')?.[1],
    eventId: ev.id,
    pubkey: ev.pubkey,
  }));
}`;

  const ndkExample = `import NDK from '@nostr-dev-kit/ndk';

const ndk = new NDK({
  explicitRelayUrls: [
    '${APP_RELAY_PRIMARY}',
    '${APP_RELAY_SECONDARY}',
  ],
});
await ndk.connect();

// Fetch relay submission events
const events = await ndk.fetchEvents({
  kinds: [${KIND_RELAY_SUBMISSION}],
  '#t': ['relay-submission'],
  limit: 50,
});

for (const event of events) {
  const payload = JSON.parse(event.content);
  const status = event.tags.find(t => t[0] === 'status')?.[1];
  console.log(payload.url, payload.name, status);
}`;

  const pythonExample = `# Python — using pynostr or websocket-client
import json
import websocket

ws = websocket.create_connection('${APP_RELAY_PRIMARY}')

# Send REQ
ws.send(json.dumps([
    'REQ', 'py-sub',
    {
        'kinds': [${KIND_RELAY_SUBMISSION}],
        '#t': ['relay-submission'],
        'limit': 20
    }
]))

# Read events until EOSE
while True:
    msg = json.loads(ws.recv())
    if msg[0] == 'EVENT':
        ev = msg[2]
        payload = json.loads(ev['content'])
        status = next((t[1] for t in ev['tags'] if t[0] == 'status'), 'pending')
        print(f"{payload['url']} — {payload.get('name', '?')} [{status}]")
    elif msg[0] == 'EOSE':
        break

ws.send(json.dumps(['CLOSE', 'py-sub']))
ws.close()`;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      {/* Hero */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-4">
          <Code2 className="w-3.5 h-3.5" />
          Nostr-Native Protocol
        </div>
        <h1 className="text-4xl font-black mb-3">
          Query via Nostr Protocol
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed mb-4">
          0xRelay-Finder stores all data as cryptographically signed Nostr events.
          There is no REST API — you connect directly to our relays over WebSocket
          and query events using the standard{' '}
          <a
            href="https://github.com/nostr-protocol/nips/blob/master/01.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium"
          >
            NIP-01
          </a>{' '}
          protocol.{' '}
          <strong className="text-foreground">Fully decentralised. No API keys. No rate limits.</strong>
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            { icon: Zap, label: 'No rate limits', desc: 'Nostr protocol — unlimited' },
            { icon: Globe2, label: 'Decentralised', desc: 'Data on 7+ relays' },
            { icon: Shield, label: 'No auth needed', desc: 'Public events for all' },
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

      {/* Relay URLs */}
      <Card className="border-border/60 mb-8">
        <CardContent className="pt-5 pb-5">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Our Relay URLs</div>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Primary</Badge>
              <code className="text-sm font-mono text-primary">{APP_RELAY_PRIMARY}</code>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-xs">Secondary</Badge>
              <code className="text-sm font-mono">{APP_RELAY_SECONDARY}</code>
            </div>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Events are also mirrored to:{' '}
            {APP_RELAY_URLS.slice(2).map((url, i) => (
              <span key={url}>
                <code className="bg-muted px-1 rounded">{url.replace('wss://', '')}</code>
                {i < APP_RELAY_URLS.length - 3 && ', '}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="protocol" className="space-y-6">
        <TabsList className="bg-muted/50 flex-wrap h-auto gap-1">
          <TabsTrigger value="protocol">Protocol</TabsTrigger>
          <TabsTrigger value="try">Try It Live</TabsTrigger>
          <TabsTrigger value="examples">Code Examples</TabsTrigger>
          <TabsTrigger value="schema">Event Schema</TabsTrigger>
          <TabsTrigger value="filters">Filter Reference</TabsTrigger>
        </TabsList>

        {/* ─── Protocol ──────────────────────────────────────────────────────── */}
        <TabsContent value="protocol" className="space-y-6">
          <Alert>
            <Radio className="w-4 h-4" />
            <AlertTitle>How It Works</AlertTitle>
            <AlertDescription className="text-sm">
              All relay directory data is stored as{' '}
              <code className="bg-muted px-1 rounded text-xs">kind:{KIND_RELAY_SUBMISSION}</code>{' '}
              (NIP-78) addressable events on our Nostr relays.
              You query them using the standard NIP-01 WebSocket protocol — the same way any Nostr client fetches events.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <h3 className="font-bold text-lg">1. Connect via WebSocket</h3>
            <CodeBlock code={`const ws = new WebSocket('${APP_RELAY_PRIMARY}');`} language="javascript" />

            <h3 className="font-bold text-lg">2. Send a REQ filter</h3>
            <CodeBlock code={`ws.send(JSON.stringify([
  'REQ',
  'my-subscription-id',
  {
    kinds: [${KIND_RELAY_SUBMISSION}],       // NIP-78 app-specific data
    '#t': ['relay-submission'],  // filter by tag
    limit: 50                    // max events to return
  }
]));`} language="javascript" />

            <h3 className="font-bold text-lg">3. Receive EVENT messages</h3>
            <CodeBlock code={`// Relay sends back matching events:
["EVENT", "my-subscription-id", {
  "id": "abc123...",
  "pubkey": "d888c3...",
  "kind": ${KIND_RELAY_SUBMISSION},
  "created_at": 1719500000,
  "tags": [
    ["d", "${RELAY_SUBMISSION_D_PREFIX}wss%3A%2F%2Frelay.example.com"],
    ["r", "wss://relay.example.com"],
    ["t", "relay-submission"],
    ["status", "approved"],
    ["pricing", "free"]
  ],
  "content": "{\\"url\\":\\"wss://relay.example.com\\",\\"name\\":\\"Example Relay\\",\\"description\\":\\"...\\"}",
  "sig": "..."
}]

// When all stored events are sent:
["EOSE", "my-subscription-id"]`} language="json" />

            <h3 className="font-bold text-lg">4. Close the subscription</h3>
            <CodeBlock code={`ws.send(JSON.stringify(['CLOSE', 'my-subscription-id']));`} language="javascript" />
          </div>
        </TabsContent>

        {/* ─── Try it Live ────────────────────────────────────────────────────── */}
        <TabsContent value="try">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="w-4 h-4 text-primary" />
                Live WebSocket Console
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4 border-emerald-500/20 bg-emerald-500/5">
                <Zap className="w-4 h-4 text-emerald-500" />
                <AlertDescription className="text-xs">
                  This connects directly to a real Nostr relay via WebSocket and sends a real <code className="bg-muted px-1 rounded">REQ</code> message. The responses are live events from the network.
                </AlertDescription>
              </Alert>
              <LiveTryItBox />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Code Examples ──────────────────────────────────────────────────── */}
        <TabsContent value="examples" className="space-y-5">
          <div>
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <span className="text-xs bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 px-2 py-0.5 rounded font-mono">JS</span>
              Raw WebSocket (Browser / Node.js)
            </h3>
            <CodeBlock code={wsReqExample} language="javascript" />
          </div>

          <Separator />

          <div>
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <span className="text-xs bg-primary/10 text-primary border border-primary/30 px-2 py-0.5 rounded font-mono">Nostrify</span>
              @nostrify/react (used by this app)
            </h3>
            <CodeBlock code={nostrifyExample} language="typescript" />
          </div>

          <Separator />

          <div>
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <span className="text-xs bg-violet-500/10 text-violet-500 border border-violet-500/30 px-2 py-0.5 rounded font-mono">NDK</span>
              @nostr-dev-kit/ndk
            </h3>
            <CodeBlock code={ndkExample} language="typescript" />
          </div>

          <Separator />

          <div>
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <span className="text-xs bg-blue-500/10 text-blue-500 border border-blue-500/30 px-2 py-0.5 rounded font-mono">Python</span>
              websocket-client
            </h3>
            <CodeBlock code={pythonExample} language="python" />
          </div>
        </TabsContent>

        {/* ─── Schema ─────────────────────────────────────────────────────────── */}
        <TabsContent value="schema" className="space-y-6">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Relay Submission Event (kind:{KIND_RELAY_SUBMISSION})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Tags</div>
              <div className="space-y-2 mb-6">
                {[
                  { tag: 'd', desc: `Unique identifier: "${RELAY_SUBMISSION_D_PREFIX}<url-encoded wss URL>"` },
                  { tag: 'r', desc: 'Relay WebSocket URL (wss://…)' },
                  { tag: 't', desc: '"relay-submission" for submissions, "relay-approval" for mod decisions' },
                  { tag: 'status', desc: '"pending" | "approved" | "rejected"' },
                  { tag: 'pricing', desc: '"free" | "paid"' },
                  { tag: 'alt', desc: 'NIP-31 human-readable description' },
                  { tag: 'e', desc: '(Approvals only) References the original submission event ID' },
                ].map((f) => (
                  <div key={f.tag} className="flex items-start gap-3 py-1.5 border-b border-border/30 last:border-0">
                    <code className="font-mono text-xs text-primary min-w-[60px] flex-shrink-0">["{f.tag}"]</code>
                    <span className="text-xs text-muted-foreground">{f.desc}</span>
                  </div>
                ))}
              </div>

              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Content (JSON)</div>
              <div className="space-y-2">
                {[
                  { field: 'url', type: 'string', desc: 'Relay WebSocket URL (wss://…)' },
                  { field: 'name', type: 'string', desc: 'Human-readable relay name' },
                  { field: 'description', type: 'string', desc: 'Relay description' },
                  { field: 'nip11', type: 'object', desc: 'NIP-11 relay info document snapshot' },
                  { field: 'useCases', type: 'string[]', desc: 'Use-case tags: General, DMs, Privacy, etc.' },
                  { field: 'isFree', type: 'boolean', desc: 'Whether basic write access is free' },
                  { field: 'paidPriceUsd', type: 'number?', desc: 'Monthly price in USD for paid relays' },
                  { field: 'submittedAt', type: 'number', desc: 'Unix timestamp of submission' },
                  { field: 'submitterPubkey', type: 'string', desc: 'Hex pubkey of the submitter' },
                ].map((f) => (
                  <div key={f.field} className="flex items-start gap-3 py-1.5 border-b border-border/30 last:border-0">
                    <code className="font-mono text-xs text-primary min-w-[140px] flex-shrink-0">{f.field}</code>
                    <span className="text-xs text-muted-foreground min-w-[80px] flex-shrink-0 font-mono">{f.type}</span>
                    <span className="text-xs text-muted-foreground">{f.desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Other Event Kinds Used</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { kind: '30166', nip: 'NIP-66', desc: 'Relay Discovery — live health data from trusted monitors' },
                  { kind: '10166', nip: 'NIP-66', desc: 'Monitor Announcement — monitor metadata and check frequency' },
                  { kind: '10002', nip: 'NIP-65', desc: 'Relay List Metadata — user\'s read/write relay configuration' },
                  { kind: '7', nip: 'NIP-25', desc: 'Reactions — upvotes (+) and downvotes (-) on relay submissions' },
                  { kind: '6683', nip: 'Custom', desc: 'Community relay tag proposals' },
                  { kind: '1984', nip: 'NIP-56', desc: 'Reports — flagging relay issues' },
                ].map((k) => (
                  <div key={k.kind} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
                    <code className="font-mono text-xs bg-primary/10 text-primary px-2 py-0.5 rounded min-w-[60px] text-center flex-shrink-0">
                      {k.kind}
                    </code>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">{k.nip}</Badge>
                    <span className="text-xs text-muted-foreground">{k.desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Filter Reference ────────────────────────────────────────────────── */}
        <TabsContent value="filters" className="space-y-4">
          <Alert className="border-yellow-500/20 bg-yellow-500/5">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <AlertTitle className="text-sm">Nostr Filter Syntax</AlertTitle>
            <AlertDescription className="text-xs">
              Filters follow the{' '}
              <a
                href="https://github.com/nostr-protocol/nips/blob/master/01.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                NIP-01
              </a>{' '}
              specification. All single-letter tags are indexed by relays and can be filtered with <code className="bg-muted px-1 rounded">#&lt;tag&gt;</code>.
            </AlertDescription>
          </Alert>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Useful Queries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-semibold mb-2">All relay submissions</div>
                <CodeBlock code={`{ "kinds": [${KIND_RELAY_SUBMISSION}], "#t": ["relay-submission"], "limit": 200 }`} />
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">All approval/rejection decisions</div>
                <CodeBlock code={`{ "kinds": [${KIND_RELAY_SUBMISSION}], "#t": ["relay-approval"], "limit": 200 }`} />
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">A specific relay by URL</div>
                <CodeBlock code={`{ "kinds": [${KIND_RELAY_SUBMISSION}], "#r": ["wss://relay.damus.io"], "limit": 1 }`} />
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">Community votes on a relay</div>
                <CodeBlock code={`{ "kinds": [7], "#r": ["wss://relay.damus.io"], "limit": 50 }`} />
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">A user's relay list (NIP-65)</div>
                <CodeBlock code={`{ "kinds": [10002], "authors": ["<hex_pubkey>"], "limit": 1 }`} />
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">NIP-66 relay health for a specific relay</div>
                <CodeBlock code={`{ "kinds": [30166], "#d": ["wss://relay.damus.io/"], "limit": 1 }`} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filter Fields</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { field: 'ids', type: 'string[]', desc: 'Event IDs (hex) to fetch' },
                  { field: 'authors', type: 'string[]', desc: 'Pubkeys (hex) of event authors' },
                  { field: 'kinds', type: 'number[]', desc: 'Event kind numbers' },
                  { field: '#t', type: 'string[]', desc: 'Filter by "t" tag values' },
                  { field: '#r', type: 'string[]', desc: 'Filter by "r" tag values (relay URLs)' },
                  { field: '#d', type: 'string[]', desc: 'Filter by "d" tag values (addressable event IDs)' },
                  { field: '#e', type: 'string[]', desc: 'Filter by "e" tag values (referenced event IDs)' },
                  { field: 'since', type: 'number', desc: 'Unix timestamp — only events after this time' },
                  { field: 'until', type: 'number', desc: 'Unix timestamp — only events before this time' },
                  { field: 'limit', type: 'number', desc: 'Maximum number of events to return' },
                ].map((f) => (
                  <div key={f.field} className="flex items-start gap-3 py-1.5 border-b border-border/30 last:border-0">
                    <code className="font-mono text-xs text-primary min-w-[80px] flex-shrink-0">{f.field}</code>
                    <span className="text-xs text-muted-foreground min-w-[80px] flex-shrink-0 font-mono">{f.type}</span>
                    <span className="text-xs text-muted-foreground">{f.desc}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
