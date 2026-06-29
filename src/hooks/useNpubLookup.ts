/**
 * npub Relay Lookup Hook
 *
 * Queries kind:10002 (NIP-65) relay list for any npub/nprofile.
 * Shows the user's configured read/write relays with live status overlay.
 */

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { nip19 } from 'nostr-tools';
import { KIND_RELAY_LIST } from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserRelay {
  url: string;
  read: boolean;
  write: boolean;
}

export interface NpubLookupResult {
  pubkey: string;
  relays: UserRelay[];
  updatedAt: number; // unix seconds from the event
}

/**
 * Resolve an npub, nprofile, or hex pubkey to a hex string.
 * Returns null on failure.
 * For NIP-05 identifiers (e.g. user@domain.com), use resolveToHexAsync instead.
 */
export function resolveToHex(input: string): string | null {
  const trimmed = input.trim().replace(/^nostr:/, '');

  // Already hex?
  if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  try {
    const decoded = nip19.decode(trimmed);
    if (decoded.type === 'npub') return decoded.data;
    if (decoded.type === 'nprofile') return decoded.data.pubkey;
  } catch {
    // Not a valid NIP-19
  }

  return null;
}

/**
 * Check if input looks like a NIP-05 identifier (user@domain.com or _@domain.com)
 */
export function isNIP05(input: string): boolean {
  return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input.trim());
}

/**
 * Resolve a NIP-05 identifier to a hex pubkey via the well-known endpoint.
 * Returns null if resolution fails.
 */
export async function resolveNIP05(identifier: string): Promise<string | null> {
  const trimmed = identifier.trim();
  const parts = trimmed.split('@');
  if (parts.length !== 2) return null;

  const [name, domain] = parts;

  try {
    const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(name)}`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) return null;

    const data = await resp.json() as { names?: Record<string, string> };
    const pubkey = data?.names?.[name] ?? data?.names?.[name.toLowerCase()];
    if (pubkey && /^[0-9a-f]{64}$/i.test(pubkey)) {
      return pubkey.toLowerCase();
    }
  } catch {
    // NIP-05 resolution failed
  }

  return null;
}

/**
 * Hook to look up a user's NIP-65 relay list by pubkey hex.
 *
 * Queries kind:10002 from connected relays and parses the relay list
 * with read/write flags.
 */
export function useNpubLookup(pubkeyHex: string | null) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['npub-lookup', pubkeyHex],
    queryFn: async (): Promise<NpubLookupResult | null> => {
      if (!pubkeyHex) return null;

      const events = await nostr.query([
        {
          kinds: [KIND_RELAY_LIST],
          authors: [pubkeyHex],
          limit: 1,
        },
      ]);

      if (!events.length) return null;

      const event = events[0];

      // Parse r tags: ["r", "wss://...", optional "read" | "write"]
      const relays: UserRelay[] = [];
      for (const tag of event.tags) {
        if (tag[0] !== 'r') continue;
        const url = tag[1];
        if (!url) continue;

        const flag = tag[2];
        if (flag === 'read') {
          relays.push({ url, read: true, write: false });
        } else if (flag === 'write') {
          relays.push({ url, read: false, write: true });
        } else {
          // No flag = both read and write
          relays.push({ url, read: true, write: true });
        }
      }

      return {
        pubkey: pubkeyHex,
        relays,
        updatedAt: event.created_at,
      };
    },
    enabled: !!pubkeyHex,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: 2,
  });
}
