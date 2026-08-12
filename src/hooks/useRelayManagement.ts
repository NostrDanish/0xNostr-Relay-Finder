/**
 * NIP-86 Relay Management API
 *
 * Detects and interacts with relays that support the NIP-86 management API.
 * This allows relay operators to perform management tasks directly from
 * the app: ban/unban pubkeys, list moderation events, manage roles, etc.
 *
 * The API uses HTTP POST with JSON-RPC-like payloads to the relay's
 * websocket URL (same URI, but with application/nostr+json+rpc content type).
 */

import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { KIND_RELAY_SUBMISSION, APP_RELAY_URLS } from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RelayManagementCapabilities {
  /** Whether the relay supports NIP-86 */
  supported: boolean;
  /** List of supported methods */
  methods: string[];
  /** Whether auth is required for management API */
  authRequired: boolean;
  /** Detected via NIP-11 or direct probe */
  detectedVia: 'nip11' | 'probe' | 'unknown';
}

export interface ModerationEvent {
  id: string;
  reason?: string;
}

export interface BannedPubkey {
  pubkey: string;
  reason?: string;
}

// ─── NIP-98 Auth helper ───────────────────────────────────────────────────────

/**
 * Create a NIP-98 auth event for HTTP requests.
 * This is used to authenticate management API calls.
 */
export async function createNip98AuthEvent(
  signer: { signEvent: (event: { kind: number; tags: string[][]; content: string; created_at: number }) => Promise<{ id: string; pubkey: string; sig: string }> },
  url: string,
  method: string,
): Promise<string> {
  const event = await signer.signEvent({
    kind: 27235,
    tags: [
      ['u', url],
      ['method', method],
    ],
    content: '',
    created_at: Math.floor(Date.now() / 1000),
  });

  // Base64 encode the event for the Authorization header
  const encoded = btoa(JSON.stringify(event));
  return `Nostr ${encoded}`;
}

// ─── Management API client ────────────────────────────────────────────────────

export class RelayManagementClient {
  private relayUrl: string;
  private authToken: string | null = null;

  constructor(relayUrl: string, authToken?: string) {
    // Convert wss:// to https:// for HTTP requests
    this.relayUrl = relayUrl
      .replace(/^wss:\/\//, 'https://')
      .replace(/^ws:\/\//, 'http://');
    this.authToken = authToken ?? null;
  }

  private async call<T>(method: string, params: unknown[] = []): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/nostr+json+rpc',
    };

    if (this.authToken) {
      headers['Authorization'] = this.authToken;
    }

    const response = await fetch(this.relayUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ method, params }),
    });

    if (response.status === 401) {
      throw new Error('Authentication required for NIP-86 management API');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as { result?: T; error?: string };

    if (data.error) {
      throw new Error(data.error);
    }

    return data.result as T;
  }

  /** List all supported methods */
  async supportedMethods(): Promise<string[]> {
    return this.call<string[]>('supportedmethods');
  }

  /** List events needing moderation */
  async listEventsNeedingModeration(): Promise<ModerationEvent[]> {
    return this.call<ModerationEvent[]>('listeventsneedingmoderation');
  }

  /** List banned pubkeys */
  async listBannedPubkeys(): Promise<BannedPubkey[]> {
    return this.call<BannedPubkey[]>('listbannedpubkeys');
  }

  /** Ban a pubkey */
  async banPubkey(pubkey: string, reason?: string): Promise<boolean> {
    return this.call<boolean>('banpubkey', [pubkey, reason]);
  }

  /** Unban a pubkey */
  async unbanPubkey(pubkey: string, reason?: string): Promise<boolean> {
    return this.call<boolean>('unbanpubkey', [pubkey, reason]);
  }

  /** List allowed pubkeys */
  async listAllowedPubkeys(): Promise<BannedPubkey[]> {
    return this.call<BannedPubkey[]>('listallowedpubkeys');
  }

  /** Allow a pubkey */
  async allowPubkey(pubkey: string, reason?: string): Promise<boolean> {
    return this.call<boolean>('allowpubkey', [pubkey, reason]);
  }

  /** Ban an event */
  async banEvent(eventId: string, reason?: string): Promise<boolean> {
    return this.call<boolean>('banevent', [eventId, reason]);
  }

  /** Allow an event */
  async allowEvent(eventId: string, reason?: string): Promise<boolean> {
    return this.call<boolean>('allowevent', [eventId, reason]);
  }

  /** Change relay name */
  async changeRelayName(name: string): Promise<boolean> {
    return this.call<boolean>('changerelayname', [name]);
  }

  /** Change relay description */
  async changeRelayDescription(description: string): Promise<boolean> {
    return this.call<boolean>('changerelaydescription', [description]);
  }

  /** Change relay icon */
  async changeRelayIcon(iconUrl: string): Promise<boolean> {
    return this.call<boolean>('changerelayicon', [iconUrl]);
  }

  /** List allowed kinds */
  async listAllowedKinds(): Promise<number[]> {
    return this.call<number[]>('listallowedkinds');
  }

  /** Allow a kind */
  async allowKind(kind: number): Promise<boolean> {
    return this.call<boolean>('allowkind', [kind]);
  }

  /** Disallow a kind */
  async disallowKind(kind: number): Promise<boolean> {
    return this.call<boolean>('disallowkind', [kind]);
  }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * Detect whether a relay supports NIP-86 management API.
 */
export function useRelayManagementCapabilities(relayUrl: string) {
  return useQuery({
    queryKey: ['nip86-capabilities', relayUrl],
    queryFn: async () => {
      const client = new RelayManagementClient(relayUrl);

      try {
        const methods = await client.supportedMethods();
        return {
          supported: true,
          methods,
          authRequired: false,
          detectedVia: 'probe' as const,
        } satisfies RelayManagementCapabilities;
      } catch (err) {
        if (String(err).includes('401') || String(err).includes('Authentication required')) {
          return {
            supported: true,
            methods: [],
            authRequired: true,
            detectedVia: 'probe' as const,
          } satisfies RelayManagementCapabilities;
        }

        return {
          supported: false,
          methods: [],
          authRequired: false,
          detectedVia: 'unknown' as const,
        } satisfies RelayManagementCapabilities;
      }
    },
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });
}

/**
 * Create an authenticated management client for a relay.
 */
export function useRelayManagementClient(relayUrl: string) {
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['nip86-client', relayUrl, user?.pubkey],
    queryFn: async () => {
      if (!user) return null;

      try {
        const authToken = await createNip98AuthEvent(
          user.signer,
          relayUrl.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://'),
          'POST',
        );

        return new RelayManagementClient(relayUrl, authToken);
      } catch {
        return null;
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
}
