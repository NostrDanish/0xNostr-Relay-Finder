import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { verifyEvent } from 'nostr-tools';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { normalizeRelayUrl } from '@/lib/relayUrl';
import {
  APP_RELAY_URLS,
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
/**
 * Parses a kind:30078 relay submission event.
 * The canonical relay URL is taken from the `r` tag (validated + normalized)
 * so dedup keys and displayed URLs always agree. Submissions without a valid
 * `r` tag are rejected.
 */
function parseSubmission(ev: NostrEvent): Submission | null {
  try {
    const dTag = ev.tags.find(([t]) => t === 'd')?.[1] ?? '';
    if (!dTag.startsWith(RELAY_SUBMISSION_D_PREFIX)) return null;

    const payload = JSON.parse(ev.content) as {
      url?: string; name?: string; description?: string;
      useCases?: string[]; isFree?: boolean; nip11?: Record<string, unknown>;
    };

    // Canonical URL: r tag (validated + normalized), NOT the free-form content URL
    const rTagUrl = ev.tags.find(([t]) => t === 'r')?.[1];
    const url = rTagUrl ? normalizeRelayUrl(rTagUrl) : null;
    if (!url) return null;

    const status = (ev.tags.find(([t]) => t === 'status')?.[1] ?? 'pending') as SubmissionStatus;
    const pricing = (ev.tags.find(([t]) => t === 'pricing')?.[1] ?? (payload.isFree ? 'free' : 'paid')) as 'free' | 'paid';
    const hasEncryptedNotes = ev.tags.some(([t]) => t === 'encrypted_notes');

    return {
      eventId: ev.id,
      url,
      name: payload.name ?? url,
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
    const rTagUrl = ev.tags.find(([t]) => t === 'r')?.[1];
    const relayUrl = rTagUrl ? normalizeRelayUrl(rTagUrl) : null;
    if (!relayUrl) return null; // reject reports with missing/invalid r tag
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

// ─── Approval status merge ─────────────────────────────────────────────────

export type ApprovalDecision = 'approved' | 'rejected';

export interface ApprovalEntry {
  status: ApprovalDecision;
  createdAt: number;
}

/**
 * The lookup keys an approval event applies to. Because submissions are
 * addressable (kind:30078, d="0xrelay:<url>"), re-submission replaces the
 * event id — so approvals are keyed by:
 *   1. the normalized relay URL (`url:<wss://…>`) — stable across resubmissions,
 *   2. the submission address (`addr:<kind>:<pubkey>:<d>`) — stable per author,
 *   3. the legacy event-id reference (`id:<eventId>`) — for old approvals.
 */
function approvalKeys(ev: NostrEvent): string[] {
  const keys: string[] = [];
  const rTagUrl = ev.tags.find(([t]) => t === 'r')?.[1];
  const normUrl = rTagUrl ? normalizeRelayUrl(rTagUrl) : null;
  if (normUrl) keys.push(`url:${normUrl}`);
  const aTag = ev.tags.find(([t]) => t === 'a')?.[1];
  if (aTag) keys.push(`addr:${aTag}`);
  const eRef = ev.tags.find(([t]) => t === 'e')?.[1];
  if (eRef) keys.push(`id:${eRef}`);
  return keys;
}

/**
 * Builds a map of approval key → latest approval decision.
 *
 * SECURITY: only approval events authored by an authorized pubkey
 * (owner/admin/mod — supplied via `approvers`) AND with a valid id+signature
 * (nostr-tools verifyEvent) are considered. Newest decision per key wins.
 */
export function buildApprovalMap(
  approvalEvents: NostrEvent[],
  approvers: ReadonlySet<string>,
): Map<string, ApprovalEntry> {
  const map = new Map<string, ApprovalEntry>();

  for (const ev of approvalEvents) {
    // Must be authored by owner/admin/mod
    if (!approvers.has(ev.pubkey)) continue;
    // Must have a valid id + signature
    if (!verifyEvent(ev)) continue;

    const dTag = ev.tags.find(([t]) => t === 'd')?.[1];
    if (!dTag?.startsWith(APPROVAL_D_PREFIX)) continue;

    const statusTag = ev.tags.find(([t]) => t === 'status')?.[1];
    if (statusTag !== 'approved' && statusTag !== 'rejected') continue;

    for (const key of approvalKeys(ev)) {
      const existing = map.get(key);
      if (!existing || ev.created_at > existing.createdAt) {
        map.set(key, { status: statusTag, createdAt: ev.created_at });
      }
    }
  }

  return map;
}

/**
 * Looks up the latest approval decision for a submission, trying all of its
 * stable identifiers. Newest decision across all matching keys wins.
 */
export function approvalStatusFor(
  map: Map<string, ApprovalEntry>,
  target: { url?: string | null; address?: string; eventId?: string },
): ApprovalDecision | undefined {
  let best: ApprovalEntry | undefined;

  const candidates: string[] = [];
  const normUrl = target.url ? normalizeRelayUrl(target.url) : null;
  if (normUrl) candidates.push(`url:${normUrl}`);
  if (target.address) candidates.push(`addr:${target.address}`);
  if (target.eventId) candidates.push(`id:${target.eventId}`);

  for (const key of candidates) {
    const entry = map.get(key);
    if (entry && (!best || entry.createdAt > best.createdAt)) {
      best = entry;
    }
  }

  return best?.status;
}

/** Address (`kind:pubkey:d`) of a submission event — stable across resubmissions per author. */
function submissionAddress(ev: NostrEvent): string | undefined {
  const dTag = ev.tags.find(([t]) => t === 'd')?.[1];
  return dTag ? `${KIND_RELAY_SUBMISSION}:${ev.pubkey}:${dTag}` : undefined;
}

// ─── Hooks ─────────────────────────────────────────────────────────────────

/** Query ALL submissions from the app relay group, merging approval decisions */
export function useSubmissions(filter?: { status?: SubmissionStatus; limit?: number }) {
  const { nostr } = useNostr();
  // Authorized approvers: owner + admins + mods (role lists are themselves
  // verified with verifyEvent inside useAdminAccess)
  const { adminList, modList, isLoading: rolesLoading } = useAdminAccess();
  const approverKey = [OWNER_PUBKEY_HEX, ...adminList, ...modList].sort().join(',');

  return useQuery({
    queryKey: ['submissions', ...APP_RELAY_URLS, filter?.status, approverKey],
    queryFn: async () => {
      const relayGroup = nostr.group(APP_RELAY_URLS);
      const approvers = new Set([OWNER_PUBKEY_HEX, ...adminList, ...modList]);

      // Fetch both submissions and approval events in parallel.
      // Approvals are restricted to authorized authors at the relay level too.
      const [submissionEvents, approvalEvents] = await Promise.all([
        relayGroup.query([
          {
            kinds: [KIND_RELAY_SUBMISSION],
            '#t': ['relay-submission'],
            limit: filter?.limit ?? 200,
          },
        ]),
        relayGroup.query([
          {
            kinds: [KIND_RELAY_SUBMISSION],
            authors: [...approvers],
            '#t': ['relay-approval'],
            limit: 200,
          },
        ]),
      ]);

      // Build the approval status override map (verifies authorship + signatures)
      const approvalStatusMap = buildApprovalMap(approvalEvents, approvers);

      // Deduplicate submissions by canonical (normalized) relay URL, latest wins
      const latestByUrl = new Map<string, NostrEvent>();
      for (const ev of submissionEvents) {
        const rTagUrl = ev.tags.find(([t]) => t === 'r')?.[1];
        const url = rTagUrl ? normalizeRelayUrl(rTagUrl) : null;
        if (!url) continue;
        const existing = latestByUrl.get(url);
        if (!existing || ev.created_at > existing.created_at) {
          latestByUrl.set(url, ev);
        }
      }

      const parsed = Array.from(latestByUrl.values())
        .map(parseSubmission)
        .filter((s): s is Submission => s !== null)
        .map((sub) => {
          // Override status with latest approval decision if one exists.
          // Look up by normalized URL first (stable across resubmissions),
          // then address, then legacy event id.
          const overrideStatus = approvalStatusFor(approvalStatusMap, {
            url: sub.url,
            address: submissionAddress(sub.raw),
            eventId: sub.eventId,
          });
          if (overrideStatus) {
            return { ...sub, status: overrideStatus };
          }
          return sub;
        });

      if (filter?.status) return parsed.filter((s) => s.status === filter.status);
      return parsed;
    },
    // Wait until role lists have loaded so approvals can be authorized correctly
    enabled: !rolesLoading,
    staleTime: 1000 * 30,
    retry: 2,
  });
}

/** Query all reports */
export function useReports() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['relay-reports', ...APP_RELAY_URLS],
    queryFn: async () => {
      const relayGroup = nostr.group(APP_RELAY_URLS);
      const events = await relayGroup.query([
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
 *
 * We publish a SEPARATE approval decision event signed by the mod:
 *   kind:30078, d="0xapproval:<submission_event_id>", status=approved|rejected
 *
 * The useSubmissions hook fetches both submissions and approvals,
 * and merges the latest decision into each submission's status.
 *
 * onSuccess performs an optimistic cache update so the dashboard
 * reflects the decision instantly without waiting for a relay round-trip.
 */
export function useApproveSubmission() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { canApprove } = useAdminAccess();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ submission, decision, reason }: {
      submission: Submission;
      decision: 'approved' | 'rejected';
      reason?: string;
    }) => {
      if (!user) throw new Error('Not logged in');
      // Only owner/admin/mod may publish approval decisions
      if (!canApprove) throw new Error('Insufficient permissions: moderator role required');

      const dTag = `${APPROVAL_D_PREFIX}${submission.eventId}`;
      const normUrl = normalizeRelayUrl(submission.url) ?? submission.url;
      const address = submissionAddress(submission.raw);

      const event = await user.signer.signEvent({
        kind: KIND_RELAY_SUBMISSION,
        content: JSON.stringify({
          url: normUrl,
          decision,
          reason: reason ?? '',
          reviewedAt: Math.floor(Date.now() / 1000),
          reviewerPubkey: user.pubkey,
        }),
        tags: [
          ['d', dTag],
          ['e', submission.eventId],
          // Address tag keeps the decision linked across resubmissions by the
          // same author; the r tag (normalized URL) links across authors.
          ...(address ? [['a', address]] : []),
          ['r', normUrl],
          ['status', decision],
          ['t', 'relay-approval'],
          ['alt', `Relay submission ${decision}: ${normUrl}`],
          ...(reason ? [['reason', reason]] : []),
        ],
        created_at: Math.floor(Date.now() / 1000),
      });

      const relayGroup = nostr.group(APP_RELAY_URLS);
      await relayGroup.event(event);
      return { event, submission, decision };
    },
    onSuccess: ({ submission, decision }) => {
      // Optimistic cache update: immediately update the submission status
      // across all matching query caches so the UI reflects the decision instantly.
      // Match by canonical URL so superseded/resubmitted events stay covered.
      qc.setQueriesData<Submission[]>(
        { queryKey: ['submissions'] },
        (old) => {
          if (!old) return old;
          return old.map((s) =>
            s.url === submission.url || s.eventId === submission.eventId
              ? { ...s, status: decision as SubmissionStatus }
              : s
          );
        },
      );

      // Also invalidate to ensure eventual consistency with the relay
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

      const relayGroup = nostr.group(APP_RELAY_URLS);
      await relayGroup.event(event);
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
