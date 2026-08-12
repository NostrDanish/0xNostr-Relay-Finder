/**
 * NIP-22 Comment Section for Relay Detail Page
 *
 * Displays threaded comments for a relay, with support for posting
 * new comments and replies. Comments are scoped to the relay URL.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare, Reply, Send, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRelayComments, usePostComment, type RelayComment, type CommentThread } from '@/hooks/useRelayComments';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { genUserName } from '@/lib/genUserName';
import { timeAgo } from '@/lib/utils';

// ─── Comment Item ─────────────────────────────────────────────────────────────

function CommentItem({ comment, depth = 0 }: { comment: RelayComment; depth?: number }) {
  const author = useAuthor(comment.authorPubkey);
  const name = author.data?.metadata?.name ?? genUserName(comment.authorPubkey);
  const pic = author.data?.metadata?.picture;
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const postComment = usePostComment();
  const { user } = useCurrentUser();

  const handleReply = async () => {
    if (!replyText.trim()) return;
    try {
      await postComment.mutateAsync({
        relayUrl: comment.rootScope,
        content: replyText,
        parentCommentId: comment.id,
      });
      setReplyText('');
      setReplying(false);
    } catch {
      // error handled by mutation
    }
  };

  return (
    <div className={depth > 0 ? 'ml-6 border-l-2 border-border/40 pl-4' : ''}>
      <div className="flex items-start gap-3 py-3">
        <Avatar className="w-7 h-7 flex-shrink-0">
          <AvatarImage src={pic} />
          <AvatarFallback className="text-xs">{name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/npub${comment.authorPubkey.slice(0, 8)}`}
              className="text-sm font-semibold hover:text-primary transition-colors"
            >
              {name}
            </Link>
            <span className="text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</span>
          </div>
          <p className="text-sm mt-1 whitespace-pre-wrap break-words">{comment.content}</p>

          {user && depth < 3 && (
            <button
              onClick={() => setReplying(!replying)}
              className="text-xs text-muted-foreground hover:text-primary mt-1.5 flex items-center gap-1"
            >
              <Reply className="w-3 h-3" /> Reply
            </button>
          )}

          {replying && (
            <div className="mt-2 flex gap-2">
              <Textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="text-sm min-h-[60px]"
              />
              <Button
                size="sm"
                onClick={handleReply}
                disabled={postComment.isPending || !replyText.trim()}
                className="gap-1.5"
              >
                {postComment.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Thread Component ─────────────────────────────────────────────────────────

function CommentThreadView({ thread }: { thread: CommentThread }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <div className="flex items-center gap-2">
        {thread.replies.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
        <div className="flex-1">
          <CommentItem comment={thread.root} depth={0} />
        </div>
      </div>
      {expanded && thread.replies.map((reply) => (
        <CommentThreadView key={reply.root.id} thread={reply} />
      ))}
    </div>
  );
}

// ─── Main Comment Section ─────────────────────────────────────────────────────

export function RelayCommentSection({ relayUrl }: { relayUrl: string }) {
  const { data: threads, isLoading } = useRelayComments(relayUrl);
  const postComment = usePostComment();
  const { user } = useCurrentUser();
  const [newComment, setNewComment] = useState('');

  const handlePost = async () => {
    if (!newComment.trim()) return;
    try {
      await postComment.mutateAsync({ relayUrl, content: newComment });
      setNewComment('');
    } catch {
      // error handled by mutation
    }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          Comments
          {threads && (
            <Badge variant="secondary" className="text-xs ml-auto">
              {threads.length} thread{threads.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Post new comment */}
        {user ? (
          <div className="flex gap-2 mb-4">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Share your experience with this relay..."
              className="text-sm min-h-[60px]"
            />
            <Button
              onClick={handlePost}
              disabled={postComment.isPending || !newComment.trim()}
              size="sm"
              className="gap-1.5 self-end"
            >
              {postComment.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Post
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mb-4 text-center py-2 bg-muted/30 rounded-lg">
            Log in to post comments
          </p>
        )}

        {/* Comments list */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="w-7 h-7 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : threads && threads.length > 0 ? (
          <div className="space-y-1 divide-y divide-border/30">
            {threads.map((thread) => (
              <CommentThreadView key={thread.root.id} thread={thread} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            No comments yet. Be the first to share your experience!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
