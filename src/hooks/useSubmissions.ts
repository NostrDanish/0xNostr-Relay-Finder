import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  APP_RELAY_URL,
  OWNER_PUBKEY_HEX,
  KIND_RELAY_SUBMISSION,
  KIND_RELAY_REPORT,
  RELAY_SUBMISSION_D_PREFIX,
  APPROVAL_D_PREFIX,
} from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────
export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface Submission {
  eventId: string;
  url: string;
  name: string;
  description: string;
  status: SubmissionStatus;
  submitterPubkey: string;
  submittedAt: number; // unix ms
  useCases: string[];
  pricing: 'free' | 'paid';
  hasEncryptedNotes: boolean;
  nip11: Record<string, unknown>;
  /** Raw event for full access */
  raw: NostrEvent;
}

export interface Report {
  eventId: string;
  reporterPubkey: string;
  relayUrl: string;
  reason: string;
  detail: string;
  reportedAt: number;
  referencedSubmissionId?: string;
  raw: NostrEvent;
}

// ─── Parse helpers ─────────────────────────────────────────────────────────
function parseSubmission(ev: NostrEvent): Submission | null {
  try {
    const dTag = ev.tags.find(([t]) => t === 'd')?.[1] ?? '';
    if (!dTag.startsWith(RELAY_SUBMISSION_D_PREFIX)) return null;

    const payload = JSON.parse(ev.content) as {
      url?: string; name?: string; description?: string;
      useCases?: string[]; isFree?: boolean; nip11?: Record<string, unknown>;
    };
    if (!payload.url) return null;

    const status = (ev.tags.find(([t]) => t === 'status')?.[1] ?? 'pending') as SubmissionStatus;
    const pricing = (ev.tags.find(([t]) => t === 'pricing')?.[1] ?? (payload.isFree ? 'free' : 'paid')) as 'free' | 'paid';
    const hasEncryptedNotes = ev.tags.some(([t]) => t === 'encrypted_notes');

    return {
      eventId: ev.id,
      url: payload.url,
      name: payload.name ?? payload.url,
      description: payload.description ?? '',
      status,
      submitterPubkey: ev.pubkey,
      submittedAt: ev.created_at * 1000,
      useCases: payload.useCases ?? [],
      pricing,
      hasEncryptedNotes,
      nip11: payload.nip11 ?? {},
      raw: ev,
    };
  } catch {
    return null;
  }
}

function parseReport(ev: NostrEvent): Report | null {
  try {
    const relayUrl = ev.tags.find(([t]) => t === 'r')?.[1] ?? '';
    const reason = ev.tags.find(([t]) => t === 'reason')?.[1] ?? 'unspecified';
    const referencedSubmissionId = ev.tags.find(([t]) => t === 'e')?.[1];

    return {
      eventId: ev.id,
      reporterPubkey: ev.pubkey,
      relayUrl,
      reason,
      detail: ev.content,
      reportedAt: ev.created_at * 1000,
      referencedSubmissionId,
      raw: ev,
    };
  } catch {
    return null;
  }
}

// ─── Hooks ─────────────────────────────────────────────────────────────────

/** Query ALL submissions from the app relay */
export function useSubmissions(filter?: { status?: SubmissionStatus; limit?: number }) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['submissions', APP_RELAY_URL, filter?.status],
    queryFn: async () => {
      const relay = nostr.relay(APP_RELAY_URL);
      const events = await relay.query([
        {
          kinds: [KIND_RELAY_SUBMISSION],
          '#t': ['relay-submission'],
          limit: filter?.limit ?? 200,
        },
      ]);

      // Deduplicate by URL (latest wins)
      const latestByUrl = new Map<string, NostrEvent>();
      for (const ev of events) {
        const url = ev.tags.find(([t]) => t === 'r')?.[1];
        if (!url) continue;
        const existing = latestByUrl.get(url);
        if (!existing || ev.created_at > existing.created_at) {
          latestByUrl.set(url, ev);
        }
      }

      const parsed = Array.from(latestByUrl.values())
        .map(parseSubmission)
        .filter((s): s is Submission => s !== null);

      if (filter?.status) return parsed.filter((s) => s.status === filter.status);
      return parsed;
    },
    staleTime: 1000 * 30,
    retry: 2,
  });
}

/** Query all reports */
export function useReports() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['relay-reports', APP_RELAY_URL],
    queryFn: async () => {
      const relay = nostr.relay(APP_RELAY_URL);
      const events = await relay.query([
        {
          kinds: [KIND_RELAY_REPORT],
          '#t': ['relay-issue'],
          limit: 100,
        },
      ]);
      return events.map(parseReport).filter((r): r is Report => r !== null)
        .sort((a, b) => b.reportedAt - a.reportedAt);
    },
    staleTime: 1000 * 60,
    retry: 2,
  });
}

/** Get stats summary */
export function useDashboardStats() {
  const allSubs = useSubmissions();
  const reports = useReports();

  const stats = {
    total: allSubs.data?.length ?? 0,
    pending: allSubs.data?.filter((s) => s.status === 'pending').length ?? 0,
    approved: allSubs.data?.filter((s) => s.status === 'approved').length ?? 0,
    rejected: allSubs.data?.filter((s) => s.status === 'rejected').length ?? 0,
    reports: reports.data?.length ?? 0,
    withNip11: allSubs.data?.filter((s) => Object.keys(s.nip11).length > 0).length ?? 0,
  };

  return {
    stats,
    isLoading: allSubs.isLoading || reports.isLoading,
  };
}

// ─── Moderation actions ────────────────────────────────────────────────────

/**
 * Publishes a kind:30078 approval/rejection event.
 * d-tag = "0xapproval:<submission_event_id>"
 * This updates the submission status on the relay.
 *
 * We re-publish the full submission event with updated status tag.
 * Addressable events replace by (kind, pubkey, d-tag) so the moderator
 * replaces the submission's status in the relay's index.
 *
 * Note: To keep the original submitter's event intact, we publish a
 * SEPARATE approval decision event signed by the mod:
 *   kind:30078, d="0xapproval:<submission_event_id>", status=approved|rejected
 * The directory hook merges these to determine final status.
 */
export function useApproveSubmission() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ submission, decision, reason }: {
      submission: Submission;
      decision: 'approved' | 'rejected';
      reason?: string;
    }) => {
      if (!user) throw new Error('Not logged in');

      const dTag = `${APPROVAL_D_PREFIX}${submission.eventId}`;

      const event = await user.signer.signEvent({
        kind: KIND_RELAY_SUBMISSION,
        content: JSON.stringify({
          url: submission.url,
          decision,
          reason: reason ?? '',
          reviewedAt: Math.floor(Date.now() / 1000),
          reviewerPubkey: user.pubkey,
        }),
        tags: [
          ['d', dTag],
          ['e', submission.eventId],
          ['r', submission.url],
          ['status', decision],
          ['t', 'relay-approval'],
          ['alt', `Relay submission ${decision}: ${submission.url}`],
          ...(reason ? [['reason', reason]] : []),
        ],
        created_at: Math.floor(Date.now() / 1000),
      });

      const relay = nostr.relay(APP_RELAY_URL);
      await relay.event(event);
      return event;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['submissions'] });
      qc.invalidateQueries({ queryKey: ['relay-directory'] });
    },
  });
}

/**
 * Publishes/updates the admin or mod role list.
 * kind:30078, d="0xadmin-roles" or "0xmod-roles"
 * content = JSON.stringify([hex_pubkey, ...])
 * Only the owner (OWNER_PUBKEY_HEX) should call this.
 */
export function useUpdateRoleList() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ dTag, pubkeys }: { dTag: string; pubkeys: string[] }) => {
      if (!user) throw new Error('Not logged in');
      if (user.pubkey !== OWNER_PUBKEY_HEX) throw new Error('Only the owner can update role lists');

      const event = await user.signer.signEvent({
        kind: KIND_RELAY_SUBMISSION,
        content: JSON.stringify(pubkeys),
        tags: [
          ['d', dTag],
          ['t', '0xnostrrelays-roles'],
          ['alt', `0xNostrRelays role list: ${dTag}`],
        ],
        created_at: Math.floor(Date.now() / 1000),
      });

      const relay = nostr.relay(APP_RELAY_URL);
      await relay.event(event);
      return event;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-roles'] });
    },
  });
}

/**
 * Remove a relay from the approved directory by publishing a rejected decision.
 */
export function useRemoveRelay() {
  const approveHook = useApproveSubmission();

  return {
    ...approveHook,
    mutateAsync: ({ submission, reason }: { submission: Submission; reason?: string }) =>
      approveHook.mutateAsync({ submission, decision: 'rejected', reason }),
  };
}
