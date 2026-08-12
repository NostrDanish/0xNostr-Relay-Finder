/**
 * NIP-22 Comment System for Relay Reviews
 *
 * Supports kind:1111 comments scoped to relay URLs using I tags.
 * This enables threaded, NIP-73-scoped comments on relays.
 *
 * Comments are always rooted to the relay URL (I tag = relay URL, K tag = "web")
 * and can be nested as replies to other comments.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { KIND_COMMENT, APP_RELAY_URLS } from '@/lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RelayComment {
  id: string;
  authorPubkey: string;
  content: string;
  createdAt: number;
  /** Parent comment ID (if this is a reply) */
  parentId?: string;
  /** Root scope (always the relay URL) */
  rootScope: string;
  /** Thread depth */
  depth: number;
  /** Raw event */
  event: NostrEvent;
}

export interface CommentThread {
  root: RelayComment;
  replies: CommentThread[];
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function parseCommentEvent(event: NostrEvent): RelayComment | null {
  // NIP-22 comments must have K/k tags and I/i tags for root/parent scope
  const KTag = event.tags.find(([t]) => t === 'K')?.[1];
  const kTag = event.tags.find(([t]) => t === 'k')?.[1];
  const ITag = event.tags.find(([t]) => t === 'I')?.[1];
  const iTag = event.tags.find(([t]) => t === 'i')?.[1];
  const eTag = event.tags.find(([t]) => t === 'e')?.[1];

  if (!KTag || !ITag) return null;

  // For relay comments, the root scope is always the relay URL
  const rootScope = ITag;

  // Check if this is a reply (has lowercase e tag pointing to parent comment)
  const isReply = !!eTag && eTag !== ITag;

  return {
    id: event.id,
    authorPubkey: event.pubkey,
    content: event.content,
    createdAt: event.created_at * 1000,
    parentId: isReply ? eTag : undefined,
    rootScope,
    depth: isReply ? 1 : 0,
    event,
  };
}

function buildThread(comments: RelayComment[]): CommentThread[] {
  const byId = new Map<string, RelayComment>();
  const roots: CommentThread[] = [];

  // Index all comments
  for (const comment of comments) {
    byId.set(comment.id, comment);
  }

  // Build threads
  for (const comment of comments) {
    if (!comment.parentId) {
      // Top-level comment
      roots.push({ root: comment, replies: [] });
    } else {
      // Find parent and add as reply
      const parent = byId.get(comment.parentId);
      if (parent) {
        // Find the thread containing the parent
        const findThread = (threads: CommentThread[]): CommentThread | null => {
          for (const thread of threads) {
            if (thread.root.id === parent.id) return thread;
            const found = findThread(thread.replies);
            if (found) return found;
          }
          return null;
        };

        const parentThread = findThread(roots);
        if (parentThread) {
          comment.depth = parent.depth + 1;
          parentThread.replies.push({ root: comment, replies: [] });
        }
      }
    }
  }

  // Sort by newest first
  roots.sort((a, b) => b.root.createdAt - a.root.createdAt);
  return roots;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetch all comments for a relay.
 */
export function useRelayComments(relayUrl: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['relay-comments', relayUrl],
    queryFn: async () => {
      const relayGroup = nostr.group(APP_RELAY_URLS);
      const events = await relayGroup.query([
        {
          kinds: [KIND_COMMENT],
          '#I': [relayUrl],
          limit: 200,
        },
      ]);

      const comments = events
        .map(parseCommentEvent)
        .filter((c): c is RelayComment => c !== null);

      return buildThread(comments);
    },
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Fetch comment count for a relay.
 */
export function useRelayCommentCount(relayUrl: string) {
  const { data: threads } = useRelayComments(relayUrl);

  const countComments = (threads: CommentThread[]): number => {
    return threads.reduce((count, thread) => {
      return count + 1 + countComments(thread.replies);
    }, 0);
  };

  return countComments(threads ?? []);
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Post a comment on a relay.
 */
export function usePostComment() {
  const { mutate: createEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      relayUrl,
      content,
      parentCommentId,
    }: {
      relayUrl: string;
      content: string;
      parentCommentId?: string;
    }) => {
      if (!user) throw new Error('Must be logged in to comment');

      const tags: string[][] = [
        ['I', relayUrl],
        ['K', 'web'],
        ['i', relayUrl],
        ['k', 'web'],
      ];

      // If replying to a comment, add parent reference
      if (parentCommentId) {
        tags.push(['e', parentCommentId, '']);
        tags.push(['k', '1111']);
      }

      return new Promise<void>((resolve, reject) => {
        createEvent(
          {
            kind: KIND_COMMENT,
            content,
            tags,
          },
          {
            onSuccess: () => resolve(),
            onError: (err) => reject(err),
          },
        );
      });
    },
    onSuccess: (_, { relayUrl }) => {
      queryClient.invalidateQueries({ queryKey: ['relay-comments', relayUrl] });
    },
  });
}
