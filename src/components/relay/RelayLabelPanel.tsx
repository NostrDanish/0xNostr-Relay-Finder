/**
 * NIP-32 Label Panel for Relay Detail Page
 *
 * Displays labels from trusted sources and allows users to add labels.
 * Shows trust scores, categories, and moderation labels.
 */

import { useState } from 'react';
import {
  Tag, Shield, Award, Flag, Plus, Loader2, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useRelayLabelStats, usePublishLabel, usePublishTrustScore, LABEL_NAMESPACES } from '@/hooks/useRelayLabels';
import { useRelayTrustScore } from '@/hooks/useTrustedAssertions';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { timeAgo } from '@/lib/utils';

// ─── Label Item ───────────────────────────────────────────────────────────────

function LabelItem({ label }: { label: { namespace: string; label: string; authorPubkey: string; createdAt: number; isTrusted: boolean } }) {
  const author = useAuthor(label.authorPubkey);
  const name = author.data?.metadata?.name ?? genUserName(label.authorPubkey);
  const pic = author.data?.metadata?.picture;

  const nsColors: Record<string, string> = {
    [LABEL_NAMESPACES.TRUST]: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
    [LABEL_NAMESPACES.CATEGORY]: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    [LABEL_NAMESPACES.MODERATION]: 'bg-red-500/10 text-red-500 border-red-500/30',
    [LABEL_NAMESPACES.UGC]: 'bg-muted text-muted-foreground border-border',
  };

  const colorClass = nsColors[label.namespace] ?? nsColors[LABEL_NAMESPACES.UGC];

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg border border-border/30 bg-card/50">
      <div className={`px-2 py-0.5 rounded-full border text-xs font-medium ${colorClass}`}>
        {label.label}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Avatar className="w-4 h-4">
            <AvatarImage src={pic} />
            <AvatarFallback className="text-[8px]">{name.charAt(0)}</AvatarFallback>
          </Avatar>
          <span className="text-xs text-muted-foreground truncate">{name}</span>
        </div>
        <p className="text-[10px] text-muted-foreground/70">{timeAgo(label.createdAt)}</p>
      </div>
      {label.isTrusted && (
        <Badge variant="outline" className="text-[10px] border-yellow-500/30 text-yellow-500">
          Trusted
        </Badge>
      )}
    </div>
  );
}

// ─── Add Label Form ───────────────────────────────────────────────────────────

function AddLabelForm({ relayUrl }: { relayUrl: string }) {
  const { user } = useCurrentUser();
  const { isMod } = useAdminAccess();
  const publishLabel = usePublishLabel();
  const publishTrustScore = usePublishTrustScore();
  const [namespace, setNamespace] = useState(LABEL_NAMESPACES.CATEGORY);
  const [label, setLabel] = useState('');
  const [trustScore, setTrustScore] = useState('');

  const handleSubmit = async () => {
    if (!label.trim()) return;
    try {
      await publishLabel.mutateAsync({ relayUrl, namespace, label: label.trim() });
      setLabel('');
    } catch {
      // error handled by mutation
    }
  };

  const handleTrustScore = async () => {
    const score = parseInt(trustScore);
    if (isNaN(score) || score < 0 || score > 100) return;
    try {
      await publishTrustScore.mutateAsync({ relayUrl, score });
      setTrustScore('');
    } catch {
      // error handled by mutation
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border/30">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <Plus className="w-3 h-3" /> Add Label
      </div>
      <div className="flex gap-2">
        <Select value={namespace} onValueChange={setNamespace}>
          <SelectTrigger className="h-8 text-xs w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={LABEL_NAMESPACES.CATEGORY}>Category</SelectItem>
            <SelectItem value={LABEL_NAMESPACES.UGC}>User Tag</SelectItem>
            {isMod && (
              <SelectItem value={LABEL_NAMESPACES.MODERATION}>Moderation</SelectItem>
            )}
          </SelectContent>
        </Select>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., fast, reliable, dm-friendly"
          className="h-8 text-xs flex-1"
        />
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={publishLabel.isPending || !label.trim()}
          className="h-8 gap-1"
        >
          {publishLabel.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        </Button>
      </div>

      {isMod && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/30">
          <Award className="w-3.5 h-3.5 text-yellow-500" />
          <span className="text-xs font-medium">Set Trust Score (0-100)</span>
          <Input
            value={trustScore}
            onChange={(e) => setTrustScore(e.target.value)}
            placeholder="85"
            className="h-8 text-xs w-20"
            type="number"
            min={0}
            max={100}
          />
          <Button
            size="sm"
            onClick={handleTrustScore}
            disabled={publishTrustScore.isPending || !trustScore}
            className="h-8 gap-1"
            variant="outline"
          >
            {publishTrustScore.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Label Panel ─────────────────────────────────────────────────────────

export function RelayLabelPanel({ relayUrl }: { relayUrl: string }) {
  const { stats, isLoading } = useRelayLabelStats(relayUrl);
  const { data: trustScore } = useRelayTrustScore(relayUrl);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" />
          Labels & Trust
          {trustScore?.score !== undefined && (
            <Badge variant="secondary" className="text-xs ml-auto">
              WoT Score: {trustScore.score}/100
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trust score from NIP-85 */}
        {trustScore?.score !== undefined && (
          <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
            <Award className="w-5 h-5 text-emerald-500" />
            <div className="flex-1">
              <div className="font-bold text-sm">Trusted Assertion Score</div>
              <div className="text-xs text-muted-foreground">
                From {trustScore.providerName ?? 'trusted provider'} via NIP-85
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-500">{trustScore.score}</div>
          </div>
        )}

        {/* Label stats */}
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <>
            {/* Categories */}
            {stats.categories.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Tag className="w-3 h-3" /> Categories
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {stats.categories.map((cat) => (
                    <Badge key={cat} variant="outline" className="text-xs border-blue-500/30 text-blue-500">
                      {cat}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Moderation labels */}
            {stats.moderationLabels.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Moderation
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {stats.moderationLabels.map((label) => (
                    <Badge key={label} variant="outline" className="text-xs border-red-500/30 text-red-500">
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* All labels */}
            {stats.labels.length > 0 ? (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                  <Flag className="w-3 h-3" /> All Labels ({stats.totalLabels})
                </div>
                <div className="space-y-1.5">
                  {stats.labels.slice(0, 10).map((label) => (
                    <LabelItem key={label.event.id} label={label} />
                  ))}
                </div>
                {stats.labels.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    +{stats.labels.length - 10} more labels
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No labels yet. Be the first to label this relay!
              </p>
            )}
          </>
        )}

        {/* Add label form */}
        <AddLabelForm relayUrl={relayUrl} />
      </CardContent>
    </Card>
  );
}
