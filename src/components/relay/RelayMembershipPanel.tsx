/**
 * NIP-43 Membership Panel for Relay Detail Page
 *
 * Shows relay membership status, roles, and join/leave buttons.
 * Supports invite-only relays with claim codes.
 */

import { useState } from 'react';
import {
  Users, Crown, Shield, LogIn, LogOut, Loader2, Key,
  CheckCircle2, XCircle, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useRelayMembership, useIsRelayMember, useJoinRelay, useLeaveRelay, useRequestInvite } from '@/hooks/useRelayMembership';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { genUserName } from '@/lib/genUserName';

// ─── Member Item ──────────────────────────────────────────────────────────────

function MemberItem({ member }: { member: { pubkey: string; roles: string[] } }) {
  const author = useAuthor(member.pubkey);
  const name = author.data?.metadata?.name ?? genUserName(member.pubkey);
  const pic = author.data?.metadata?.picture;

  return (
    <div className="flex items-center gap-2 py-1.5">
      <Avatar className="w-6 h-6">
        <AvatarImage src={pic} />
        <AvatarFallback className="text-xs">{name.charAt(0)}</AvatarFallback>
      </Avatar>
      <span className="text-sm font-medium truncate flex-1">{name}</span>
      <div className="flex gap-1">
        {member.roles.map((role) => (
          <Badge key={role} variant="outline" className="text-[10px] px-1.5 py-0">
            {role}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// ─── Main Membership Panel ────────────────────────────────────────────────────

export function RelayMembershipPanel({
  relayUrl,
  relaySelfPubkey,
}: {
  relayUrl: string;
  relaySelfPubkey?: string;
}) {
  const { user } = useCurrentUser();
  const { data: membership, isLoading } = useRelayMembership(relayUrl, relaySelfPubkey);
  const isMember = useIsRelayMember(relayUrl, relaySelfPubkey);
  const joinRelay = useJoinRelay();
  const leaveRelay = useLeaveRelay();
  const requestInvite = useRequestInvite();
  const [inviteCode, setInviteCode] = useState('');
  const [showInviteInput, setShowInviteInput] = useState(false);

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    try {
      const result = await joinRelay.mutateAsync({ relayUrl, inviteCode: inviteCode.trim() });
      if (result.success) {
        setInviteCode('');
        setShowInviteInput(false);
      }
    } catch {
      // error handled by mutation
    }
  };

  const handleRequestInvite = async () => {
    if (!relaySelfPubkey) return;
    try {
      const code = await requestInvite.mutateAsync({ relayUrl, relaySelfPubkey });
      setInviteCode(code);
      setShowInviteInput(true);
    } catch {
      // error handled by mutation
    }
  };

  const handleLeave = async () => {
    try {
      await leaveRelay.mutateAsync({ relayUrl });
    } catch {
      // error handled by mutation
    }
  };

  if (isLoading) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Membership
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!membership || membership.memberCount === 0) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Membership
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            This relay does not use NIP-43 membership lists. Access is open to all.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Membership
          <Badge variant="secondary" className="text-xs ml-auto">
            {membership.memberCount} member{membership.memberCount !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Membership status */}
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-card/50">
          {isMember ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <div className="flex-1">
                <div className="font-semibold text-sm">You are a member</div>
                <div className="text-xs text-muted-foreground">You have access to this relay</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleLeave}
                disabled={leaveRelay.isPending}
                className="gap-1.5 text-red-500 hover:text-red-600"
              >
                {leaveRelay.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                Leave
              </Button>
            </>
          ) : membership.requiresInvite ? (
            <>
              <Lock className="w-5 h-5 text-yellow-500" />
              <div className="flex-1">
                <div className="font-semibold text-sm">Invite Required</div>
                <div className="text-xs text-muted-foreground">This relay requires an invite code to join</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowInviteInput(true)}
                className="gap-1.5"
              >
                <Key className="w-3.5 h-3.5" /> Join
              </Button>
            </>
          ) : (
            <>
              <LogIn className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <div className="font-semibold text-sm">Open Membership</div>
                <div className="text-xs text-muted-foreground">Anyone can join this relay</div>
              </div>
            </>
          )}
        </div>

        {/* Invite code input */}
        {showInviteInput && !isMember && (
          <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-border/30">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Key className="w-3 h-3" /> Enter Invite Code
            </div>
            <div className="flex gap-2">
              <Input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Paste invite code here"
                className="h-8 text-xs flex-1"
              />
              <Button
                size="sm"
                onClick={handleJoin}
                disabled={joinRelay.isPending || !inviteCode.trim()}
                className="h-8 gap-1"
              >
                {joinRelay.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              </Button>
            </div>
            <button
              onClick={handleRequestInvite}
              disabled={requestInvite.isPending}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              {requestInvite.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Key className="w-3 h-3" />}
              Request invite from relay
            </button>
          </div>
        )}

        {/* Roles */}
        {membership.roles.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
              <Crown className="w-3 h-3" /> Roles
            </div>
            <div className="space-y-1">
              {membership.roles.map((role) => (
                <div key={role.id} className="flex items-center gap-2 py-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: `hsl(${role.color ?? 200}, 70%, 50%)` }}
                  />
                  <span className="text-sm font-medium">{role.label ?? role.id}</span>
                  {role.description && (
                    <span className="text-xs text-muted-foreground truncate">{role.description}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members list */}
        {membership.members.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
              <Users className="w-3 h-3" /> Members ({membership.memberCount})
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {membership.members.slice(0, 10).map((member) => (
                <MemberItem key={member.pubkey} member={member} />
              ))}
              {membership.members.length > 10 && (
                <p className="text-xs text-muted-foreground text-center py-1">
                  +{membership.members.length - 10} more members
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
