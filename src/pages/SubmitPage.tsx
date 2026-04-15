import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSeoMeta } from "@unhead/react";
import {
  CheckCircle2, Loader2, AlertCircle, Radio, ExternalLink,
  Wifi, Copy, Check, Lock, Unlock, Zap, Info, Globe2,
  ShieldCheck, ArrowRight, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UseCaseBadge } from "@/components/relay/UseCaseBadge";
import { LoginArea } from "@/components/auth/LoginArea";
import { USE_CASE_OPTIONS } from "@/data/relays";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNIP11Fetch } from "@/hooks/useRelayTest";
import { useRelaySubmit } from "@/hooks/useRelaySubmit";
import type { RelaySubmissionPayload } from "@/hooks/useRelaySubmit";
import type { UseCaseTag } from "@/types/relay";
import { cn, shortenUrl } from "@/lib/utils";
import { APP_RELAY_URL as APP_RELAY, APP_NPUB } from "@/lib/constants";

function StepBadge({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div className={cn(
      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all",
      done ? "bg-emerald-500 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
    )}>
      {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : n}
    </div>
  );
}

export function SubmitPage() {
  useSeoMeta({
    title: "Submit a Relay — 0xNostrRelays",
    description: "Submit a new Nostr relay to the 0xNostrRelays directory. Submissions are published directly to Nostr using kind:30078.",
  });

  const { user } = useCurrentUser();
  const { data: nip11Data, loading: fetchingNip11, error: nip11Error, fetch11 } = useNIP11Fetch();
  const { result, submit, reset } = useRelaySubmit();

  const [url, setUrl] = useState("");
  const [selectedUseCases, setSelectedUseCases] = useState<UseCaseTag[]>([]);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [pricing, setPricing] = useState<"free" | "paid">("free");
  const [paidPrice, setPaidPrice] = useState("");
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const isValidWss = (s: string) => /^wss?:\/\/[a-zA-Z0-9.-]+(:\d+)?(\/.*)?$/.test(s.trim());

  // Auto-advance step when NIP-11 fetched
  useEffect(() => {
    if (nip11Data) setStep(2);
  }, [nip11Data]);

  const handleFetchNIP11 = () => {
    if (!isValidWss(url)) {
      setError("Please enter a valid wss:// URL (e.g. wss://relay.example.com)");
      return;
    }
    setError("");
    fetch11(url.trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("You must log in with Nostr to submit a relay.");
      return;
    }
    if (!isValidWss(url)) {
      setError("Please enter a valid wss:// URL");
      return;
    }
    if (selectedUseCases.length === 0) {
      setError("Please select at least one use case");
      return;
    }

    setError("");

    const nip11 = nip11Data ?? {};
    const payload: RelaySubmissionPayload = {
      url: url.trim(),
      name: (nip11.name as string) ?? url.replace(/^wss?:\/\//, ""),
      description: (nip11.description as string) ?? notes,
      nip11: {
        name: nip11.name as string,
        description: nip11.description as string,
        supported_nips: nip11.supported_nips as number[],
        software: nip11.software as string,
        version: nip11.version as string,
        contact: nip11.contact as string,
        pubkey: nip11.pubkey as string,
        limitation: nip11.limitation as RelaySubmissionPayload['nip11']['limitation'],
        payments_url: nip11.payments_url as string,
      },
      useCases: selectedUseCases,
      isFree: pricing === "free",
      paidPriceUsd: pricing === "paid" ? (Number(paidPrice) || 5) : undefined,
      submitterNotes: notes || undefined,
      submittedAt: Math.floor(Date.now() / 1000),
      submitterPubkey: user.pubkey,
      version: '1.0',
    };

    await submit(payload);
  };

  const handleCopyEventId = () => {
    if (result.eventId) {
      navigator.clipboard.writeText(result.eventId).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  // ── Success State ─────────────────────────────────────────────────────────
  if (result.status === 'success') {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>

          <div>
            <h2 className="text-3xl font-black mb-2">Relay Submitted! 🎉</h2>
            <p className="text-muted-foreground">
              Your submission has been published to the Nostr network via{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">kind:30078</code>{" "}
              and stored on our relay.
            </p>
          </div>

          {/* Submission receipt */}
          <Card className="border-emerald-500/20 bg-emerald-500/5 text-left">
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Relay URL</span>
                <code className="font-mono text-xs">{result.relayUrl}</code>
              </div>
              {result.eventId && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Event ID</span>
                  <div className="flex items-center gap-1.5">
                    <code className="font-mono text-xs text-foreground">
                      {result.eventId.slice(0, 16)}…
                    </code>
                    <button onClick={handleCopyEventId} className="text-muted-foreground hover:text-foreground">
                      {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Published to</span>
                <code className="font-mono text-xs">{shortenUrl(APP_RELAY)}</code>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className="text-yellow-500 font-medium flex items-center gap-1">
                  <Loader2 className="w-3 h-3" /> Pending review
                </span>
              </div>
            </CardContent>
          </Card>

          {/* How it works */}
          <Alert className="text-left">
            <Info className="w-4 h-4" />
            <AlertTitle>What happens next?</AlertTitle>
            <AlertDescription className="text-xs space-y-1 mt-1">
              <p>1. Your submission is now live on the Nostr network as a <code className="bg-muted px-1 rounded">kind:30078</code> event.</p>
              <p>2. The app moderator (<code className="bg-muted px-1 rounded">{APP_NPUB.slice(0, 20)}…</code>) reviews your submission.</p>
              <p>3. Once approved, the relay appears in the public directory. This usually takes under 24 hours.</p>
              <p>4. You can track your submission by searching for your event ID on any Nostr explorer.</p>
            </AlertDescription>
          </Alert>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/relays">
              <Button className="gap-2">
                Browse Relays <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
            <Button variant="outline" onClick={() => {
              reset();
              setUrl("");
              setSelectedUseCases([]);
              setNotes("");
              setPricing("free");
              setStep(1);
            }}>
              Submit Another
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Form ─────────────────────────────────────────────────────────────
  const isPublishing = result.status === 'publishing' || result.status === 'encrypting';

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Radio className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-primary uppercase tracking-wide">Directory</span>
        </div>
        <h1 className="text-3xl font-black mb-2">Submit a Relay</h1>
        <p className="text-muted-foreground text-sm max-w-xl">
          Know a great Nostr relay that's not in our directory? Add it!
          Submissions are published as <code className="bg-muted px-1 rounded text-xs">kind:30078</code> Nostr
          events directly to <code className="bg-muted px-1 rounded text-xs">{shortenUrl(APP_RELAY)}</code>{" "}
          — decentralized and permanent.
        </p>
      </div>

      {/* Login requirement */}
      {!user ? (
        <Card className="border-primary/20 bg-primary/5 mb-6">
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1 text-center sm:text-left">
                <h3 className="font-bold mb-1">Nostr Login Required</h3>
                <p className="text-sm text-muted-foreground">
                  Submissions are signed Nostr events. Log in with your Nostr identity to prove authorship
                  and enable decentralized sync.
                </p>
              </div>
              <LoginArea className="flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-emerald-500/20 bg-emerald-500/5 mb-6">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span className="text-muted-foreground">
                Submitting as <code className="bg-muted px-1 rounded text-xs font-mono">{user.pubkey.slice(0, 12)}…</code>
              </span>
              {user.signer.nip44 && (
                <span className="flex items-center gap-1 text-xs text-violet-500 ml-auto">
                  <Lock className="w-3 h-3" />
                  NIP-44 encryption available
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* How it works info bar */}
      <div className="flex items-start gap-3 bg-muted/40 border border-border/40 rounded-lg px-3 py-2.5 mb-6 text-xs text-muted-foreground">
        <ShieldCheck className="w-3.5 h-3.5 text-violet-500 flex-shrink-0 mt-0.5" />
        <div>
          <strong className="text-foreground">Decentralized submissions</strong> — Your relay info is published as a signed Nostr event.
          Private operator notes are <strong className="text-foreground">NIP-44 encrypted</strong> to the app pubkey before publishing.
          The submission event ID is your permanent receipt.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Step 1: URL + NIP-11 */}
        <Card className={cn("border-border/60 transition-all", step >= 1 && "border-primary/30")}>
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-3">
              <StepBadge n={1} active={step === 1} done={step > 1 || !!nip11Data} />
              <div>
                <CardTitle className="text-base">Relay URL</CardTitle>
                <CardDescription className="text-xs">Enter the WebSocket URL and auto-fetch NIP-11 metadata</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Wifi className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setError(""); }}
                  placeholder="wss://relay.example.com"
                  className="pl-9 font-mono text-sm"
                  required
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleFetchNIP11}
                disabled={fetchingNip11 || !url.trim()}
                className="gap-2 flex-shrink-0"
              >
                {fetchingNip11
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching…</>
                  : <><ExternalLink className="w-3.5 h-3.5" /> Auto-fill</>
                }
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Paste the <code className="bg-muted px-1 rounded">wss://</code> WebSocket URL, then click Auto-fill
              to fetch the relay's NIP-11 info document automatically.
            </p>

            {nip11Error && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  Couldn't fetch NIP-11 (<span className="font-mono">{nip11Error}</span>).
                  You can still continue — fill in the details manually.
                </AlertDescription>
              </Alert>
            )}

            {nip11Data && (
              <Alert className="py-2 border-emerald-500/30 bg-emerald-500/5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <AlertTitle className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  NIP-11 fetched ✓
                </AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground mt-0.5 space-x-3">
                  <span>Name: <strong className="text-foreground">{(nip11Data.name as string) ?? "—"}</strong></span>
                  <span>Software: <strong className="text-foreground">{(nip11Data.software as string) ?? "—"}</strong></span>
                  <span>NIPs: <strong className="text-foreground">{(nip11Data.supported_nips as number[] | undefined)?.length ?? "?"}</strong></span>
                </AlertDescription>
              </Alert>
            )}

            {/* Manual override for description if NIP-11 failed */}
            {!nip11Data && url && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Short Description (optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="A brief description of this relay…"
                  className="text-sm"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Use Cases */}
        <Card className={cn("border-border/60 transition-all", step >= 2 && "border-primary/30")}>
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-3">
              <StepBadge n={2} active={step === 2} done={step > 2 || selectedUseCases.length > 0} />
              <div>
                <CardTitle className="text-base">Use Cases</CardTitle>
                <CardDescription className="text-xs">What is this relay best suited for? (select all that apply)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="flex flex-wrap gap-2 mb-2">
              {USE_CASE_OPTIONS.map((uc) => (
                <button
                  key={uc}
                  type="button"
                  onClick={() => {
                    setSelectedUseCases((prev) =>
                      prev.includes(uc as UseCaseTag)
                        ? prev.filter((u) => u !== uc)
                        : [...prev, uc as UseCaseTag]
                    );
                    if (step === 2) setStep(3);
                  }}
                >
                  <UseCaseBadge
                    tag={uc as UseCaseTag}
                    size="md"
                    active={selectedUseCases.includes(uc as UseCaseTag)}
                  />
                </button>
              ))}
            </div>
            {selectedUseCases.length === 0 && (
              <p className="text-xs text-muted-foreground">Select at least one use case</p>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Pricing */}
        <Card className={cn("border-border/60 transition-all", step >= 3 && "border-primary/30")}>
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center gap-3">
              <StepBadge n={3} active={step === 3} done={step > 3} />
              <div>
                <CardTitle className="text-base">Pricing</CardTitle>
                <CardDescription className="text-xs">Is this relay free or paid?</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5">
            <div className="flex gap-2">
              {(["free", "paid"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setPricing(p); if (step === 3) setStep(4); }}
                  className={cn(
                    "flex-1 py-3 rounded-lg border font-medium text-sm transition-all",
                    pricing === p
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  )}
                >
                  {p === "free" ? (
                    <span className="flex items-center justify-center gap-2"><Unlock className="w-3.5 h-3.5" /> Free</span>
                  ) : (
                    <span className="flex items-center justify-center gap-2"><Lock className="w-3.5 h-3.5" /> Paid</span>
                  )}
                </button>
              ))}
            </div>

            {pricing === "paid" && (
              <div className="space-y-1.5">
                <Label htmlFor="price" className="text-sm">Starting price (USD/month)</Label>
                <Input
                  id="price"
                  type="number"
                  value={paidPrice}
                  onChange={(e) => setPaidPrice(e.target.value)}
                  placeholder="e.g. 5"
                  min="0"
                  step="0.01"
                  className="max-w-[160px]"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 4: Private notes (encrypted) */}
        <Card className={cn("border-border/60 transition-all", step >= 4 && "border-primary/30")}>
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StepBadge n={4} active={step === 4} done={false} />
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    Private Notes
                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                    {user?.signer.nip44 && (
                      <span className="text-xs bg-violet-500/10 text-violet-500 border border-violet-500/20 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> NIP-44 encrypted
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Operator contact, verification info, or moderation notes.
                    {user?.signer.nip44
                      ? " Encrypted to the app pubkey before publishing."
                      : " Stored unencrypted (upgrade your signer for NIP-44 encryption)."}
                  </CardDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNotes(!showNotes)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {showNotes ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </CardHeader>
          {showNotes && (
            <CardContent className="px-5 pb-5">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Operator contact info, relay policies, verification details, or anything you'd like the moderators to know…"
                rows={3}
                className="resize-none text-sm"
              />
              <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="w-3 h-3 flex-shrink-0 mt-0.5" />
                {user?.signer.nip44
                  ? "These notes will be NIP-44 encrypted to the app pubkey. Only the app moderator can decrypt them."
                  : "Your signer doesn't support NIP-44. Notes will be stored in plaintext. Consider using a NIP-44 compatible signer."}
              </div>
            </CardContent>
          )}
        </Card>

        <Separator />

        {/* Submission summary */}
        {url && selectedUseCases.length > 0 && (
          <div className="bg-muted/30 border border-border/40 rounded-xl px-4 py-3 text-sm space-y-2">
            <div className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">Submission Summary</div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Relay URL</span>
              <code className="text-xs font-mono">{shortenUrl(url)}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Use Cases</span>
              <span className="text-xs">{selectedUseCases.join(', ')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Pricing</span>
              <span className="text-xs capitalize">{pricing}{pricing === 'paid' && paidPrice ? ` ($${paidPrice}/mo)` : ''}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Event kind</span>
              <code className="text-xs bg-muted px-1 rounded">30078 (NIP-78)</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Published to</span>
              <div className="flex items-center gap-1">
                <Globe2 className="w-3 h-3 text-muted-foreground" />
                <code className="text-xs font-mono">{shortenUrl(APP_RELAY)}</code>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {(error || result.error) && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error || result.error}</AlertDescription>
          </Alert>
        )}

        {/* Publishing status */}
        {result.status === 'encrypting' && (
          <Alert className="border-violet-500/30 bg-violet-500/5">
            <Lock className="w-4 h-4 text-violet-500" />
            <AlertDescription className="text-xs">
              <Loader2 className="w-3 h-3 animate-spin inline mr-1.5" />
              Encrypting private notes with NIP-44 to app pubkey…
            </AlertDescription>
          </Alert>
        )}
        {result.status === 'publishing' && (
          <Alert className="border-primary/30 bg-primary/5">
            <Radio className="w-4 h-4 text-primary" />
            <AlertDescription className="text-xs">
              <Loader2 className="w-3 h-3 animate-spin inline mr-1.5" />
              Publishing kind:30078 event to {shortenUrl(APP_RELAY)}…
            </AlertDescription>
          </Alert>
        )}

        {/* Submit button */}
        <Button
          type="submit"
          size="lg"
          className="w-full gap-2 font-semibold"
          disabled={isPublishing || !user || !url || selectedUseCases.length === 0}
        >
          {isPublishing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {result.status === 'encrypting' ? 'Encrypting…' : 'Publishing…'}</>
          ) : (
            <><Zap className="w-4 h-4" /> Submit Relay to Directory</>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          By submitting, you confirm this relay is publicly accessible and you are not submitting spam.
          Your Nostr pubkey is attached to the submission event as proof of authorship.
        </p>
      </form>
    </div>
  );
}
