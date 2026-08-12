/**
 * NIP-43 Relay Access Metadata and Requests
 *
 * Supports relay membership lists, role definitions, and join/leave requests.
 * This enables invite-only and membership-based relay features.
 *
 * Event kinds:
 * - kind:33534 — Role definition (published by relay's self pubkey)
 * - kind:13534 — Membership list (published by relay's self pubkey)
 * - kind:8000 — Add member notification
 * - kind:8001 — Remove member notification
 * - kind:28934 — Join request (ephemeral, sent by user)
 * - kind:28935 — Invite request (ephemeral, sent by relay)
 * - kind:28936 — Leave request (sent by user)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { APP_RELAY_URLS } from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RelayRole {
  id: string;
  label?: string;
  description?: string;
  color?: number;
  order?: number;
}

export interface RelayMember {
  pubkey: string;
  roles: string[];
}

export interface RelayMembership {
  relayUrl: string;
  members: RelayMember[];
  roles: RelayRole[];
  isOpen: boolean;
  requiresInvite: boolean;
  memberCount: number;
}

export interface JoinRequestResult {
  success: boolean;
  message: string;
  inviteCode?: string;
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

function parseRoleEvent(event: NostrEvent): RelayRole | null {
  const dTag = event.tags.find(([t]) => t === 'd')?.[1];
  if (!dTag) return null;

  const label = event.tags.find(([t]) => t === 'label')?.[1];
  const description = event.tags.find(([t]) => t === 'description')?.[1];
  const color = event.tags.find(([t]) => t === 'color')?.[1];
  const order = event.tags.find(([t]) => t === 'order')?.[1];

  return {
    id: dTag,
    label,
    description,
    color: color ? parseInt(color) : undefined,
    order: order ? parseInt(order) : undefined,
  };
}

function parseMembershipEvent(event: NostrEvent): RelayMember[] {
  return event.tags
    .filter(([t]) => t === 'member')
    .map(([, pubkey, ...roles]) => ({
      pubkey,
      roles: roles.filter((r) => r !== undefined),
    }));
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetch relay membership data (roles + members) for a relay.
 * Queries kind:33534 and kind:13534 from the relay's self pubkey.
 */
export function useRelayMembership(relayUrl: string, relaySelfPubkey?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['relay-membership', relayUrl, relaySelfPubkey],
    queryFn: async () => {
      if (!relaySelfPubkey) {
        return {
          relayUrl,
          members: [],
          roles: [],
          isOpen: true,
          requiresInvite: false,
          memberCount: 0,
        } satisfies RelayMembership;
      }

      const relayGroup = nostr.group(APP_RELAY_URLS);

      // Query roles (kind:33534) and membership list (kind:13534)
      const [roleEvents, memberEvents] = await Promise.all([
        relayGroup.query([
          {
            kinds: [33534],
            authors: [relaySelfPubkey],
            limit: 50,
          },
        ]),
        relayGroup.query([
          {
            kinds: [13534],
            authors: [relaySelfPubkey],
            limit: 1,
          },
        ]),
      ]);

      const roles = roleEvents
        .map(parseRoleEvent)
        .filter((r): r is RelayRole => r !== null)
        .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

      const members = memberEvents.length > 0
        ? parseMembershipEvent(memberEvents[0])
        : [];

      return {
        relayUrl,
        members,
        roles,
        isOpen: members.length === 0,
        requiresInvite: members.length > 0,
        memberCount: members.length,
      } satisfies RelayMembership;
    },
    enabled: !!relaySelfPubkey,
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * Check if the current user is a member of a relay.
 */
export function useIsRelayMember(relayUrl: string, relaySelfPubkey?: string) {
  const { user } = useCurrentUser();
  const { data: membership } = useRelayMembership(relayUrl, relaySelfPubkey);

  if (!user || !membership) return false;

  return membership.members.some((m) => m.pubkey === user.pubkey);
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Send a join request to a relay (kind:28934).
 * Requires an invite code (claim) if the relay is invite-only.
 */
export function useJoinRelay() {
  const { mutate: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      relayUrl,
      inviteCode,
    }: {
      relayUrl: string;
      inviteCode: string;
    }): Promise<JoinRequestResult> => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Join request timed out'));
        }, 10000);

        createEvent(
          {
            kind: 28934,
            content: '',
            tags: [
              ['claim', inviteCode],
              ['-'],
            ],
          },
          {
            onSuccess: (event) => {
              clearTimeout(timeout);
              // Note: The relay will respond with an OK message via websocket
              // We can't capture that here, so we optimistically return success
              queryClient.invalidateQueries({ queryKey: ['relay-membership', relayUrl] });
              resolve({
                success: true,
                message: 'Join request sent. Check relay for confirmation.',
              });
            },
            onError: (err) => {
              clearTimeout(timeout);
              reject(err);
            },
          },
        );
      });
    },
  });
}

/**
 * Request an invite code from a relay (kind:28935).
 */
export function useRequestInvite() {
  const { nostr } = useNostr();

  return useMutation({
    mutationFn: async ({
      relayUrl,
      relaySelfPubkey,
    }: {
      relayUrl: string;
      relaySelfPubkey: string;
    }): Promise<string> => {
      const relayGroup = nostr.group(APP_RELAY_URLS);

      // Request kind:28935 from the relay's self pubkey
      const events = await relayGroup.query([
        {
          kinds: [28935],
          authors: [relaySelfPubkey],
          limit: 1,
        },
      ]);

      if (events.length === 0) {
        throw new Error('No invite available from this relay');
      }

      const claimTag = events[0].tags.find(([t]) => t === 'claim');
      if (!claimTag) {
        throw new Error('Invalid invite response from relay');
      }

      return claimTag[1];
    },
  });
}

/**
 * Send a leave request to a relay (kind:28936).
 */
export function useLeaveRelay() {
  const { mutate: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ relayUrl }: { relayUrl: string }) => {
      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: 28936,
            content: '',
            tags: [['-']],
          },
          {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: ['relay-membership', relayUrl] });
              resolve();
            },
            onError: (err) => reject(err),
          },
        );
      });
    },
  });
}
