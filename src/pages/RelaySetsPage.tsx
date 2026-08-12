/**
 * RelaySetsPage — Browse and manage NIP-51 relay sets
 *
 * Users can create, share, and discover curated relay collections.
 * Each set is a kind:30002 addressable event with relay URLs.
 */

import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import {
  Plus, Search, Users, Globe2, Radio, CheckCircle2,
  XCircle, Loader2, Trash2, Edit, Eye, Copy, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useRelaySets, useMyRelaySets, usePublishRelaySet, useDeleteRelaySet, type RelaySet } from '@/hooks/useRelaySets';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLiveRelayStore } from '@/hooks/useLiveRelayStore';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';
import { timeAgo, shortenUrl } from '@/lib/utils';

// ─── Relay Set Card ───────────────────────────────────────────────────────────

function RelaySetCard({ set, onDelete }: { set: RelaySet; onDelete?: () => void }) {
  const author = useAuthor(set.authorPubkey);
  const name = author.data?.metadata?.name ?? genUserName(set.authorPubkey);
  const pic = author.data?.metadata?.picture;
  const { relays } = useLiveRelayStore();
  const [copied, setCopied] = useState(false);

  const relayRecords = useMemo(() => {
    return set.relays
      .map((url) => relays.find((r) => r.url === url))
      .filter(Boolean);
  }, [set.relays, relays]);

  const onlineCount = relayRecords.filter((r) => r?.isOnline).length;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(set.relays, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Card className="border-border/60 hover:border-primary/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar className="w-6 h-6">
              <AvatarImage src={pic} />
              <AvatarFallback className="text-xs">{name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">{name}</span>
            <span className="text-xs text-muted-foreground/60">{timeAgo(set.updatedAt)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
            {onDelete && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={onDelete}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
        <CardTitle className="text-base">{set.title}</CardTitle>
        {set.description && (
          <p className="text-xs text-muted-foreground">{set.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="secondary" className="text-xs gap-1">
            <Radio className="w-3 h-3" /> {set.relays.length} relays
          </Badge>
          <Badge variant="outline" className="text-xs gap-1 border-emerald-500/30 text-emerald-500">
            <CheckCircle2 className="w-3 h-3" /> {onlineCount} online
          </Badge>
          <Badge variant="outline" className="text-xs gap-1 border-red-500/30 text-red-500">
            <XCircle className="w-3 h-3" /> {relayRecords.length - onlineCount} offline
          </Badge>
        </div>

        <div className="space-y-1 max-h-40 overflow-y-auto">
          {set.relays.slice(0, 8).map((url) => {
            const record = relayRecords.find((r) => r?.url === url);
            return (
              <div key={url} className="flex items-center gap-2 text-xs py-1">
                <div className={`w-2 h-2 rounded-full ${record?.isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="font-mono truncate flex-1">{shortenUrl(url)}</span>
                {record && (
                  <span className="text-muted-foreground">{record.uptimePercent30d.toFixed(0)}%</span>
                )}
              </div>
            );
          })}
          {set.relays.length > 8 && (
            <p className="text-xs text-muted-foreground text-center py-1">
              +{set.relays.length - 8} more relays
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Create Set Dialog ────────────────────────────────────────────────────────

function CreateSetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useCurrentUser();
  const publishSet = usePublishRelaySet();
  const { relays } = useLiveRelayStore();
  const [id, setId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedRelays, setSelectedRelays] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const filteredRelays = useMemo(() => {
    if (!search.trim()) return relays.slice(0, 20);
    const q = search.toLowerCase();
    return relays.filter((r) =>
      r.url.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [relays, search]);

  const toggleRelay = (url: string) => {
    setSelectedRelays((prev) =>
      prev.includes(url) ? prev.filter((u) => u !== url) : [...prev, url]
    );
  };

  const handleSubmit = async () => {
    if (!id.trim() || !title.trim() || selectedRelays.length === 0) return;
    try {
      await publishSet.mutateAsync({
        id: id.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        relays: selectedRelays,
      });
      onOpenChange(false);
      setId('');
      setTitle('');
      setDescription('');
      setSelectedRelays([]);
    } catch {
      // error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Relay Set</DialogTitle>
          <DialogDescription>
            Create a curated collection of relays to share with others.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Set ID (unique)</label>
              <Input
                value={id}
                onChange={(e) => setId(e.target.value)}
                placeholder="my-favorite-relays"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="My Favorite Relays"
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A collection of fast, reliable relays for general use..."
              className="text-sm min-h-[60px]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">
              Select Relays ({selectedRelays.length} selected)
            </label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search relays..."
              className="h-8 text-sm mb-2"
            />
            <div className="max-h-48 overflow-y-auto border border-border/40 rounded-lg p-2 space-y-1">
              {filteredRelays.map((relay) => (
                <button
                  key={relay.url}
                  onClick={() => toggleRelay(relay.url)}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-colors ${
                    selectedRelays.includes(relay.url)
                      ? 'bg-primary/15 border border-primary/30'
                      : 'hover:bg-muted/50 border border-transparent'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${relay.isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="font-mono truncate flex-1">{relay.url}</span>
                  <span className="text-muted-foreground">{relay.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={publishSet.isPending || !id.trim() || !title.trim() || selectedRelays.length === 0}
            className="gap-2"
          >
            {publishSet.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Set
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function RelaySetsPage() {
  useSeoMeta({
    title: 'Relay Sets — 0xRelay-Finder',
    description: 'Browse and create curated Nostr relay collections. Share your favorite relay combinations with the community.',
  });

  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const { data: allSets, isLoading } = useRelaySets(100);
  const { sets: mySets, isLoading: mySetsLoading } = useMyRelaySets();
  const deleteSet = useDeleteRelaySet();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredSets = useMemo(() => {
    if (!search.trim()) return allSets ?? [];
    const q = search.toLowerCase();
    return (allSets ?? []).filter((s) =>
      s.title.toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q) ||
      s.relays.some((r) => r.toLowerCase().includes(q))
    );
  }, [allSets, search]);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 text-sm text-primary font-medium mb-3">
            <Globe2 className="w-3.5 h-3.5" />
            Relay Collections
          </div>
          <h1 className="text-3xl font-black mb-1">Relay Sets</h1>
          <p className="text-muted-foreground text-sm max-w-xl">
            Curated collections of Nostr relays. Create your own set or discover what others recommend.
          </p>
        </div>

        {user && (
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Create Set
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search relay sets..."
          className="pl-9"
        />
      </div>

      {/* My Sets */}
      {user && mySets.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> My Sets
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mySets.map((set) => (
              <RelaySetCard
                key={`${set.authorPubkey}:${set.id}`}
                set={set}
                onDelete={() => deleteSet.mutate({ id: set.id, authorPubkey: set.authorPubkey })}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Sets */}
      <div>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Globe2 className="w-4 h-4" /> All Sets ({filteredSets.length})
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="border-border/60">
                <CardHeader className="pb-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredSets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSets.map((set) => (
              <RelaySetCard key={`${set.authorPubkey}:${set.id}`} set={set} />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Globe2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-bold mb-1">No Relay Sets Found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {search ? 'No sets match your search.' : 'Be the first to create a relay set!'}
              </p>
              {user && !search && (
                <Button onClick={() => setCreateOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" /> Create First Set
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <CreateSetDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
