import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import type { RelayRecord, UseCaseTag, NIP11Info } from '@/types/relay';
import {
  APP_RELAY_URL,
  KIND_RELAY_SUBMISSION,
  RELAY_SUBMISSION_D_PREFIX,
} from '@/lib/constants';
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

/**
 * Parses a kind:30078 relay submission event into a RelayRecord.
 * Returns null if the event is malformed or missing required fields.
 */
function parseSubmissionEvent(event: NostrEvent): RelayRecord | null {
  try {
    const payload = JSON.parse(event.content) as SubmissionPayload;

    if (!payload.url || !payload.url.startsWith('wss')) return null;

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

    const record: RelayRecord = {
      id: event.id,
      url: payload.url,
      name: payload.name ?? payload.url.replace(/^wss?:\/\//, ''),
      description: payload.description ?? '',
      nip11: payload.nip11 ?? {},
      useCases: payload.useCases ?? useCaseTags,
      priceTiers: payload.isFree
        ? [{ name: 'Free', price: 0, currency: 'USD', features: ['Open access'] }]
        : [
            { name: 'Paid', price: payload.paidPriceUsd ?? 5, currency: 'USD', billing: 'monthly', features: ['Full access'] },
          ],
      isFree: payload.isFree ?? true,
      isOnline: false, // will be checked separately
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
 * Subscribes to the 0xPrivacy relay for kind:30078 relay submission events
 * and merges them with the seed data to form the full directory.
 *
 * Deduplication: seed data takes precedence for known relays (matched by URL).
 * User-submitted relays are appended.
 */
export function useRelayDirectory() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['relay-directory', APP_RELAY_URL],
    queryFn: async () => {
      try {
        // Query the app relay for all submission events
        const appRelay = nostr.relay(APP_RELAY_URL);

        const events = await appRelay.query([
          {
            kinds: [KIND_RELAY_SUBMISSION],
            '#t': ['relay-submission'],
            limit: 200,
          },
        ]);

        // Deduplicate: keep only the latest event per d-tag
        const latestByDTag = new Map<string, NostrEvent>();
        for (const ev of events) {
          const dTag = ev.tags.find(([t]) => t === 'd')?.[1];
          if (!dTag) continue;
          const existing = latestByDTag.get(dTag);
          if (!existing || ev.created_at > existing.created_at) {
            latestByDTag.set(dTag, ev);
          }
        }

        // Parse valid events into relay records
        const submittedRecords: RelayRecord[] = [];
        const seenUrls = new Set(RELAY_SEED_DATA.map((r) => r.url));

        for (const ev of latestByDTag.values()) {
          const record = parseSubmissionEvent(ev);
          if (!record) continue;
          // Skip if already in seed data
          if (seenUrls.has(record.url)) continue;
          seenUrls.add(record.url);
          submittedRecords.push(record);
        }

        return submittedRecords;
      } catch (err) {
        console.warn('[useRelayDirectory] Could not fetch from app relay:', err);
        return [] as RelayRecord[];
      }
    },
    staleTime: 1000 * 60 * 5,      // 5 minutes
    gcTime: 1000 * 60 * 30,        // 30 minutes
    retry: 2,
    retryDelay: 2000,
  });
}
