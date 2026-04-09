import { useState, useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import type { NIP66Data } from '@/types/relay';

// NIP-66 kind numbers
const KIND_RELAY_DISCOVERY = 30166; // Relay Discovery / Health events
const KIND_MONITOR_ANNOUNCEMENT = 10166; // Monitor Announcements

// Known nostr.watch-style monitor pubkeys
const TRUSTED_MONITOR_PUBKEYS = [
  'cf45a6ba1363ad7ed213a078e710d24f2b7a9be1929acabb228084d29b3e08f8',
  'a8e76c3ace7829f9ee44cf9293309e21a1824bf1e57631d00685a1ed0b0bd8a2',
  'febbaba219357c6c64adfa2e01789f274aa60e90c289938bfc80dd91facb3ea4',
];

interface NIP66EventContent {
  network?: string;
  software?: string;
  version?: string;
  read?: boolean;
  write?: boolean;
  blossom?: boolean;
}

interface NIP66Tags {
  r?: string; // relay URL
  R?: string; // relay URL (alt)
  n?: string; // network
  N?: string; // NIP numbers
  rtt?: string; // round-trip time
  up?: string; // uptime percentage
  ts?: string; // timestamp
  c?: string; // capabilities
  T?: string; // status
  d?: string; // d-tag for addressable
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
      // Query kind:30166 events for this relay (d-tag = relay url)
      const events = await nostr.query([
        {
          kinds: [KIND_RELAY_DISCOVERY],
          '#d': [relayUrl],
          authors: TRUSTED_MONITOR_PUBKEYS,
          limit: 5,
        },
        {
          kinds: [KIND_MONITOR_ANNOUNCEMENT],
          '#d': [relayUrl],
          authors: TRUSTED_MONITOR_PUBKEYS,
          limit: 5,
        },
      ]);

      if (!events.length) {
        setResult({ status: 'not_found', data: null, monitorCount: 0 });
        return;
      }

      // Sort by newest first
      const sorted = [...events].sort((a, b) => b.created_at - a.created_at);
      const latest = sorted[0];
      const tags = parseTagsToObject(latest.tags);

      let content: NIP66EventContent = {};
      try {
        content = JSON.parse(latest.content) as NIP66EventContent;
      } catch {
        // non-JSON content is fine
      }

      // Parse RTT from tag
      const rttMs = tags.rtt ? parseInt(tags.rtt) : undefined;

      // Parse uptime from tag
      // const uptimeVal = tags.up ? parseFloat(tags.up) : undefined;

      // Parse capabilities
      const capsTag = latest.tags.find(t => t[0] === 'c');
      const capStr = capsTag ? capsTag.slice(1).join(',') : '';

      const capabilities = {
        read: capStr.includes('read') || content.read === true,
        write: capStr.includes('write') || content.write === true,
        relay: true,
        blossom: capStr.includes('blossom') || content.blossom === true,
        hasNip11: latest.tags.some(t => t[0] === 'N' && t[1] === '11'),
      };

      // Status tag
      const statusTag = latest.tags.find(t => t[0] === 'T' || t[0] === 'status');
      const liveStatusRaw = statusTag?.[1];
      let liveStatus: NIP66Data['liveStatus'] = 'online';
      if (liveStatusRaw === 'offline' || liveStatusRaw === '0') liveStatus = 'offline';
      else if (liveStatusRaw === 'degraded') liveStatus = 'degraded';

      const nip66Data: NIP66Data = {
        enriched: true,
        lastMonitorEvent: latest.created_at * 1000,
        liveStatus,
        monitorLatencyMs: rttMs,
        monitorPubkey: latest.pubkey,
        capabilities,
        conflictsWithNip11: false,
      };

      const uniqueMonitors = new Set(events.map(e => e.pubkey)).size;

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
  frequency?: number; // seconds between checks
  endpoint?: string;
}

export function parseMonitorAnnouncement(event: { pubkey: string; tags: string[][]; content: string }): MonitorInfo {
  const monitor: MonitorInfo = { pubkey: event.pubkey };

  for (const [key, ...vals] of event.tags) {
    if (key === 'name') monitor.name = vals[0];
    if (key === 'about' || key === 'description') monitor.description = vals[0];
    if (key === 'frequency') monitor.frequency = parseInt(vals[0]);
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
