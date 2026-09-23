import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import type { RelayRecord, UseCaseTag, NIP11Info } from '@/types/relay';
import {
  APP_RELAY_URLS,
  KIND_RELAY_SUBMISSION,
  RELAY_SUBMISSION_D_PREFIX,
  OWNER_PUBKEY_HEX,
  corsProxy,
} from '@/lib/constants';
import { normalizeRelayUrl, relayHttpUrl } from '@/lib/relayUrl';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { buildApprovalMap, approvalStatusFor } from '@/hooks/useSubmissions';
import { RELAY_SEED_DATA } from '@/data/relays';

interface SubmissionPayload {
  url?: string;
  name?: string;
  description?: string;
  nip11?: NIP11Info;
  useCases?: UseCaseTag[];
  isFree?: boolean;
  paidPriceUsd?: number;
  submittedAt?: number;
  submitterPubkey?: string;
  version?: string;
}

// ─── Relay probing ─────────────────────────────────────────────────────────

/**
 * Probes a relay to determine if it's online.
 * Strategy:
 *   1. Try NIP-11 HTTP fetch first (fast, avoids WebSocket CORS issues)
 *   2. Fall back to WebSocket open probe with timeout
 * Returns true if the relay responds, false otherwise.
 */
async function probeRelay(url: string, timeoutMs = 12000): Promise<boolean> {
  // Stage 1: NIP-11 HTTP fetch — direct first, CORS proxy as fallback
  // (mirrors useNIP11Batch.fetchSingleNIP11's direct-then-proxy pattern)
  const httpUrl = relayHttpUrl(url);
  if (httpUrl) {
    try {
      const resp = await fetch(httpUrl, {
        method: 'GET',
        headers: { Accept: 'application/nostr+json' },
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) return true;
    } catch {
      // Direct fetch failed (CORS/network) — try the proxy
    }
    try {
      const resp = await fetch(corsProxy(httpUrl), {
        method: 'GET',
        headers: { Accept: 'application/nostr+json' },
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) return true;
    } catch {
      // NIP-11 fetch failed — try WebSocket
    }
  }

  // Stage 2: WebSocket open probe
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (result: boolean) => {
      if (settled) return;
      settled = true;
      try { ws.close(); } catch { /* noop */ }
      resolve(result);
    };

    const timer = setTimeout(() => settle(false), timeoutMs);
    let ws: WebSocket;

    try {
      ws = new WebSocket(url);
      ws.onopen = () => { clearTimeout(timer); settle(true); };
      ws.onerror = () => { clearTimeout(timer); settle(false); };
      ws.onclose = () => { clearTimeout(timer); if (!settled) settle(false); };
    } catch {
      clearTimeout(timer);
      settle(false);
    }
  });
}

/**
 * Probe relays concurrently in batches.
 * Returns a Map<url, isOnline>.
 */
async function probeRelaysBatch(urls: string[], batchSize = 10): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        const online = await probeRelay(url);
        return { url, online };
      })
    );
    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.set(r.value.url, r.value.online);
      } else {
        // If the promise itself rejected (shouldn't happen but guard)
        results.set(batch[batchResults.indexOf(r)], false);
      }
    }
  }
  return results;
}

// ─── Event parsing ─────────────────────────────────────────────────────────

/**
 * Parses a kind:30078 relay submission event into a RelayRecord.
 * Returns null if the event is malformed or missing required fields.
 * `isOnline` is set to false initially; caller should override after probing.
 */
function parseSubmissionEvent(event: NostrEvent): RelayRecord | null {
  try {
    const payload = JSON.parse(event.content) as SubmissionPayload;

    // Validate + normalize the URL (rejects garbage like `wssfoo`)
    const url = payload.url ? normalizeRelayUrl(payload.url) : null;
    if (!url) return null;

    const dTag = event.tags.find(([t]) => t === 'd')?.[1] ?? '';
    if (!dTag.startsWith(RELAY_SUBMISSION_D_PREFIX)) return null;

    const status = event.tags.find(([t]) => t === 'status')?.[1] ?? 'pending';
    // Only show approved submissions (pending = awaiting mod review)
    if (status === 'rejected') return null;

    const useCaseTags = event.tags
      .filter(([t, v]) => t === 't' && v !== 'relay-submission' && v !== '0xnostrrelays' && v !== 'free' && v !== 'paid')
      .map(([, v]) => {
        // Convert kebab-case back to Title Case
        return v.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }) as UseCaseTag[];

    // Compute isFree once and branch on it so isFree/priceTiers never disagree
    const isFree = payload.isFree ?? true;

    const record: RelayRecord = {
      id: event.id,
      url,
      name: payload.name ?? url.replace(/^wss?:\/\//, ''),
      description: payload.description ?? '',
      nip11: payload.nip11 ?? {},
      useCases: payload.useCases ?? useCaseTags,
      priceTiers: isFree
        ? [{ name: 'Free', price: 0, currency: 'USD', features: ['Open access'] }]
        : [
            { name: 'Paid', price: payload.paidPriceUsd ?? 5, currency: 'USD', billing: 'monthly', features: ['Full access'] },
          ],
      isFree,
      isOnline: false, // will be overridden by probing
      uptimePercent30d: 0,
      uptimeSpark: [],
      lastChecked: event.created_at * 1000,
      addedAt: (payload.submittedAt ?? event.created_at) * 1000,
      featured: false,
      trustScore: status === 'approved' ? 50 : 30,
      importSources: [
        { source: 'manual', importedAt: event.created_at * 1000, fieldsUpdated: ['url', 'name', 'description', 'useCases'] }
      ],
    };

    return record;
  } catch {
    return null;
  }
}

/**
 * Subscribes to the 0xPrivacy relay group for kind:30078 relay submission events
 * and merges them with the seed data to form the full directory.
 *
 * Also fetches approval events and uses them to override the status of
 * submissions (so rejected relays are properly hidden).
 *
 * After parsing, newly submitted relays are probed for liveness using
 * NIP-11 HTTP fetch and WebSocket open probes.
 *
 * Deduplication: seed data takes precedence for known relays (matched by URL).
 * User-submitted relays are appended.
 */
export function useRelayDirectory() {
  const { nostr } = useNostr();
  // Authorized approvers: owner + admins + mods (role lists verified in useAdminAccess)
  const { adminList, modList, isLoading: rolesLoading } = useAdminAccess();
  const approverKey = [OWNER_PUBKEY_HEX, ...adminList, ...modList].sort().join(',');

  return useQuery({
    queryKey: ['relay-directory', ...APP_RELAY_URLS, approverKey],
    queryFn: async () => {
      try {
        // Query both app relays for submission AND approval events
        const relayGroup = nostr.group(APP_RELAY_URLS);
        const approvers = new Set([OWNER_PUBKEY_HEX, ...adminList, ...modList]);

        const [submissionEvents, approvalEvents] = await Promise.all([
          relayGroup.query([
            {
              kinds: [KIND_RELAY_SUBMISSION],
              '#t': ['relay-submission'],
              limit: 200,
            },
          ]),
          relayGroup.query([
            {
              kinds: [KIND_RELAY_SUBMISSION],
              authors: [...approvers],
              '#t': ['relay-approval'],
              limit: 200,
            },
          ]),
        ]);

        // Build approval map keyed by normalized URL / address / event id.
        // Only verified events from authorized approvers are considered
        // (shared helper from useSubmissions).
        const approvalStatusMap = buildApprovalMap(approvalEvents, approvers);

        // Deduplicate: keep only the latest event per d-tag
        const latestByDTag = new Map<string, NostrEvent>();
        for (const ev of submissionEvents) {
          const dTag = ev.tags.find(([t]) => t === 'd')?.[1];
          if (!dTag) continue;
          const existing = latestByDTag.get(dTag);
          if (!existing || ev.created_at > existing.created_at) {
            latestByDTag.set(dTag, ev);
          }
        }

        // Parse valid events into relay records, applying approval overrides
        const submittedRecords: RelayRecord[] = [];
        // Normalize seed URLs too so dedup matches canonical submission URLs
        const seenUrls = new Set(
          RELAY_SEED_DATA.map((r) => normalizeRelayUrl(r.url) ?? r.url)
        );

        for (const ev of latestByDTag.values()) {
          const record = parseSubmissionEvent(ev);
          if (!record) continue;

          // Look up the latest approval decision by stable identifiers
          // (URL survives resubmission across authors; address per author)
          const dTag = ev.tags.find(([t]) => t === 'd')?.[1];
          const overrideStatus = approvalStatusFor(approvalStatusMap, {
            url: record.url,
            address: dTag ? `${KIND_RELAY_SUBMISSION}:${ev.pubkey}:${dTag}` : undefined,
            eventId: ev.id,
          });

          // Rejected relays stay hidden even after resubmission
          if (overrideStatus === 'rejected') continue;

          // Skip if already in seed data
          if (seenUrls.has(record.url)) continue;
          seenUrls.add(record.url);

          // Apply approval status override
          if (overrideStatus === 'approved') {
            record.trustScore = 50;
          }

          submittedRecords.push(record);
        }

        // Probe all submitted relays for online status
        if (submittedRecords.length > 0) {
          const urls = submittedRecords.map((r) => r.url);
          const probeResults = await probeRelaysBatch(urls);

          for (const record of submittedRecords) {
            const online = probeResults.get(record.url);
            if (online !== undefined) {
              record.isOnline = online;
              record.lastChecked = Date.now();
            }
          }
        }

        return submittedRecords;
      } catch (err) {
        console.warn('[useRelayDirectory] Could not fetch from app relays:', err);
        return [] as RelayRecord[];
      }
    },
    // Wait for role lists so approval overrides can be authorized
    enabled: !rolesLoading,
    staleTime: 1000 * 60 * 5,      // 5 minutes
    gcTime: 1000 * 60 * 30,        // 30 minutes
    retry: 2,
    retryDelay: 2000,
  });
}
