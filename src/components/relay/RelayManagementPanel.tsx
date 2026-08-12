/**
 * NIP-86 Operator Management Panel
 *
 * Displays management API capabilities and provides controls for
 * relay operators to manage their relay directly from the app.
 */

import { useState } from 'react';
import {
  Shield, Wrench, Loader2, CheckCircle2, XCircle,
  Ban, UserCheck, FileWarning, Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useRelayManagementCapabilities, useRelayManagementClient } from '@/hooks/useRelayManagement';
import { useCurrentUser } from '@/hooks/useCurrentUser';

// ─── Management API Status ────────────────────────────────────────────────────

function ManagementStatus({ relayUrl }: { relayUrl: string }) {
  const { data: capabilities, isLoading } = useRelayManagementCapabilities(relayUrl);

  if (isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  if (!capabilities?.supported) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-muted/30">
        <XCircle className="w-5 h-5 text-muted-foreground" />
        <div>
          <div className="font-semibold text-sm">Management API Not Available</div>
          <div className="text-xs text-muted-foreground">
            This relay does not support NIP-86 Relay Management API
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
      <div className="flex-1">
        <div className="font-semibold text-sm">Management API Available</div>
        <div className="text-xs text-muted-foreground">
          {capabilities.methods.length} methods supported
          {capabilities.authRequired && ' (auth required)'}
        </div>
      </div>
      <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-500">
        NIP-86
      </Badge>
    </div>
  );
}

// ─── Management Actions ───────────────────────────────────────────────────────

function ManagementActions({ relayUrl }: { relayUrl: string }) {
  const { user } = useCurrentUser();
  const { data: client } = useRelayManagementClient(relayUrl);
  const [banPubkey, setBanPubkey] = useState('');
  const [banReason, setBanReason] = useState('');
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleBan = async () => {
    if (!client || !banPubkey.trim()) return;
    setLoading(true);
    setActionResult(null);
    try {
      await client.banPubkey(banPubkey.trim(), banReason.trim() || undefined);
      setActionResult({ type: 'success', message: `Banned ${banPubkey.slice(0, 16)}...` });
      setBanPubkey('');
      setBanReason('');
    } catch (err) {
      setActionResult({ type: 'error', message: String(err) });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  if (!client) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-muted-foreground mb-2">
          Connect with NIP-98 auth to access management controls
        </p>
        <Button size="sm" variant="outline" className="gap-2" disabled>
          <Settings className="w-3.5 h-3.5" />
          Connect as Operator
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <Shield className="w-3 h-3" /> Ban Pubkey
      </div>
      <div className="flex gap-2">
        <Input
          value={banPubkey}
          onChange={(e) => setBanPubkey(e.target.value)}
          placeholder="64-char hex pubkey"
          className="h-8 text-xs flex-1 font-mono"
        />
        <Input
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
          placeholder="Reason (optional)"
          className="h-8 text-xs w-32"
        />
        <Button
          size="sm"
          variant="destructive"
          onClick={handleBan}
          disabled={loading || !banPubkey.trim()}
          className="h-8 gap-1"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
        </Button>
      </div>

      {actionResult && (
        <div className={`p-2 rounded-lg text-xs ${
          actionResult.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30'
            : 'bg-red-500/10 text-red-500 border border-red-500/30'
        }`}>
          {actionResult.message}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-2">
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" disabled>
          <UserCheck className="w-3 h-3" /> List Allowed
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" disabled>
          <FileWarning className="w-3 h-3" /> Moderation Queue
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" disabled>
          <Settings className="w-3 h-3" /> Relay Config
        </Button>
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function RelayManagementPanel({ relayUrl }: { relayUrl: string }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Wrench className="w-4 h-4 text-primary" />
          Operator Tools
          <Badge variant="outline" className="text-xs ml-auto border-violet-500/30 text-violet-500">
            NIP-86
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ManagementStatus relayUrl={relayUrl} />
        <ManagementActions relayUrl={relayUrl} />
      </CardContent>
    </Card>
  );
}
