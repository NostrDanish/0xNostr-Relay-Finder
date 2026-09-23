import { useState, useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import type { NIP66Data } from '@/types/relay';
import {
  KIND_RELAY_DISCOVERY,
  KIND_MONITOR_ANNOUNCEMENT,
  TRUSTED_MONITOR_PUBKEYS,
} from '@/lib/constants';

interface NIP66Tags {
  r?: string;
  R?: string;
  n?: string;
  N?: string;
  ['rtt-open']?: string;
  ['rtt-read']?: string;
  ['rtt-write']?: string;
  up?: string;
  ts?: string;
  c?: string;
  T?: string;
  d?: string;
}

/** Parse an integer tag value, guarding against NaN/garbage. */
function parseIntTag(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseTagsToObject(tags: string[][]): NIP66Tags {
  const obj: NIP66Tags = {};
  for (const [key, ...vals] of tags) {
    (obj as Record<string, string>)[key] = vals[0] ?? '';
  }
  return obj;
}

export type NIP66FetchStatus = 'idle' | 'fetching' | 'found' | 'not_found' | 'error';

export interface NIP66Result {
  status: NIP66FetchStatus;
  data: NIP66Data | null;
  monitorCount: number;
}

/**
 * Fetches live NIP-66 data for a relay by querying
 * kind:30166 (Relay Discovery) and kind:10166 (Monitor Announcements)
 * from connected relays.
 */
export function useNIP66Fetch() {
  const { nostr } = useNostr();
  const [result, setResult] = useState<NIP66Result>({ status: 'idle', data: null, monitorCount: 0 });

  const fetch66 = useCallback(async (relayUrl: string) => {
    setResult({ status: 'fetching', data: null, monitorCount: 0 });

    try {
      // Query kind:30166 relay discovery events for this relay (d-tag = relay url).
      // Kind:10166 monitor announcements are queried separately WITHOUT a #d
      // filter — a 10166's d-tag is the monitor's own identifier, not a relay URL.
      const [discoveryEvents, announcementEvents] = await Promise.all([
        nostr.query(
          [
            {
              kinds: [KIND_RELAY_DISCOVERY],
              '#d': [relayUrl],
              authors: TRUSTED_MONITOR_PUBKEYS,
              limit: 5,
            },
          ],
          { signal: AbortSignal.timeout(10_000) },
        ),
        nostr.query(
          [
            {
              kinds: [KIND_MONITOR_ANNOUNCEMENT],
              authors: TRUSTED_MONITOR_PUBKEYS,
              limit: 20,
            },
          ],
          { signal: AbortSignal.timeout(10_000) },
        ),
      ]);

      // Only kind:30166 events are relay observations. A 10166 must never be
      // parsed as a relay observation (its tags mean monitor metadata).
      const relayEvents = discoveryEvents.filter((e) => e.kind === KIND_RELAY_DISCOVERY);

      if (!relayEvents.length) {
        const monitorCount = new Set(announcementEvents.map((e) => e.pubkey)).size;
        setResult({ status: 'not_found', data: null, monitorCount });
        return;
      }

      // Sort by newest first and take the latest kind:30166 observation
      const sorted = [...relayEvents].sort((a, b) => b.created_at - a.created_at);
      const latest = sorted[0];
      const tags = parseTagsToObject(latest.tags);

      // Parse RTT from the rtt-open tag (guarded against NaN)
      const rttMs = parseIntTag(tags['rtt-open']);

      // R tags: requirements/capability checks. A `!`-prefixed value means the
      // check FAILED (e.g. ["R", "!open"] = relay failed the open check).
      const rValues = latest.tags.filter((t) => t[0] === 'R').map((t) => t[1]);

      // Capabilities derived from R tags per NIP-66
      const capabilities = {
        read: !(rValues.includes('!open') || rValues.includes('!reads') || rValues.includes('!read')),
        write: !(rValues.includes('!writes') || rValues.includes('!write')),
        relay: true,
        blossom: false,
        hasNip11: latest.tags.some((t) => t[0] === 'N' && t[1] === '11'),
      };

      // The T tag is the relay TYPE (e.g. PublicOutbox), NOT a status flag.
      // Liveness comes from the R tags plus event freshness instead.
      const ageMs = Date.now() - latest.created_at * 1000;
      const isFresh = ageMs <= 6 * 3600 * 1000; // 6h
      let liveStatus: NIP66Data['liveStatus'];
      if (rValues.includes('!open')) {
        liveStatus = 'offline';
      } else if (rValues.includes('open') || rttMs !== undefined) {
        liveStatus = isFresh ? 'online' : 'degraded';
      } else {
        // No open-check info — don't blindly claim online
        liveStatus = isFresh ? 'degraded' : 'offline';
      }

      const nip66Data: NIP66Data = {
        enriched: true,
        lastMonitorEvent: latest.created_at * 1000,
        liveStatus,
        monitorLatencyMs: rttMs,
        monitorPubkey: latest.pubkey,
        capabilities,
        conflictsWithNip11: false,
      };

      // Monitors = distinct pubkeys that published either observations or
      // announcements (10166 events carry the monitor metadata).
      const uniqueMonitors = new Set([
        ...relayEvents.map((e) => e.pubkey),
        ...announcementEvents.map((e) => e.pubkey),
      ]).size;

      setResult({ status: 'found', data: nip66Data, monitorCount: uniqueMonitors });
    } catch (err) {
      console.error('[NIP-66] fetch error:', err);
      setResult({ status: 'error', data: null, monitorCount: 0 });
    }
  }, [nostr]);

  const reset = useCallback(() => {
    setResult({ status: 'idle', data: null, monitorCount: 0 });
  }, []);

  return { result, fetch66, reset };
}

/**
 * Parses NIP-66 monitor announcement events to extract monitor metadata.
 */
export interface MonitorInfo {
  pubkey: string;
  name?: string;
  description?: string;
  frequency?: number;
  endpoint?: string;
}

export function parseMonitorAnnouncement(event: { pubkey: string; tags: string[][]; content: string }): MonitorInfo {
  const monitor: MonitorInfo = { pubkey: event.pubkey };

  for (const [key, ...vals] of event.tags) {
    if (key === 'name') monitor.name = vals[0];
    if (key === 'about' || key === 'description') monitor.description = vals[0];
    if (key === 'frequency') {
      const n = parseInt(vals[0], 10);
      if (Number.isFinite(n)) monitor.frequency = n;
    }
    if (key === 'u' || key === 'url') monitor.endpoint = vals[0];
  }

  try {
    const c = JSON.parse(event.content) as { name?: string; about?: string };
    if (c.name && !monitor.name) monitor.name = c.name;
    if (c.about && !monitor.description) monitor.description = c.about;
  } catch {
    // ignore
  }

  return monitor;
}
