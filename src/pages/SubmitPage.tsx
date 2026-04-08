import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, AlertCircle, Radio, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UseCaseBadge } from "@/components/relay/UseCaseBadge";
import { USE_CASE_OPTIONS } from "@/data/relays";
import { useRelayData } from "@/hooks/useRelayData";
import { useNIP11Fetch } from "@/hooks/useRelayTest";
import type { RelayRecord, UseCaseTag } from "@/types/relay";
import { cn } from "@/lib/utils";

export function SubmitPage() {
  const [url, setUrl] = useState("");
  const [selectedUseCases, setSelectedUseCases] = useState<UseCaseTag[]>([]);
  const [notes, setNotes] = useState("");
  const [pricing, setPricing] = useState<"free" | "paid">("free");
  const [paidPrice, setPaidPrice] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const { submitRelay } = useRelayData();
  const { data: nip11Data, loading: fetchingNip11, error: nip11Error, fetch11 } = useNIP11Fetch();
  const navigate = useNavigate();

  const isValidWss = (s: string) => /^wss?:\/\/[a-zA-Z0-9.-]+(:\d+)?(\/.*)?$/.test(s.trim());

  const handleFetchNIP11 = () => {
    if (!isValidWss(url)) {
      setError("Please enter a valid wss:// URL");
      return;
    }
    setError("");
    fetch11(url.trim());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidWss(url)) {
      setError("Please enter a valid wss:// URL");
      return;
    }
    if (selectedUseCases.length === 0) {
      setError("Please select at least one use case");
      return;
    }

    const nip11 = nip11Data ?? {};
    const relay: RelayRecord = {
      id: `submitted-${Date.now()}`,
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
        limitation: nip11.limitation as RelayRecord["nip11"]["limitation"],
        payments_url: nip11.payments_url as string,
      },
      useCases: selectedUseCases,
      priceTiers: pricing === "free"
        ? [{ name: "Free", price: 0, currency: "USD", features: ["Open access"] }]
        : [
            { name: "Free", price: 0, currency: "USD", features: ["Limited access"] },
            { name: "Paid", price: Number(paidPrice) || 5, currency: "USD", billing: "monthly", features: ["Full access"] },
          ],
      isFree: pricing === "free",
      isOnline: true,
      uptimePercent30d: 0,
      uptimeSpark: [],
      lastChecked: Date.now(),
      addedAt: Date.now(),
      featured: false,
      trustScore: 0,
    };

    submitRelay(relay);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-20 text-center">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
        </div>
        <h2 className="text-3xl font-black mb-3">Relay Submitted!</h2>
        <p className="text-muted-foreground mb-2">
          Thank you for contributing to the directory. Your relay has been added and is now visible.
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          In a production environment, relays would go through a moderation queue before appearing publicly.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate("/relays")}>Browse Relays</Button>
          <Button variant="outline" onClick={() => { setSubmitted(false); setUrl(""); setSelectedUseCases([]); setNotes(""); }}>
            Submit Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Radio className="w-5 h-5 text-primary" />
          <span className="text-sm font-medium text-primary uppercase tracking-wide">Directory</span>
        </div>
        <h1 className="text-3xl font-black mb-2">Submit a Relay</h1>
        <p className="text-muted-foreground">
          Know a great Nostr relay that's not in our directory? Add it! We'll automatically fetch its NIP-11 info and start monitoring it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: URL */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Step 1: Relay URL</CardTitle>
            <CardDescription>Enter the WebSocket URL of the relay</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="wss://relay.example.com"
                  className="font-mono"
                  required
                />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleFetchNIP11}
                disabled={fetchingNip11 || !url}
                className="gap-2 flex-shrink-0"
              >
                {fetchingNip11 ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                {fetchingNip11 ? "Fetching…" : "Auto-fill"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Click "Auto-fill" to automatically fetch NIP-11 relay metadata
            </p>

            {nip11Error && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  Couldn't fetch NIP-11 info: {nip11Error}. You can still submit manually.
                </AlertDescription>
              </Alert>
            )}

            {nip11Data && (
              <Alert className="py-2 border-emerald-500/30 bg-emerald-500/5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <AlertTitle className="text-sm text-emerald-600 dark:text-emerald-400">NIP-11 fetched successfully!</AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground">
                  Name: <strong>{(nip11Data.name as string) ?? "—"}</strong>
                  {" · "}
                  NIPs: <strong>{(nip11Data.supported_nips as number[] | undefined)?.length ?? "?"}</strong>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Use Cases */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Step 2: Use Cases</CardTitle>
            <CardDescription>What is this relay best suited for?</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
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
              <p className="text-xs text-muted-foreground mt-2">Select at least one use case</p>
            )}
          </CardContent>
        </Card>

        {/* Step 3: Pricing */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Step 3: Pricing</CardTitle>
            <CardDescription>Is this relay free or paid?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              {(["free", "paid"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPricing(p)}
                  className={cn(
                    "flex-1 py-3 rounded-lg border font-medium text-sm transition-all capitalize",
                    pricing === p
                      ? "bg-primary/10 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/30"
                  )}
                >
                  {p === "free" ? "🆓 Free" : "💳 Paid"}
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
                  className="max-w-[150px]"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 4: Notes */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Step 4: Additional Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span></CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional context about this relay, its community, special features, operator info, etc."
              rows={3}
              className="resize-none"
            />
          </CardContent>
        </Card>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Submit */}
        <Button type="submit" size="lg" className="w-full gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4" />
          Submit Relay
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          By submitting, you confirm the relay is publicly accessible and you're not submitting spam.
          Submissions are reviewed before going live in a production environment.
        </p>
      </form>
    </div>
  );
}
