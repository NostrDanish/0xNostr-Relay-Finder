/**
 * Relay Snapshot — schema for the GitHub Actions "auto-tick" data store.
 *
 * The crawler (scripts/crawl) runs on a schedule, pulls NIP-66 observations
 * from the whole monitor network, directly probes stale relays, and commits:
 *
 *   src/lib/snapshot/generated.json    — full machine-readable state (history)
 *   src/lib/snapshot/generated.ts      — trimmed typed mirror bundled by the app
 *   src/lib/snapshot/crawl-report.json — per-run report
 *
 * This module is framework-free: shared by the crawler and the frontend.
 */

/** One liveness observation point. Compact tuple shape for small diffs. */
export interface HistoryPoint {
  /** Unix seconds */
  t: number;
  /** 1 = seen online this run, 0 = checked but offline */
  up: 0 | 1;
  /** Open RTT in ms (null when offline/unknown) */
  rtt: number | null;
}

/** A detected change in a relay's advertised capabilities. */
export interface SnapshotChange {
  /** Unix seconds */
  t: number;
  kind: 'nips' | 'software' | 'status';
  /** NIPs added/removed (kind === 'nips') */
  added?: number[];
  removed?: number[];
  /** Human detail for software/status changes */
  detail?: string;
}

/** Trimmed NIP-11 data kept in the snapshot (full doc stays in history JSON). */
export interface SnapshotNip11 {
  name?: string;
  description?: string;
  pubkey?: string;
  contact?: string;
  software?: string;
  version?: string;
  supported_nips?: number[];
  limitation?: {
    auth_required?: boolean;
    payment_required?: boolean;
    restricted_writes?: boolean;
    min_pow_difficulty?: number;
  };
  relay_countries?: string[];
  language_tags?: string[];
  tags?: string[];
  payments_url?: string;
  icon?: string;
}

/** Full crawler state for one relay (lives in generated.json). */
export interface SnapshotRelayState {
  /** Canonical wss:// URL — primary key */
  url: string;
  firstSeen: number; // unix seconds
  lastSeen: number; // unix seconds (last time ANY source saw it online)
  lastChecked: number; // unix seconds (last observation, online or not)
  /** Rolling observation history, oldest first, capped (see crawler). */
  history: HistoryPoint[];
  /** Latest trimmed NIP-11 doc (from monitor content or direct HTTP fetch) */
  nip11?: SnapshotNip11;
  /** Union of supported NIPs reported by monitors + NIP-11 */
  nips: number[];
  software?: string;
  version?: string;
  geohash?: string;
  network?: string;
  relayType?: string;
  requirements: { auth: boolean; payment: boolean; pow: boolean; writes: boolean | null };
  /** Monitor pubkeys that have observed this relay */
  monitors: string[];
  /** Recent capability changes, newest first, capped */
  changes: SnapshotChange[];
}

/** Full persistent crawler state (generated.json). */
export interface SnapshotState {
  generatedAt: number; // unix seconds
  /** Active relays — seen within the retention window */
  relays: SnapshotRelayState[];
  /** Dead relays — not seen online for the graveyard window */
  graveyard: GraveyardEntry[];
}

export interface GraveyardEntry {
  url: string;
  name?: string;
  software?: string;
  firstSeen: number;
  lastSeen: number;
}

/** One network-wide stats point, appended every crawl run. */
export interface StatsPoint {
  /** Unix seconds */
  t: number;
  total: number;
  online: number;
  /** Median open RTT across online relays */
  medianRtt: number | null;
  /** How many distinct monitors contributed data */
  monitors: number;
  /** Relays first seen this run */
  newRelays: number;
}

/** Trimmed per-relay record bundled into the frontend (generated.ts). */
export interface SnapshotRelay {
  url: string;
  firstSeen: number;
  lastSeen: number;
  lastChecked: number;
  nip11?: SnapshotNip11;
  nips: number[];
  software?: string;
  version?: string;
  geohash?: string;
  network?: string;
  relayType?: string;
  requirements: { auth: boolean; payment: boolean; pow: boolean; writes: boolean | null };
  monitorCount: number;
  /** Fraction of online observations over the last 30 days (0–1) */
  uptime30d: number;
  /** Median open RTT over recent history (ms) */
  medianRttMs: number | null;
  /** Last N observation points as 0/1 (oldest → newest), for sparklines */
  spark: number[];
  changes: SnapshotChange[];
}

/** What the frontend bundles. */
export interface BundledSnapshot {
  generatedAt: number;
  relays: SnapshotRelay[];
  graveyard: GraveyardEntry[];
  stats: StatsPoint[];
}

// ─── Crawl report ───────────────────────────────────────────────────────────

export interface CrawlSourceReport {
  id: string;
  status: 'ok' | 'error' | 'skipped';
  items: number;
  errors: string[];
  durationMs: number;
  reason?: string;
}

export interface CrawlReport {
  ranAt: number; // unix seconds
  durationMs: number;
  sources: CrawlSourceReport[];
  totals: {
    relaysActive: number;
    relaysOnline: number;
    relaysNew: number;
    relaysGraveyard: number;
    monitorsSeen: number;
    probedDirectly: number;
    nip11Fetched: number;
    published: number;
  };
}

// ─── Shared derivations (used by crawler AND frontend) ──────────────────────

/** Median of a numeric list (undefined-safe). */
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

const DAY_S = 86_400;

/** Uptime fraction over the trailing `windowS` seconds from a history list. */
export function uptimeFromHistory(history: HistoryPoint[], nowS: number, windowS = 30 * DAY_S): number {
  const cutoff = nowS - windowS;
  const recent = history.filter((p) => p.t >= cutoff);
  if (!recent.length) return 0;
  return recent.filter((p) => p.up === 1).length / recent.length;
}

/** Last `n` points as 0/1 sparkline values (oldest → newest). */
export function sparkFromHistory(history: HistoryPoint[], n = 14): number[] {
  return history.slice(-n).map((p) => p.up);
}

/** Convert full state → the trimmed record bundled for the frontend. */
export function toSnapshotRelay(state: SnapshotRelayState, nowS: number): SnapshotRelay {
  const rtts = state.history.filter((p) => p.rtt != null).map((p) => p.rtt as number);
  return {
    url: state.url,
    firstSeen: state.firstSeen,
    lastSeen: state.lastSeen,
    lastChecked: state.lastChecked,
    nip11: state.nip11,
    nips: state.nips,
    software: state.software,
    version: state.version,
    geohash: state.geohash,
    network: state.network,
    relayType: state.relayType,
    requirements: state.requirements,
    monitorCount: state.monitors.length,
    uptime30d: uptimeFromHistory(state.history, nowS),
    medianRttMs: median(rtts),
    spark: sparkFromHistory(state.history),
    changes: state.changes.slice(0, 10),
  };
}
