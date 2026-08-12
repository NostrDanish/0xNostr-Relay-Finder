/**
 * NIP-B7 Blossom Detection & Display
 *
 * Detects Blossom media servers from relay NIP-11 data and kind:10063
 * user server lists. Provides utilities for displaying Blossom-hosted
 * images and checking Blossom support.
 *
 * Blossom servers store files addressable by SHA-256 hash.
 * Clients can fetch kind:10063 to find a user's preferred Blossom servers.
 */

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { KIND_BLOSSOM_SERVERS, APP_RELAY_URLS } from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlossomServer {
  url: string;
  /** Whether this server is currently reachable */
  online?: boolean;
  /** Server name (from NIP-11 if it's also a relay) */
  name?: string;
}

export interface BlossomCapabilities {
  /** Whether the relay supports Blossom (has NIP-94/96 or kind:10063) */
  supported: boolean;
  /** List of Blossom server URLs */
  servers: string[];
  /** Whether the relay itself acts as a Blossom server */
  isBlossomServer: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Check if a URL is a valid Blossom server URL.
 */
export function isBlossomUrl(url: string): boolean {
  return /^https?:\/\/.+/.test(url) && !url.includes(' ');
}

/**
 * Extract SHA-256 hash from a Blossom URL.
 * Blossom URLs typically end with /<64-char-hex>[.ext]
 */
export function extractBlossomHash(url: string): string | null {
  const match = url.match(/\/([a-f0-9]{64})(\.[a-z0-9]+)?$/i);
  return match ? match[1] : null;
}

/**
 * Check if a URL looks like a Blossom-hosted media URL.
 */
export function isBlossomMediaUrl(url: string): boolean {
  return extractBlossomHash(url) !== null;
}

/**
 * Given a Blossom URL, try to find it on alternative servers.
 * Returns a list of candidate URLs to try.
 */
export function getBlossomAlternatives(
  url: string,
  servers: string[],
): string[] {
  const hash = extractBlossomHash(url);
  if (!hash) return [];

  const ext = url.match(/\.([a-z0-9]+)$/i)?.[0] ?? '';

  return servers
    .filter((s) => isBlossomUrl(s))
    .map((s) => `${s.replace(/\/$/, '')}/${hash}${ext}`);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetch the current user's preferred Blossom servers (kind:10063).
 */
export function useBlossomServers() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['blossom-servers', user?.pubkey],
    queryFn: async () => {
      if (!user) return [];

      const relayGroup = nostr.group(APP_RELAY_URLS);
      const events = await relayGroup.query([
        {
          kinds: [KIND_BLOSSOM_SERVERS],
          authors: [user.pubkey],
          limit: 1,
        },
      ]);

      if (events.length === 0) return [];

      return events[0].tags
        .filter(([t]) => t === 'server')
        .map(([, url]) => url)
        .filter(isBlossomUrl);
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 15,
  });
}

/**
 * Detect Blossom capabilities for a relay.
 * Checks NIP-11 for NIP-94/96 support and whether the relay URL
 * itself is a Blossom server.
 */
export function useRelayBlossomCapabilities(relayUrl: string, nip11?: { supported_nips?: number[] }) {
  return useQuery({
    queryKey: ['blossom-capabilities', relayUrl],
    queryFn: async () => {
      const supportedNips = nip11?.supported_nips ?? [];
      const hasNip94 = supportedNips.includes(94);
      const hasNip96 = supportedNips.includes(96);

      // Check if relay URL itself is a Blossom server
      const httpUrl = relayUrl
        .replace(/^wss:\/\//, 'https://')
        .replace(/^ws:\/\//, 'http://');

      let isBlossomServer = false;
      try {
        const resp = await fetch(`${httpUrl}/upload`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });
        // Blossom servers typically have /upload endpoint
        isBlossomServer = resp.ok || resp.status === 405; // 405 = method not allowed but endpoint exists
      } catch {
        // Not a Blossom server
      }

      return {
        supported: hasNip94 || hasNip96 || isBlossomServer,
        servers: isBlossomServer ? [httpUrl] : [],
        isBlossomServer,
      } satisfies BlossomCapabilities;
    },
    staleTime: 1000 * 60 * 30,
  });
}

/**
 * Fetch Blossom server health (check if server is online).
 */
export function useBlossomServerHealth(serverUrl: string) {
  return useQuery({
    queryKey: ['blossom-health', serverUrl],
    queryFn: async () => {
      try {
        const start = Date.now();
        const resp = await fetch(`${serverUrl.replace(/\/$/, '')}/upload`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(8000),
        });
        const latency = Date.now() - start;

        return {
          url: serverUrl,
          online: resp.ok || resp.status === 405,
          latencyMs: latency,
          status: resp.status,
        };
      } catch (err) {
        return {
          url: serverUrl,
          online: false,
          latencyMs: undefined,
          status: 0,
          error: String(err),
        };
      }
    },
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}
