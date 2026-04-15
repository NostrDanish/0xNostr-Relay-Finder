import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSeoMeta } from '@unhead/react';
import {
  Shield, Radio, CheckCircle2, XCircle, Clock, AlertTriangle,
  Users, Trash2, Plus, RefreshCw, Copy, Check, ExternalLink,
  BarChart3, Inbox, Flag, Crown, UserCog, Search, ChevronRight,
  Eye, Lock, Loader2, LogOut, ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAdminAccess } from '@/hooks/useAdminAccess';
import { useAuthor } from '@/hooks/useAuthor';
import { useLoginActions } from '@/hooks/useLoginActions';
import {
  useSubmissions, useReports, useDashboardStats,
  useApproveSubmission, useUpdateRoleList,
  type Submission, type SubmissionStatus,
} from '@/hooks/useSubmissions';
import { RELAY_SEED_DATA, STATS } from '@/data/relays';
import {
  OWNER_PUBKEY_HEX, ADMIN_ROLES_D_TAG, MOD_ROLES_D_TAG,
  APP_RELAY_URL, APP_NPUB,
} from '@/lib/constants';
import { genUserName } from '@/lib/genUserName';
import { timeAgo, shortenUrl } from '@/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const cfg: Record<string, { cls: string; icon: React.ReactNode }> = {
    owner: { cls: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30', icon: <Crown className="w-2.5 h-2.5" /> },
    admin: { cls: 'bg-violet-500/15 text-violet-500 border-violet-500/30', icon: <Shield className="w-2.5 h-2.5" /> },
    moderator: { cls: 'bg-blue-500/15 text-blue-500 border-blue-500/30', icon: <UserCog className="w-2.5 h-2.5" /> },
    user: { cls: 'bg-muted text-muted-foreground border-border', icon: null },
  };
  const c = cfg[role] ?? cfg.user;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-semibold capitalize ${c.cls}`}>
      {c.icon}{role}
    </span>
  );
}

function StatusBadge({ status }: { status: SubmissionStatus }) {
  const map: Record<SubmissionStatus, { cls: string; icon: React.ReactNode; label: string }> = {
    pending: { cls: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
    approved: { cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Approved' },
    rejected: { cls: 'bg-red-500/10 text-red-500 border-red-500/20', icon: <XCircle className="w-3 h-3" />, label: 'Rejected' },
  };
  const c = map[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${c.cls}`}>
      {c.icon}{c.label}
    </span>
  );
}

function PubkeyDisplay({ pubkey }: { pubkey: string }) {
  const author = useAuthor(pubkey);
  const [copied, setCopied] = useState(false);
  const name = author.data?.metadata?.name ?? genUserName(pubkey);
  const pic = author.data?.metadata?.picture;

  const copy = () => {
    navigator.clipboard.writeText(pubkey).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  return (
    <div className="flex items-center gap-1.5">
      <Avatar className="w-5 h-5">
        <AvatarImage src={pic} />
        <AvatarFallback className="text-xs">{name.charAt(0)}</AvatarFallback>
      </Avatar>
      <span className="text-xs font-medium truncate max-w-[120px]">{name}</span>
      <button onClick={copy} className="text-muted-foreground hover:text-foreground">
        {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      </button>
    </div>
  );
}

// ─── Sub-panels ───────────────────────────────────────────────────────────────

function SubmissionRow({
  sub, canApprove, onDecision,
}: {
  sub: Submission;
  canApprove: boolean;
  onDecision: (s: Submission, d: 'approved' | 'rejected') => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 border-b border-border/40 last:border-0">
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={sub.status} />
          {sub.hasEncryptedNotes && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-0.5 text-xs text-violet-500 cursor-help">
                    <Lock className="w-3 h-3" /> Encrypted notes
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Submitter attached NIP-44 encrypted notes for the moderator.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <a
          href={sub.url.replace('wss://', 'https://').replace('ws://', 'http://')}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-sm hover:underline text-primary flex items-center gap-1"
        >
          {sub.name} <ExternalLink className="w-3 h-3" />
        </a>
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="font-mono">{shortenUrl(sub.url)}</span>
          <span>·</span>
          <PubkeyDisplay pubkey={sub.submitterPubkey} />
          <span>·</span>
          <span>{timeAgo(sub.submittedAt)}</span>
          <span>·</span>
          <span className="capitalize">{sub.pricing}</span>
        </div>
        {sub.useCases.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {sub.useCases.slice(0, 4).map((uc) => (
              <span key={uc} className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{uc}</span>
            ))}
          </div>
        )}
      </div>

      {canApprove && sub.status === 'pending' && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
            onClick={() => onDecision(sub, 'approved')}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-red-500/30 text-red-500 hover:bg-red-500/10"
            onClick={() => onDecision(sub, 'rejected')}
          >
            <XCircle className="w-3.5 h-3.5" /> Reject
          </Button>
        </div>
      )}

      {canApprove && sub.status === 'approved' && (
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-xs text-red-500 hover:bg-red-500/10 flex-shrink-0"
          onClick={() => onDecision(sub, 'rejected')}
        >
          <Trash2 className="w-3.5 h-3.5" /> Remove
        </Button>
      )}

      <Link to={`/relay/${encodeURIComponent(sub.url)}`} className="flex-shrink-0">
        <Button size="sm" variant="ghost" className="gap-1 text-xs">
          <Eye className="w-3.5 h-3.5" /> View
        </Button>
      </Link>
    </div>
  );
}

// ─── Role Manager ────────────────────────────────────────────────────────────
function RoleManager({
  title, dTag, members, canEdit,
}: {
  title: string; dTag: string; members: string[]; canEdit: boolean;
}) {
  const [newPubkey, setNewPubkey] = useState('');
  const [error, setError] = useState('');
  const { mutateAsync: updateRoles, isPending } = useUpdateRoleList();

  const isValidHex = (s: string) => /^[0-9a-f]{64}$/i.test(s.trim());

  const add = async () => {
    const pk = newPubkey.trim().toLowerCase();
    if (!isValidHex(pk)) { setError('Must be a valid 64-char hex pubkey'); return; }
    if (members.includes(pk)) { setError('Already in list'); return; }
    try {
      await updateRoles({ dTag, pubkeys: [...members, pk] });
      setNewPubkey('');
      setError('');
    } catch (e) { setError(String(e)); }
  };

  const remove = async (pk: string) => {
    try {
      await updateRoles({ dTag, pubkeys: members.filter((m) => m !== pk) });
    } catch (e) { console.error(e); }
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          {title}
          <Badge variant="secondary" className="text-xs ml-auto">{members.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground">No members yet.</p>
        ) : (
          <div className="space-y-2">
            {members.map((pk) => (
              <div key={pk} className="flex items-center justify-between">
                <PubkeyDisplay pubkey={pk} />
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-red-500 hover:bg-red-500/10"
                    onClick={() => remove(pk)}
                    disabled={isPending}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {canEdit && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newPubkey}
                  onChange={(e) => { setNewPubkey(e.target.value); setError(''); }}
                  placeholder="Hex pubkey (64 chars)…"
                  className="font-mono text-xs h-8"
                />
                <Button size="sm" className="h-8 gap-1 flex-shrink-0" onClick={add} disabled={isPending || !newPubkey}>
                  {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Add
                </Button>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <p className="text-xs text-muted-foreground">
                Paste the hex pubkey (not npub). Published as kind:30078 to{' '}
                <code className="bg-muted px-1 rounded">{shortenUrl(APP_RELAY_URL)}</code>.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Approve/Reject dialog ─────────────────────────────────────────────────
function DecisionDialog({
  submission, decision, onConfirm, onCancel, isPending,
}: {
  submission: Submission | null;
  decision: 'approved' | 'rejected' | null;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState('');

  if (!submission || !decision) return null;

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {decision === 'approved'
              ? <><CheckCircle2 className="w-5 h-5 text-emerald-500" /> Approve Relay</>
              : <><XCircle className="w-5 h-5 text-red-500" /> Reject Relay</>
            }
          </DialogTitle>
          <DialogDescription>
            {decision === 'approved'
              ? `Approve "${submission.name}" and add it to the public directory?`
              : `Reject "${submission.name}" and remove it from the directory?`
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="bg-muted/40 rounded-lg px-3 py-2 text-xs font-mono text-muted-foreground">
            {submission.url}
          </div>
          {decision === 'rejected' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason (optional)</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Relay is unreachable, spam, policy violation…"
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          )}
          <Alert className={decision === 'approved' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}>
            <AlertDescription className="text-xs">
              This decision will be published as a signed <code className="bg-muted px-1 rounded">kind:30078</code> event
              to <code className="bg-muted px-1 rounded">{shortenUrl(APP_RELAY_URL)}</code>.
              {decision === 'approved' ? ' The relay will appear in the public directory.' : ' The relay will be hidden from the directory.'}
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            onClick={() => onConfirm(reason)}
            disabled={isPending}
            className={decision === 'approved' ? '' : 'bg-red-500 hover:bg-red-600 text-white'}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {decision === 'approved' ? 'Approve' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export function DashboardPage() {
  useSeoMeta({ title: 'Dashboard — 0xNostrRelays' });

  const { user, metadata } = useCurrentUser();
  const { role, isOwner, isMod, canApprove, canManageRoles, adminList, modList } = useAdminAccess();
  const loginActions = useLoginActions();
  const navigate = useNavigate();

  const { data: allSubmissions, isLoading: subsLoading, refetch } = useSubmissions();
  const { data: reports, isLoading: reportsLoading } = useReports();
  const { stats, isLoading: statsLoading } = useDashboardStats();
  const { mutateAsync: approve, isPending: approving } = useApproveSubmission();

  const [search, setSearch] = useState('');
  const [decisionTarget, setDecisionTarget] = useState<{ sub: Submission; decision: 'approved' | 'rejected' } | null>(null);

  const displayName = metadata?.name ?? (user ? genUserName(user.pubkey) : 'User');
  const avatar = metadata?.picture;

  // Redirect if no user
  if (!user) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-24 text-center">
        <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Login Required</h2>
        <p className="text-muted-foreground mb-6">You need to log in with Nostr to access the dashboard.</p>
        <Link to="/"><Button variant="outline" className="gap-2"><ArrowLeft className="w-4 h-4" /> Back to Home</Button></Link>
      </div>
    );
  }

  // Redirect if regular user
  if (role === 'user') {
    return (
      <div className="container mx-auto max-w-xl px-4 py-24 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold mb-3">Access Denied</h2>
        <p className="text-muted-foreground mb-2">
          Your account doesn't have dashboard access.
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          Logged in as: <code className="bg-muted px-1 rounded">{user.pubkey.slice(0, 20)}…</code>
        </p>
        <Link to="/"><Button variant="outline" className="gap-2"><ArrowLeft className="w-4 h-4" /> Back to Home</Button></Link>
      </div>
    );
  }

  const pending = allSubmissions?.filter((s) => s.status === 'pending') ?? [];
  const approved = allSubmissions?.filter((s) => s.status === 'approved') ?? [];
  const rejected = allSubmissions?.filter((s) => s.status === 'rejected') ?? [];

  const filteredSubs = (subs: Submission[]) =>
    search
      ? subs.filter((s) =>
          s.url.toLowerCase().includes(search.toLowerCase()) ||
          s.name.toLowerCase().includes(search.toLowerCase())
        )
      : subs;

  const handleDecision = (sub: Submission, decision: 'approved' | 'rejected') => {
    setDecisionTarget({ sub, decision });
  };

  const confirmDecision = async (reason: string) => {
    if (!decisionTarget) return;
    await approve({ submission: decisionTarget.sub, decision: decisionTarget.decision, reason });
    setDecisionTarget(null);
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Avatar className="w-14 h-14 border-2 border-primary/20">
            <AvatarImage src={avatar} />
            <AvatarFallback className="text-lg font-bold">{displayName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-2xl font-black">{displayName}</h1>
              <RoleBadge role={role} />
            </div>
            <p className="text-xs text-muted-foreground font-mono">{user.pubkey.slice(0, 16)}…{user.pubkey.slice(-8)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => refetch()}
            disabled={subsLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${subsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-red-500 border-red-500/30 hover:bg-red-500/10"
            onClick={async () => { await loginActions.logout(); navigate('/'); }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      {!statsLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {[
            { label: 'Seed Relays', value: RELAY_SEED_DATA.length, icon: Radio, color: 'text-primary' },
            { label: 'Total Submitted', value: stats.total, icon: Inbox, color: 'text-blue-500' },
            { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-yellow-500' },
            { label: 'Approved', value: stats.approved, icon: CheckCircle2, color: 'text-emerald-500' },
            { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-500' },
            { label: 'Reports', value: stats.reports, icon: Flag, color: 'text-orange-500' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="border-border/60">
                <CardContent className="pt-4 pb-4 text-center">
                  <Icon className={`w-5 h-5 mx-auto mb-1.5 ${s.color}`} />
                  <div className="text-2xl font-black">{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* App relay info */}
      <div className="flex items-center gap-3 bg-muted/30 border border-border/40 rounded-xl px-4 py-2.5 mb-6 text-xs text-muted-foreground">
        <Radio className="w-3.5 h-3.5 text-primary flex-shrink-0" />
        <span>App relay: <code className="bg-muted px-1 rounded font-mono">{APP_RELAY_URL}</code></span>
        <span className="ml-auto opacity-60">All events published here</span>
      </div>

      <Tabs defaultValue="queue" className="space-y-6">
        <TabsList className="bg-muted/50 flex-wrap h-auto gap-1">
          <TabsTrigger value="queue" className="relative gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Queue
            {pending.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {pending.length > 9 ? '9+' : pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />Approved
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-1.5">
            <XCircle className="w-3.5 h-3.5" />Rejected
          </TabsTrigger>
          <TabsTrigger value="reports" className="relative gap-1.5">
            <Flag className="w-3.5 h-3.5" />
            Reports
            {(reports?.length ?? 0) > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {(reports?.length ?? 0) > 9 ? '9+' : reports?.length}
              </span>
            )}
          </TabsTrigger>
          {canManageRoles && (
            <TabsTrigger value="roles" className="gap-1.5">
              <Users className="w-3.5 h-3.5" />Roles
            </TabsTrigger>
          )}
          {isOwner && (
            <TabsTrigger value="stats" className="gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" />Stats
            </TabsTrigger>
          )}
        </TabsList>

        {/* Search bar shared */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search submissions by URL or name…"
            className="pl-9 h-9 text-sm"
          />
        </div>

        {/* ── Pending queue ───────────────────────────────────────────────── */}
        <TabsContent value="queue">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                Pending Submissions
                <Badge variant="secondary">{pending.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {subsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading from {APP_RELAY_URL}…
                </div>
              ) : filteredSubs(pending).length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{search ? 'No matches' : 'Queue is clear! 🎉'}</p>
                </div>
              ) : (
                filteredSubs(pending).map((sub) => (
                  <SubmissionRow key={sub.eventId} sub={sub} canApprove={canApprove} onDecision={handleDecision} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Approved ──────────────────────────────────────────────────────── */}
        <TabsContent value="approved">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Approved Relays
                <Badge variant="secondary">{approved.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredSubs(approved).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No approved submissions yet.</p>
              ) : (
                filteredSubs(approved).map((sub) => (
                  <SubmissionRow key={sub.eventId} sub={sub} canApprove={canApprove} onDecision={handleDecision} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Rejected ──────────────────────────────────────────────────────── */}
        <TabsContent value="rejected">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-500" />
                Rejected Submissions
                <Badge variant="secondary">{rejected.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredSubs(rejected).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No rejected submissions.</p>
              ) : (
                filteredSubs(rejected).map((sub) => (
                  <SubmissionRow key={sub.eventId} sub={sub} canApprove={canApprove} onDecision={handleDecision} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Reports ───────────────────────────────────────────────────────── */}
        <TabsContent value="reports">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Flag className="w-4 h-4 text-orange-500" />
                Relay Reports
                <Badge variant="secondary">{reports?.length ?? 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reportsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading reports…
                </div>
              ) : !reports?.length ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Flag className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No reports yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reports.map((r) => (
                    <div key={r.eventId} className="border border-border/40 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-orange-500" />
                          <span className="font-semibold text-sm">{r.reason}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{timeAgo(r.reportedAt)}</span>
                      </div>
                      <div className="text-xs font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded">
                        {r.relayUrl || 'No relay URL'}
                      </div>
                      {r.detail && (
                        <p className="text-sm text-muted-foreground">{r.detail}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Reporter:</span>
                        <PubkeyDisplay pubkey={r.reporterPubkey} />
                        {r.referencedSubmissionId && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ref: <code className="bg-muted px-1 rounded">{r.referencedSubmissionId.slice(0, 12)}…</code>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Roles (owner + admin) ──────────────────────────────────────────── */}
        {canManageRoles && (
          <TabsContent value="roles" className="space-y-4">
            <Alert className="border-violet-500/20 bg-violet-500/5">
              <Shield className="w-4 h-4 text-violet-500" />
              <AlertTitle className="text-sm">Decentralized Role System</AlertTitle>
              <AlertDescription className="text-xs">
                Roles are managed via <code className="bg-muted px-1 rounded">kind:30078</code> events published to{' '}
                <code className="bg-muted px-1 rounded">{APP_RELAY_URL}</code>.
                Admin list: <code className="bg-muted px-1 rounded">d=0xadmin-roles</code> (owner only).
                Mod list: <code className="bg-muted px-1 rounded">d=0xmod-roles</code> (owner + admins).
                Changes are reflected immediately on re-query.
              </AlertDescription>
            </Alert>

            {isOwner && (
              <RoleManager
                title="Admins"
                dTag={ADMIN_ROLES_D_TAG}
                members={adminList}
                canEdit={isOwner}
              />
            )}

            <RoleManager
              title="Moderators"
              dTag={MOD_ROLES_D_TAG}
              members={modList}
              canEdit={canManageRoles}
            />

            {/* Role capability matrix */}
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Role Capabilities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-muted-foreground font-medium">Permission</th>
                        {['Owner', 'Admin', 'Mod', 'User'].map((r) => (
                          <th key={r} className="py-2 text-center text-muted-foreground font-medium">{r}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {[
                        ['Approve/Reject submissions', true, true, true, false],
                        ['Read reports', true, true, true, false],
                        ['Remove approved relays', true, true, false, false],
                        ['Add/remove moderators', true, true, false, false],
                        ['Add/remove admins', true, false, false, false],
                        ['Manage role lists on relay', true, false, false, false],
                        ['View dashboard', true, true, true, false],
                        ['Submit a relay', true, true, true, true],
                        ['Vote on relay tags', true, true, true, true],
                      ].map(([perm, ...vals]) => (
                        <tr key={String(perm)}>
                          <td className="py-2 text-muted-foreground">{String(perm)}</td>
                          {(vals as boolean[]).map((v, i) => (
                            <td key={i} className="py-2 text-center">
                              {v ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mx-auto" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground/30 mx-auto" />}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Owner stats ───────────────────────────────────────────────────── */}
        {isOwner && (
          <TabsContent value="stats">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    Directory Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'Seed relays (hardcoded)', value: RELAY_SEED_DATA.length },
                    { label: 'Submitted relays (live)', value: stats.total },
                    { label: 'Approved & live', value: stats.approved + RELAY_SEED_DATA.length },
                    { label: 'Pending review', value: stats.pending },
                    { label: 'Seed with NIP-66', value: STATS.nip66Enriched },
                    { label: 'Seed Blossom relays', value: STATS.blossomEnabled },
                    { label: 'Admins', value: adminList.length },
                    { label: 'Moderators', value: modList.length },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-bold">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Radio className="w-4 h-4 text-primary" />
                    App Relay Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'App Relay', value: APP_RELAY_URL },
                    { label: 'Owner npub', value: `${APP_NPUB.slice(0, 20)}…` },
                    { label: 'Owner hex', value: `${OWNER_PUBKEY_HEX.slice(0, 16)}…` },
                    { label: 'Submission kind', value: '30078 (NIP-78)' },
                    { label: 'Report kind', value: '1984 (NIP-56)' },
                    { label: 'Approval kind', value: '30078 (NIP-78)' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-start justify-between text-sm gap-4">
                      <span className="text-muted-foreground flex-shrink-0">{label}</span>
                      <code className="font-mono text-xs text-right break-all">{value}</code>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Quick actions */}
              <Card className="border-border/60 md:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                  <Link to="/submit">
                    <Button size="sm" variant="outline" className="gap-2">
                      <Plus className="w-3.5 h-3.5" /> Submit Relay
                    </Button>
                  </Link>
                  <Link to="/relays">
                    <Button size="sm" variant="outline" className="gap-2">
                      <Radio className="w-3.5 h-3.5" /> View Directory
                    </Button>
                  </Link>
                  <Link to="/api">
                    <Button size="sm" variant="outline" className="gap-2">
                      <ChevronRight className="w-3.5 h-3.5" /> API Docs
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => refetch()}
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Sync from Relay
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Approval dialog */}
      <DecisionDialog
        submission={decisionTarget?.sub ?? null}
        decision={decisionTarget?.decision ?? null}
        onConfirm={confirmDecision}
        onCancel={() => setDecisionTarget(null)}
        isPending={approving}
      />
    </div>
  );
}
