import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Check, ExternalLink, Globe2, Clock, Wifi } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UptimeBadge, OnlineIndicator } from "./UptimeBadge";
import { SparklineChart } from "./SparklineChart";
import { UseCaseBadge } from "./UseCaseBadge";
import { PriceBadge } from "./PriceBadge";
import type { RelayRecord } from "@/types/relay";
import { relayUrlToId, shortenUrl, timeAgo, getNipName, formatLatency } from "@/lib/utils";

interface RelayCardProps {
  relay: RelayRecord;
  view?: "grid" | "list";
}

export function RelayCard({ relay, view = "grid" }: RelayCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(relay.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const topNips = (relay.nip11.supported_nips ?? []).slice(0, 5);
  const extraNips = (relay.nip11.supported_nips?.length ?? 0) - topNips.length;

  if (view === "list") {
    return (
      <Link to={`/relay/${relayUrlToId(relay.url)}`} className="block">
        <div className="relay-card border border-border/60 rounded-lg px-4 py-3 bg-card hover:bg-card/80 transition-all flex items-center gap-4">
          {/* Status dot */}
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${relay.isOnline ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`} />

          {/* Name + URL */}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">{relay.name}</div>
            <div className="text-xs text-muted-foreground font-mono truncate">{shortenUrl(relay.url)}</div>
          </div>

          {/* Use cases */}
          <div className="hidden md:flex items-center gap-1 flex-shrink-0">
            {relay.useCases.slice(0, 2).map((uc) => (
              <UseCaseBadge key={uc} tag={uc} size="sm" />
            ))}
          </div>

          {/* Price */}
          <PriceBadge relay={relay} />

          {/* Uptime */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <SparklineChart data={relay.uptimeSpark} height={20} uptime={relay.uptimePercent30d} />
            <UptimeBadge uptime={relay.uptimePercent30d} />
          </div>

          {/* Latency */}
          <div className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
            <Wifi className="w-3 h-3" />
            {formatLatency(relay.avgLatencyMs)}
          </div>

          {/* Copy */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={handleCopy}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/relay/${relayUrlToId(relay.url)}`} className="block">
      <Card className="relay-card border-border/60 h-full bg-card overflow-hidden">
        {/* Top accent line */}
        <div className={`h-0.5 w-full ${relay.isOnline ? "bg-gradient-to-r from-emerald-500/50 via-primary/50 to-transparent" : "bg-gradient-to-r from-red-500/50 to-transparent"}`} />

        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <OnlineIndicator isOnline={relay.isOnline} />
                {relay.featured && (
                  <span className="text-xs bg-primary/15 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full font-medium">
                    ⭐ Featured
                  </span>
                )}
              </div>
              <h3 className="font-bold text-sm leading-tight truncate mt-1">{relay.name}</h3>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleCopy}
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p className="text-xs">{copied ? "Copied!" : "Copy relay URL"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* URL */}
          <div className="flex items-center gap-1.5 mt-1">
            <code className="text-xs text-muted-foreground font-mono truncate flex-1 bg-muted/50 px-2 py-0.5 rounded">
              {shortenUrl(relay.url)}
            </code>
            <a
              href={relay.url.replace("wss://", "https://").replace("ws://", "http://")}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-4 space-y-3">
          {/* Description */}
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {relay.description}
          </p>

          {/* Uptime + Sparkline */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SparklineChart data={relay.uptimeSpark} height={20} uptime={relay.uptimePercent30d} className="w-20" />
              <UptimeBadge uptime={relay.uptimePercent30d} />
            </div>
            <PriceBadge relay={relay} />
          </div>

          {/* Use cases */}
          <div className="flex flex-wrap gap-1">
            {relay.useCases.map((uc) => (
              <UseCaseBadge key={uc} tag={uc} size="sm" />
            ))}
          </div>

          {/* NIPs */}
          {topNips.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {topNips.map((nip) => (
                <TooltipProvider key={nip}>
                  <Tooltip>
                    <TooltipTrigger>
                      <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono hover:bg-muted/80 transition-colors">
                        NIP-{String(nip).padStart(2, "0")}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{getNipName(nip)}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
              {extraNips > 0 && (
                <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                  +{extraNips} more
                </span>
              )}
            </div>
          )}

          {/* Footer meta */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
            <div className="flex items-center gap-1">
              <Globe2 className="w-3 h-3" />
              <span>{relay.countryName ?? "Unknown"}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{timeAgo(relay.lastChecked)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
