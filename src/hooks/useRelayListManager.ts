/**
 * Relay List Manager Hook
 *
 * Provides NIP-07 one-click "Add to my relay list" and "Remove from my
 * relay list" functionality. Reads the user's current kind:10002 event,
 * modifies it, and publishes the updated version.
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { KIND_RELAY_LIST } from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MyRelay {
  url: string;
  read: boolean;
  write: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMyRelayList() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Fetch current relay list
  const { data: myRelays, isLoading } = useQuery({
    queryKey: ['my-relay-list', user?.pubkey],
    queryFn: async (): Promise<MyRelay[]> => {
      if (!user) return [];

      const events = await nostr.query([
        {
          kinds: [KIND_RELAY_LIST],
          authors: [user.pubkey],
          limit: 1,
        },
      ]);

      if (!events.length) return [];

      const relays: MyRelay[] = [];
      for (const tag of events[0].tags) {
        if (tag[0] !== 'r') continue;
        const url = tag[1];
        if (!url) continue;
        const flag = tag[2];
        relays.push({
          url,
          read: !flag || flag === 'read',
          write: !flag || flag === 'write',
        });
      }
      return relays;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  // Publish updated relay list
  const { mutateAsync: publishRelayList, isPending: publishing } = useMutation({
    mutationFn: async (relays: MyRelay[]) => {
      if (!user) throw new Error('Not logged in');

      const tags: string[][] = relays.map((r) => {
        if (r.read && r.write) return ['r', r.url];
        if (r.read) return ['r', r.url, 'read'];
        return ['r', r.url, 'write'];
      });

      const event = await user.signer.signEvent({
        kind: KIND_RELAY_LIST,
        content: '',
        tags,
        created_at: Math.floor(Date.now() / 1000),
      });

      await nostr.event(event, { signal: AbortSignal.timeout(5000) });
      return event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-relay-list', user?.pubkey] });
    },
  });

  // Check if a relay is in the user's list
  const hasRelay = useCallback((url: string): boolean => {
    return myRelays?.some((r) => r.url === url) ?? false;
  }, [myRelays]);

  // Get the relay's config
  const getRelayConfig = useCallback((url: string): MyRelay | undefined => {
    return myRelays?.find((r) => r.url === url);
  }, [myRelays]);

  // Add a relay to the list
  const addRelay = useCallback(async (url: string, read = true, write = true) => {
    if (!myRelays) return;
    if (hasRelay(url)) return; // Already in list

    const updated = [...myRelays, { url, read, write }];
    await publishRelayList(updated);
  }, [myRelays, hasRelay, publishRelayList]);

  // Remove a relay from the list
  const removeRelay = useCallback(async (url: string) => {
    if (!myRelays) return;
    const updated = myRelays.filter((r) => r.url !== url);
    await publishRelayList(updated);
  }, [myRelays, publishRelayList]);

  // Toggle read/write for a relay
  const toggleRelayFlag = useCallback(async (url: string, flag: 'read' | 'write') => {
    if (!myRelays) return;
    const updated = myRelays.map((r) => {
      if (r.url !== url) return r;
      return { ...r, [flag]: !r[flag] };
    });
    await publishRelayList(updated);
  }, [myRelays, publishRelayList]);

  return {
    myRelays: myRelays ?? [],
    isLoading,
    publishing,
    hasRelay,
    getRelayConfig,
    addRelay,
    removeRelay,
    toggleRelayFlag,
  };
}
