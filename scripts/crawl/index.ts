/**
 * 0xRelayFinder crawler — the GitHub Actions "auto-tick".
 *
 * Runs on a schedule (see scripts/crawl.github-workflow.yml — move it to
 * .github/workflows/crawl.yml to enable), pulls NIP-66 observations from
 * the ENTIRE monitor network (kind:30166 on the meta-relays), directly
 * probes relays that monitors have lost sight of, tracks per-relay
 * history, and commits a refreshed snapshot:
 *
 *   src/lib/snapshot/generated.json    — full crawler state (history per relay)
 *   src/lib/snapshot/generated.ts      — trimmed typed mirror bundled by the app
 *   src/lib/snapshot/stats-history.json — network-wide time series
 *   src/lib/snapshot/crawl-report.json — per-run report
 *
 * With RELAYMON_NSEC configured it also publishes our own kind:30166
 * observations back to the meta-relays (NIP-66) — making 0xRelayFinder a
 * first-class monitor on the network.
 *
 * Usage:
 *   npm run crawl                    crawl + write snapshot
 *   npm run crawl -- --dry-run       crawl, print summary, write nothing
 *   npm run crawl -- --publish       also publish kind:30166 (needs RELAYMON_NSEC)
 *
 * One failing source never fails the run; failures land in crawl-report.json.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  parseNIP66Event,
  parseMonitorAnnouncement,
  type NIP66Observation,
} from '../../src/lib/nip66';
import {
  KIND_RELAY_DISCOVERY,
  KIND_MONITOR_ANNOUNCEMENT,
  NIP66_META_RELAYS,
} from '../../src/lib/constants';
import {
  median,
  toSnapshotRelay,
  type BundledSnapshot,
  type CrawlReport,
  type GraveyardEntry,
  type SnapshotChange,
  type SnapshotNip11,
  type SnapshotRelayState,
  type SnapshotState,
  type StatsPoint,
} from '../../src/lib/snapshot/types';
import { queryRelays, probeRelay, fetchNip11, trimNip11, mapWithConcurrency, type ProbeResult } from './net';
import { publishObservations } from './publish';

/* ------------------------------------------------------------ constants */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SNAPSHOT_DIR = path.join(ROOT, 'src/lib/snapshot');
const GENERATED_JSON = path.join(SNAPSHOT_DIR, 'generated.json');
const GENERATED_TS = path.join(SNAPSHOT_DIR, 'generated.ts');
const STATS_JSON = path.join(SNAPSHOT_DIR, 'stats-history.json');
const REPORT_JSON = path.join(SNAPSHOT_DIR, 'crawl-report.json');

/** How far back we query kind:30166 events. */
const DISCOVERY_WINDOW_S = 3 * 86_400;
/** A monitor observation older than this doesn't count as "online now". */
const FRESH_WINDOW_S = 24 * 3_600;
/** Relays not seen online for this long move to the graveyard. */
const GRAVEYARD_AFTER_S = 14 * 86_400;
/** Relays absent from state longer than this are dropped entirely. */
const RETAIN_STATE_S = 30 * 86_400;
/** Max observation points kept per relay (~30 days at a 3h tick). */
const MAX_HISTORY_POINTS = 240;
/** Max capability-change records kept per relay. */
const MAX_CHANGES = 20;
/** Max graveyard entries kept. */
const MAX_GRAVEYARD = 500;
/** Max stats points kept (~4 months at a 3h tick). */
const MAX_STATS_POINTS = 1_000;
/** Direct-probe caps keep the run under a few minutes. */
const MAX_PROBES = 400;
const MAX_NIP11_FETCHES = 400;
const MAX_PUBLISH = 150;

/* ----------------------------------------------------------------- CLI */

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const wantPublish = args.includes('--publish');
const NSEC = (process.env.RELAYMON_NSEC ?? '').trim();

/* ------------------------------------------------------- state loading */

async function loadJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

/* ------------------------------------------------------- consensus */

interface RelayConsensus {
  url: string;
  online: boolean;
  /** Median open RTT across monitors that saw it online */
  rttMs: number | null;
  /** Latest observation timestamp across all monitors */
  checkedAt: number;
  /** Latest time any monitor saw it online */
  seenOnlineAt: number | null;
  /** Monitor pubkeys that have ever reported (this window) */
  monitors: string[];
  /** Newest parsed observation carrying a NIP-11 doc */
  nip11?: SnapshotNip11;
  /** Union of supported NIPs across latest per-monitor observations */
  nips: number[];
  software?: string;
  geohash?: string;
  network?: string;
  relayType?: string;
  requirements: { auth: boolean; payment: boolean; pow: boolean; writes: boolean | null };
}

function consensusFor(
  url: string,
  observations: NIP66Observation[],
  nowS: number,
): RelayConsensus {
  // Latest observation per monitor
  const latestByMonitor = new Map<string, NIP66Observation>();
  for (const obs of observations) {
    const existing = latestByMonitor.get(obs.monitorPubkey);
    if (!existing || obs.checkedAt > existing.checkedAt) {
      latestByMonitor.set(obs.monitorPubkey, obs);
    }
  }
  const latest = [...latestByMonitor.values()].sort((a, b) => b.checkedAt - a.checkedAt);

  const fresh = latest.filter((o) => nowS - o.checkedAt <= FRESH_WINDOW_S);
  const onlineObs = fresh.filter((o) => o.checks.open !== false && o.rttOpen != null);
  const rttMs = median(onlineObs.map((o) => o.rttOpen as number));

  const withNip11 = latest.find((o) => o.nip11);
  const nips = new Set<number>();
  const addNips = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const n of list) if (typeof n === 'number' && Number.isFinite(n)) nips.add(n);
  };
  for (const o of latest) {
    addNips(o.supportedNips);
    addNips(o.nip11?.supported_nips);
  }
  const cleanNips = [...nips].sort((a, b) => a - b);

  // Requirements: majority of latest observations wins (defensive default off)
  const tally = (pick: (o: NIP66Observation) => boolean) =>
    latest.filter(pick).length > latest.length / 2;
  const writesValues = latest.map((o) => o.requirements.writes).filter((w): w is boolean => w != null);

  const checkedAt = latest[0]?.checkedAt ?? 0;
  const seenOnline = latest.find((o) => o.checks.open !== false && o.rttOpen != null);

  return {
    url,
    online: onlineObs.length > 0,
    rttMs,
    checkedAt,
    seenOnlineAt: seenOnline?.checkedAt ?? null,
    monitors: [...latestByMonitor.keys()],
    nip11: withNip11?.nip11 ? trimNip11(withNip11.nip11 as unknown as Record<string, unknown>) : undefined,
    nips: cleanNips,
    software: latest.find((o) => o.software)?.software ?? withNip11?.nip11?.software,
    geohash: latest.find((o) => o.geohash)?.geohash,
    network: latest.find((o) => o.network)?.network,
    relayType: latest.find((o) => o.relayType)?.relayType,
    requirements: {
      auth: tally((o) => o.requirements.auth),
      payment: tally((o) => o.requirements.payment),
      pow: tally((o) => o.requirements.pow),
      writes: writesValues.length
        ? writesValues.filter(Boolean).length > writesValues.length / 2
        : null,
    },
  };
}

/* --------------------------------------------------------- change diff */

function diffChanges(
  prev: SnapshotRelayState | undefined,
  next: { nips: number[]; software?: string },
  nowS: number,
): SnapshotChange[] {
  const changes = [...(prev?.changes ?? [])];
  if (prev) {
    const prevNips = new Set(prev.nips);
    const nextNips = new Set(next.nips);
    const added = next.nips.filter((n) => !prevNips.has(n));
    const removed = prev.nips.filter((n) => !nextNips.has(n));
    if (added.length || removed.length) {
      changes.unshift({ t: nowS, kind: 'nips', added, removed });
    }
    if (next.software && prev.software && next.software !== prev.software) {
      changes.unshift({ t: nowS, kind: 'software', detail: `${prev.software} → ${next.software}` });
    }
  }
  return changes.slice(0, MAX_CHANGES);
}

/* ------------------------------------------------------------- codegen */

function codegen(bundle: BundledSnapshot, report: CrawlReport): string {
  // Keep the browser bundle lean: descriptions capped, no raw history.
  for (const relay of bundle.relays) {
    if (relay.nip11?.description) relay.nip11.description = relay.nip11.description.slice(0, 300);
    if (relay.nip11?.icon) relay.nip11.icon = relay.nip11.icon.slice(0, 300);
  }
  return `// GENERATED — do not edit. Written by \`npm run crawl\` (scripts/crawl).
// This file is the browser-safe mirror of generated.json / stats-history.json
// / crawl-report.json (JSON imports are intentionally avoided; the crawler
// rewrites this file on every scheduled run).
import type { BundledSnapshot, CrawlReport } from './types';

export const GENERATED_SNAPSHOT: BundledSnapshot = ${JSON.stringify(bundle, null, 2)};

export const CRAWL_REPORT: CrawlReport | null = ${JSON.stringify(report, null, 2)};
`;
}

/* ---------------------------------------------------------------- main */

async function main(): Promise<void> {
  const runStart = Date.now();
  const nowS = Math.floor(Date.now() / 1000);

  const previous = await loadJson<SnapshotState>(GENERATED_JSON, {
    generatedAt: 0,
    relays: [],
    graveyard: [],
  });
  // Re-sanitize data written by older crawler versions (wild NIP-11 docs
  // can carry nulls / wrong types that break the typed generated mirror).
  for (const r of previous.relays) {
    if (r.nip11) r.nip11 = trimNip11(r.nip11 as unknown as Record<string, unknown>);
  }
  previous.graveyard = previous.graveyard.map((g) => ({
    ...g,
    name: typeof g.name === 'string' ? g.name : undefined,
    software: typeof g.software === 'string' ? g.software : undefined,
  }));
  const prevByUrl = new Map(previous.relays.map((r) => [r.url, r]));

  const report: CrawlReport = {
    ranAt: nowS,
    durationMs: 0,
    sources: [],
    totals: {
      relaysActive: 0,
      relaysOnline: 0,
      relaysNew: 0,
      relaysGraveyard: 0,
      monitorsSeen: 0,
      probedDirectly: 0,
      nip11Fetched: 0,
      published: 0,
    },
  };

  /* ── 1. Pull NIP-66 observations from the meta-relays ────────────────── */
  const stepStart = Date.now();
  console.log(`[nip66] querying ${NIP66_META_RELAYS.length} meta-relays (kind:${KIND_RELAY_DISCOVERY}, ${DISCOVERY_WINDOW_S / 86_400}d window)...`);
  const discovery = await queryRelays(
    NIP66_META_RELAYS,
    { kinds: [KIND_RELAY_DISCOVERY], since: nowS - DISCOVERY_WINDOW_S, limit: 20000 },
    25_000,
  );
  const observations: NIP66Observation[] = [];
  const monitorSet = new Set<string>();
  for (const event of discovery.events) {
    const parsed = parseNIP66Event(event);
    if (!parsed) continue;
    observations.push(parsed);
    monitorSet.add(parsed.monitorPubkey);
  }
  const metaErrors = discovery.perRelay.filter((r) => r.error).map((r) => `${r.relay}: ${r.error}`);
  report.sources.push({
    id: 'nip66-meta-relays',
    status: discovery.events.length ? 'ok' : 'error',
    items: observations.length,
    errors: metaErrors,
    durationMs: Date.now() - stepStart,
  });
  console.log(`[nip66] ${observations.length} observations from ${monitorSet.size} monitors covering ${new Set(observations.map((o) => o.relayUrl)).size} relays`);

  /* ── 2. Monitor announcements (kind:10166) — network health context ──── */
  const annStart = Date.now();
  const announcements = await queryRelays(
    NIP66_META_RELAYS,
    { kinds: [KIND_MONITOR_ANNOUNCEMENT], limit: 500 },
    15_000,
  );
  const monitors = announcements.events
    .map(parseMonitorAnnouncement)
    .filter((a): a is NonNullable<typeof a> => a !== null);
  report.sources.push({
    id: 'monitor-announcements',
    status: 'ok',
    items: monitors.length,
    errors: announcements.perRelay.filter((r) => r.error).map((r) => `${r.relay}: ${r.error}`),
    durationMs: Date.now() - annStart,
  });

  /* ── 3. Consensus per relay ──────────────────────────────────────────── */
  const byRelay = new Map<string, NIP66Observation[]>();
  for (const obs of observations) {
    const list = byRelay.get(obs.relayUrl) ?? [];
    list.push(obs);
    byRelay.set(obs.relayUrl, list);
  }
  const consensus = new Map<string, RelayConsensus>();
  for (const [url, obs] of byRelay) {
    consensus.set(url, consensusFor(url, obs, nowS));
  }

  /* ── 4. Direct probes for relays monitors lost sight of ──────────────── */
  // Candidates: known from a previous snapshot, not freshly confirmed online
  // by any monitor this run. Verifying deaths directly (not just trusting
  // monitor gaps) is what makes our graveyard data trustworthy.
  const probeStart = Date.now();
  const probeCandidates = [...prevByUrl.keys()].filter((url) => {
    const c = consensus.get(url);
    return !c || !c.online;
  });
  const probeList = probeCandidates.slice(0, MAX_PROBES);
  console.log(`[probe] directly probing ${probeList.length} stale relays...`);
  const probes = await mapWithConcurrency(probeList, 30, (url) => probeRelay(url));
  const probeMap = new Map<string, ProbeResult>(probes.map((p) => [p.url, p]));
  report.totals.probedDirectly = probes.length;
  report.sources.push({
    id: 'direct-probes',
    status: 'ok',
    items: probes.filter((p) => p.online).length,
    errors: [],
    durationMs: Date.now() - probeStart,
  });
  console.log(`[probe] ${report.sources[report.sources.length - 1].items}/${probes.length} responded`);

  /* ── 5. NIP-11 HTTP backfill for relays missing a doc ────────────────── */
  const fetchStart = Date.now();
  const needNip11 = [...consensus.values()]
    .filter((c) => !c.nip11 && !probeMap.get(c.url)?.nip11)
    .slice(0, MAX_NIP11_FETCHES)
    .map((c) => c.url);
  console.log(`[nip11] backfilling ${needNip11.length} missing NIP-11 docs...`);
  const nip11Results = await mapWithConcurrency(needNip11, 30, async (url) => ({
    url,
    nip11: await fetchNip11(url),
  }));
  const nip11Map = new Map(nip11Results.filter((r) => r.nip11).map((r) => [r.url, r.nip11]));
  report.totals.nip11Fetched = nip11Map.size;
  report.sources.push({
    id: 'nip11-backfill',
    status: 'ok',
    items: nip11Map.size,
    errors: [],
    durationMs: Date.now() - fetchStart,
  });

  /* ── 6. Merge into persistent state ──────────────────────────────────── */
  const allUrls = new Set<string>([
    ...consensus.keys(),
    ...probes.filter((p) => p.online || prevByUrl.has(p.url)).map((p) => p.url),
  ]);

  const nextRelays: SnapshotRelayState[] = [];
  const graveyard: GraveyardEntry[] = [...previous.graveyard];
  const graveyardUrls = new Set(graveyard.map((g) => g.url));
  let newRelays = 0;
  let onlineCount = 0;

  for (const url of allUrls) {
    const prev = prevByUrl.get(url);
    const c = consensus.get(url);
    const probe = probeMap.get(url);

    const online = c?.online ?? probe?.online ?? false;
    const rttMs = c?.rttMs ?? probe?.rttOpen ?? null;
    const nip11 = probe?.nip11 ?? c?.nip11 ?? nip11Map.get(url) ?? prev?.nip11;
    const safe = (v: unknown): number[] =>
      Array.isArray(v) ? v.filter((n): n is number => typeof n === 'number' && Number.isFinite(n)) : [];
    const nips = [...new Set([
      ...safe(c?.nips),
      ...safe(nip11?.supported_nips),
      ...(!c && !probe ? safe(prev?.nips) : []),
    ])].sort((a, b) => a - b);
    const software = nip11?.software ?? c?.software ?? prev?.software;

    // First-class observation this run?
    const observed = Boolean(c) || Boolean(probe);
    const history = [...(prev?.history ?? [])];
    if (observed) {
      const last = history[history.length - 1];
      // One point per run — guard against back-to-back manual runs
      if (!last || nowS - last.t > 3_600) {
        history.push({ t: nowS, up: online ? 1 : 0, rtt: rttMs });
      } else if (online && last.up === 0) {
        history[history.length - 1] = { t: nowS, up: 1, rtt: rttMs };
      }
    }
    while (history.length > MAX_HISTORY_POINTS) history.shift();

    const lastSeen = online
      ? nowS
      : Math.max(prev?.lastSeen ?? 0, c?.seenOnlineAt ?? 0);

    const state: SnapshotRelayState = {
      url,
      firstSeen: prev?.firstSeen ?? nowS,
      lastSeen,
      lastChecked: observed ? nowS : (prev?.lastChecked ?? nowS),
      history,
      nip11,
      nips,
      software,
      version: nip11?.version ?? prev?.version,
      geohash: c?.geohash ?? prev?.geohash,
      network: c?.network ?? prev?.network,
      relayType: c?.relayType ?? prev?.relayType,
      requirements: c?.requirements ?? prev?.requirements ?? { auth: false, payment: false, pow: false, writes: null },
      monitors: [...new Set([...(c?.monitors ?? []), ...(prev?.monitors ?? [])])],
      changes: diffChanges(prev, { nips, software }, nowS),
    };
    if (!prev) newRelays += 1;
    if (online) onlineCount += 1;

    // Graveyard transition: not seen online for 14 days
    if (nowS - state.lastSeen > GRAVEYARD_AFTER_S && state.history.length > 0) {
      if (!graveyardUrls.has(url)) {
        graveyard.push({
          url,
          name: state.nip11?.name ?? state.software,
          software: state.software,
          firstSeen: state.firstSeen,
          lastSeen: state.lastSeen,
        });
        graveyardUrls.add(url);
      }
      // Drop ancient dead relays from active state entirely
      if (nowS - state.lastSeen > RETAIN_STATE_S) continue;
    }

    nextRelays.push(state);
  }

  // Revived relays leave the graveyard
  const revived = new Set(nextRelays.filter((r) => r.lastSeen > nowS - GRAVEYARD_AFTER_S).map((r) => r.url));
  const nextGraveyard = graveyard
    .filter((g) => !revived.has(g.url))
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, MAX_GRAVEYARD);

  const state: SnapshotState = { generatedAt: nowS, relays: nextRelays, graveyard: nextGraveyard };

  /* ── 7. Network stats time series ────────────────────────────────────── */
  const statsHistory = await loadJson<StatsPoint[]>(STATS_JSON, []);
  const onlineRtts = nextRelays
    .filter((r) => r.lastSeen === nowS)
    .map((r) => r.history[r.history.length - 1]?.rtt)
    .filter((r): r is number => r != null);
  const point: StatsPoint = {
    t: nowS,
    total: nextRelays.length,
    online: onlineCount,
    medianRtt: median(onlineRtts),
    monitors: monitorSet.size,
    newRelays,
  };
  const lastPoint = statsHistory[statsHistory.length - 1];
  if (!lastPoint || nowS - lastPoint.t > 3_600) {
    statsHistory.push(point);
    while (statsHistory.length > MAX_STATS_POINTS) statsHistory.shift();
  } else {
    statsHistory[statsHistory.length - 1] = point;
  }

  report.totals = {
    ...report.totals,
    relaysActive: nextRelays.length,
    relaysOnline: onlineCount,
    relaysNew: newRelays,
    relaysGraveyard: nextGraveyard.length,
    monitorsSeen: monitorSet.size,
  };
  report.durationMs = Date.now() - runStart;

  console.log(
    `\ncrawl complete: ${nextRelays.length} active (${onlineCount} online, ${newRelays} new), ` +
      `${nextGraveyard.length} in graveyard, ${monitorSet.size} monitors, ${(report.durationMs / 1000).toFixed(1)}s`,
  );

  if (dryRun) {
    console.log('dry run — nothing written');
    return;
  }

  /* ── 8. Persist ──────────────────────────────────────────────────────── */
  const bundle: BundledSnapshot = {
    generatedAt: nowS,
    relays: nextRelays.map((r) => toSnapshotRelay(r, nowS)),
    graveyard: nextGraveyard,
    stats: statsHistory,
  };

  await mkdir(SNAPSHOT_DIR, { recursive: true });
  await writeFile(GENERATED_JSON, `${JSON.stringify(state, null, 2)}\n`);
  await writeFile(STATS_JSON, `${JSON.stringify(statsHistory, null, 2)}\n`);
  await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(GENERATED_TS, codegen(bundle, report));
  console.log(`wrote src/lib/snapshot/{generated.json,generated.ts,stats-history.json,crawl-report.json}`);

  /* ── 9. Publish our own kind:30166 observations (optional) ───────────── */
  if (wantPublish || NSEC) {
    if (!NSEC) {
      console.log('publish requested but RELAYMON_NSEC is not set — skipping');
    } else {
      const statesByUrl = new Map(nextRelays.map((r) => [r.url, r]));
      // Publish what WE directly verified, plus consensus-fresh online relays
      const toPublish: ProbeResult[] = [
        ...probes.slice(0, MAX_PUBLISH),
        ...[...consensus.values()]
          .filter((c) => c.online && !probeMap.has(c.url))
          .slice(0, Math.max(0, MAX_PUBLISH - probes.length))
          .map((c) => ({
            url: c.url,
            online: c.online,
            rttOpen: c.rttMs ?? undefined,
            nip11: c.nip11,
          })),
      ];
      const pubReport = await publishObservations(toPublish, statesByUrl, NIP66_META_RELAYS, NSEC, nowS);
      report.totals.published = pubReport.succeeded;
      report.sources.push({
        id: 'nip66-publish',
        status: pubReport.failed === 0 ? 'ok' : 'error',
        items: pubReport.succeeded,
        errors: pubReport.errors.slice(0, 20),
        durationMs: 0,
      });
      // Rewrite report with publish results included
      await writeFile(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
      await writeFile(GENERATED_TS, codegen(bundle, report));
    }
  }
}

main().catch((err) => {
  console.error('crawl failed:', err);
  process.exitCode = 1;
});
