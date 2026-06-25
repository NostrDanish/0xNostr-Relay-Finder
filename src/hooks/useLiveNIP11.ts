/**
 * Live NIP-11 Fetching Hook
 *
 * Fetches a relay's NIP-11 info document over HTTPS and runs it through
 * the auto-tagger to automatically assign use-case tags.
 */

import { useQuery } from '@tanstack/react-query';
import type { NIP11Info } from '@/types/relay';
import { corsProxy } from '@/lib/constants';

/**
 * Fetches the NIP-11 info document for a relay URL.
 * Uses CORS proxy if direct fetch fails.
 */
async function fetchNIP11(wsUrl: string): Promise<NIP11Info | null> {
  const httpUrl = wsUrl.replace(/^wss?:\/\//, 'https://');

  try {
    // Try direct fetch first
    const res = await fetch(httpUrl, {
      headers: { Accept: 'application/nostr+json' },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      return (await res.json()) as NIP11Info;
    }
  } catch {
    // Direct fetch failed, try CORS proxy
  }

  try {
    const proxyUrl = corsProxy(httpUrl);
    const res = await fetch(proxyUrl, {
      headers: { Accept: 'application/nostr+json' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      return (await res.json()) as NIP11Info;
    }
  } catch {
    // Both failed
  }

  return null;
}

/**
 * Hook to fetch live NIP-11 data for a relay.
 * Caches for 5 minutes to avoid spamming relay.
 */
export function useLiveNIP11(relayUrl: string, enabled = true) {
  return useQuery({
    queryKey: ['live-nip11', relayUrl],
    queryFn: () => fetchNIP11(relayUrl),
    enabled: enabled && !!relayUrl,
    staleTime: 1000 * 60 * 5,  // 5 minutes
    gcTime: 1000 * 60 * 30,    // 30 minutes
    retry: 1,
  });
}
