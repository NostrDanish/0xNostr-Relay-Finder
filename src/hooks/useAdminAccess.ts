import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  OWNER_PUBKEY_HEX,
  ADMIN_ROLES_D_TAG,
  MOD_ROLES_D_TAG,
  KIND_RELAY_SUBMISSION,
  APP_RELAY_URL,
  type AppRole,
} from '@/lib/constants';

/**
 * Resolves the current user's role by:
 * 1. Checking if their pubkey === OWNER_PUBKEY_HEX  → 'owner'
 * 2. Querying the admin role list event from the app relay → 'admin'
 * 3. Querying the mod role list event from the app relay   → 'moderator'
 * 4. Otherwise                                             → 'user'
 *
 * Role list events are kind:30078 published by the owner to APP_RELAY_URL.
 * Content = JSON.stringify([hex_pubkey, ...])
 */
export function useAdminAccess() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  const { data: roles, isLoading } = useQuery({
    queryKey: ['admin-roles', APP_RELAY_URL],
    queryFn: async () => {
      const relay = nostr.relay(APP_RELAY_URL);

      // Fetch admin and mod role list events (published by the owner)
      const events = await relay.query([
        {
          kinds: [KIND_RELAY_SUBMISSION],
          authors: [OWNER_PUBKEY_HEX],
          '#d': [ADMIN_ROLES_D_TAG, MOD_ROLES_D_TAG],
          limit: 2,
        },
      ]);

      const adminEvent = events.find(
        (e) => e.tags.find(([t, v]) => t === 'd' && v === ADMIN_ROLES_D_TAG)
      );
      const modEvent = events.find(
        (e) => e.tags.find(([t, v]) => t === 'd' && v === MOD_ROLES_D_TAG)
      );

      let admins: string[] = [];
      let mods: string[] = [];

      try { admins = JSON.parse(adminEvent?.content ?? '[]') as string[]; } catch { /* noop */ }
      try { mods = JSON.parse(modEvent?.content ?? '[]') as string[]; } catch { /* noop */ }

      return { admins, mods };
    },
    staleTime: 1000 * 60 * 5,
    retry: 2,
    retryDelay: 1500,
  });

  const pubkey = user?.pubkey ?? '';

  const role: AppRole = (() => {
    if (pubkey === OWNER_PUBKEY_HEX) return 'owner';
    if (roles?.admins.includes(pubkey)) return 'admin';
    if (roles?.mods.includes(pubkey)) return 'moderator';
    return 'user';
  })();

  return {
    role,
    isOwner: role === 'owner',
    isAdmin: role === 'owner' || role === 'admin',
    isMod: role === 'owner' || role === 'admin' || role === 'moderator',
    canApprove: role !== 'user',
    canManageRoles: role === 'owner' || role === 'admin',
    isLoading,
    adminList: roles?.admins ?? [],
    modList: roles?.mods ?? [],
  };
}
