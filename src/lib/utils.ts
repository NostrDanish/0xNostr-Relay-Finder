import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { RelayRecord } from "@/types/relay";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uptimeColor(uptime: number): "green" | "yellow" | "red" {
  if (uptime >= 99) return "green";
  if (uptime >= 95) return "yellow";
  return "red";
}

export function uptimeLabel(uptime: number): string {
  if (uptime >= 99) return "Excellent";
  if (uptime >= 97) return "Good";
  if (uptime >= 95) return "Fair";
  return "Poor";
}

export function trustScoreColor(score: number): string {
  if (score >= 95) return "text-emerald-500";
  if (score >= 85) return "text-green-500";
  if (score >= 75) return "text-yellow-500";
  return "text-red-500";
}

export function formatLatency(ms?: number): string {
  if (ms == null) return "N/A";
  if (ms < 100) return `${ms}ms`;
  return `${ms}ms`;
}

export function formatPrice(tier: RelayRecord["priceTiers"][0]): string {
  if (tier.price === 0) return "Free";
  if (tier.currency === "sats") return `${tier.price.toLocaleString()} sats/${tier.billing ?? "mo"}`;
  return `$${tier.price}/${tier.billing === "yearly" ? "yr" : "mo"}`;
}

export function getMinPrice(relay: RelayRecord): string {
  if (relay.isFree) return "Free";
  const paid = relay.priceTiers.filter((t) => t.price > 0);
  if (!paid.length) return "Free";
  const min = Math.min(...paid.map((t) => t.price));
  const tier = paid.find((t) => t.price === min)!;
  return formatPrice(tier);
}

export function relayUrlToId(url: string): string {
  return encodeURIComponent(url);
}

export function idToRelayUrl(id: string): string {
  return decodeURIComponent(id);
}

export function shortenUrl(url: string): string {
  return url.replace(/^wss?:\/\//, "");
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function getNipName(nip: number): string {
  const names: Record<number, string> = {
    1: "Basic", 2: "Follows", 4: "DMs", 5: "Event Deletion",
    6: "Reposts", 7: "Reactions", 9: "Event Deletion", 10: "Thread",
    11: "Relay Info", 12: "Generic Tags", 13: "PoW", 14: "Private DMs",
    15: "End of Stored", 16: "Generic Reposts", 17: "Private DMs",
    18: "Repost", 20: "Command Results", 22: "Event Expiry",
    23: "Long-form", 25: "Reactions", 28: "Polls", 29: "Groups",
    30: "Custom Emoji", 32: "Labeling", 33: "Parameterized", 36: "Sensitive",
    38: "User Status", 39: "Profile Badges", 40: "Channel Creation",
    41: "Channel Metadata", 42: "Channel Messages", 44: "Versioned Encryption",
    45: "Counting", 50: "Search", 51: "Lists", 52: "Calendar",
    53: "Live Events", 56: "Reporting", 57: "Zaps", 58: "Badges",
    65: "Relay List", 71: "Video", 72: "Moderation", 75: "Zap Goals",
    78: "App-Specific Data", 84: "Highlights", 89: "App Handlers",
    90: "Job Requests", 94: "File Metadata", 96: "HTTP File Storage",
    98: "HTTP Auth", 99: "Classified Listings",
  };
  return names[nip] ?? `NIP-${nip.toString().padStart(2, "0")}`;
}

export function filterRelays(
  relays: RelayRecord[],
  opts: {
    search?: string;
    pricing?: "free" | "paid" | "any";
    minUptime?: number;
    countryCodes?: string[];
    useCases?: string[];
    nips?: number[];
    onlineOnly?: boolean;
    sortBy?: "uptime" | "score" | "alpha" | "newest" | "popular";
  }
): RelayRecord[] {
  let result = [...relays];

  if (opts.search) {
    const q = opts.search.toLowerCase();
    result = result.filter(
      (r) =>
        r.url.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.useCases.some((u) => u.toLowerCase().includes(q)) ||
        (r.nip11.tags ?? []).some((t) => t.toLowerCase().includes(q))
    );
  }

  if (opts.pricing === "free") result = result.filter((r) => r.isFree);
  if (opts.pricing === "paid") result = result.filter((r) => !r.isFree);

  if (opts.minUptime != null) {
    result = result.filter((r) => r.uptimePercent30d >= opts.minUptime!);
  }

  if (opts.countryCodes?.length) {
    result = result.filter((r) => r.countryCode && opts.countryCodes!.includes(r.countryCode));
  }

  if (opts.useCases?.length) {
    result = result.filter((r) => opts.useCases!.some((uc) => r.useCases.includes(uc as RelayRecord["useCases"][0])));
  }

  if (opts.nips?.length) {
    result = result.filter((r) =>
      opts.nips!.every((nip) => r.nip11.supported_nips?.includes(nip))
    );
  }

  if (opts.onlineOnly) {
    result = result.filter((r) => r.isOnline);
  }

  const sortBy = opts.sortBy ?? "uptime";
  result.sort((a, b) => {
    switch (sortBy) {
      case "uptime": return b.uptimePercent30d - a.uptimePercent30d;
      case "score": return b.trustScore - a.trustScore;
      case "alpha": return a.name.localeCompare(b.name);
      case "newest": return b.addedAt - a.addedAt;
      case "popular": return b.trustScore - a.trustScore;
      default: return 0;
    }
  });

  return result;
}
