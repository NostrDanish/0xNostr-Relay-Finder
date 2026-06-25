/**
 * LiveStatusBadges — per-relay live status indicators
 *
 * Displays:
 * - 🟢 Online / 🔴 Offline (from NIP-66 or WS probe)
 * - ⚡ Latency in ms (rtt-open)
 * - ⏱ Last seen (NIP-66 created_at)
 * - 📊 24h uptime %
 * - 📋 NIP-11 freshness
 */

import { useState } from 'react';
import { Wifi, Clock, BarChart3, FileText, Activity, RefreshCw, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/utils';
import type { LiveRelayRecord } from '@/hooks/useLiveRelayStore';
import { getNIP11Freshness } from '@/hooks/useNIP11Batch';

interface LiveStatusBadgesProps {
  relay: LiveRelayRecord;
  compact?: boolean;
}

function MicroBadge({
  icon: Icon,
  label,
  value,
  color,
  tooltip,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  tooltip: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(
            'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border cursor-help',
            color,
          )}>
            <Icon className="w-2.5 h-2.5" />
            <span className="font-medium tabular-nums">{value}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function LiveStatusBadges({ relay, compact = false }: LiveStatusBadgesProps) {
  const latency = relay.liveLatencyMs ?? relay.avgLatencyMs;
  const lastSeen = relay.liveLastSeen;
  const nip11Fresh = getNIP11Freshness(relay.nip11Cache);

  // Latency color
  const latColor = latency != null
    ? latency < 100
      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
      : latency < 200
      ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      : 'bg-red-500/10 text-red-500 border-red-500/20'
    : 'bg-muted text-muted-foreground border-border/50';

  // NIP-11 freshness color
  const nip11Color = nip11Fresh.color === 'green'
    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    : nip11Fresh.color === 'yellow'
    ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
    : 'bg-muted text-muted-foreground border-border/50';

  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {latency != null && (
          <MicroBadge
            icon={Wifi}
            label="Latency"
            value={`${latency}ms`}
            color={latColor}
            tooltip={`Round-trip time: ${latency}ms${relay.liveRttRead ? ` | Read: ${relay.liveRttRead}ms` : ''}${relay.liveRttWrite ? ` | Write: ${relay.liveRttWrite}ms` : ''}`}
          />
        )}

        {lastSeen && (
          <MicroBadge
            icon={Activity}
            label="Last Seen"
            value={timeAgo(lastSeen)}
            color="bg-violet-500/10 text-violet-500 border-violet-500/20"
            tooltip={`Last confirmed online by NIP-66 monitor: ${timeAgo(lastSeen)}`}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Latency */}
      {latency != null && (
        <MicroBadge
          icon={Wifi}
          label="Latency (rtt-open)"
          value={`${latency}ms`}
          color={latColor}
          tooltip={`WebSocket open RTT: ${latency}ms${relay.liveRttRead ? `\nRead RTT: ${relay.liveRttRead}ms` : ''}${relay.liveRttWrite ? `\nWrite RTT: ${relay.liveRttWrite}ms` : ''}`}
        />
      )}

      {/* Last Seen via NIP-66 */}
      {lastSeen && (
        <MicroBadge
          icon={Clock}
          label="Last Seen by Monitor"
          value={timeAgo(lastSeen)}
          color="bg-violet-500/10 text-violet-500 border-violet-500/20"
          tooltip={`Last confirmed online by NIP-66 monitor: ${new Date(lastSeen).toLocaleString()}`}
        />
      )}

      {/* 24h Uptime */}
      <MicroBadge
        icon={BarChart3}
        label="30-Day Uptime"
        value={`${relay.uptimePercent30d.toFixed(1)}%`}
        color={
          relay.uptimePercent30d >= 99
            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            : relay.uptimePercent30d >= 95
            ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
            : 'bg-red-500/10 text-red-500 border-red-500/20'
        }
        tooltip={`30-day uptime: ${relay.uptimePercent30d.toFixed(2)}%`}
      />

      {/* NIP-11 Freshness */}
      <MicroBadge
        icon={FileText}
        label="NIP-11 Status"
        value={nip11Fresh.label}
        color={nip11Color}
        tooltip={nip11Fresh.detail}
      />

      {/* NIP changes indicator */}
      {relay.nipsAdded && relay.nipsAdded.length > 0 && (
        <MicroBadge
          icon={RefreshCw}
          label="NIPs Added"
          value={`+${relay.nipsAdded.length}`}
          color="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
          tooltip={`New NIPs: ${relay.nipsAdded.map(n => `NIP-${String(n).padStart(2, '0')}`).join(', ')}`}
        />
      )}

      {relay.nipsRemoved && relay.nipsRemoved.length > 0 && (
        <MicroBadge
          icon={RefreshCw}
          label="NIPs Removed"
          value={`-${relay.nipsRemoved.length}`}
          color="bg-red-500/10 text-red-500 border-red-500/20"
          tooltip={`Removed NIPs: ${relay.nipsRemoved.map(n => `NIP-${String(n).padStart(2, '0')}`).join(', ')}`}
        />
      )}
    </div>
  );
}

/**
 * Inline "Check Now" button for on-demand relay probing.
 */
interface CheckNowButtonProps {
  relayUrl: string;
  onResult?: (latencyMs: number | null, error?: string) => void;
}

export function CheckNowButton({ relayUrl, onResult }: CheckNowButtonProps) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ latency?: number; error?: string } | null>(null);

  const handleCheck = () => {
    setStatus('checking');
    setResult(null);

    const start = Date.now();
    let opened = false;

    try {
      const ws = new WebSocket(relayUrl);
      const timeout = setTimeout(() => {
        ws.close();
        setStatus('error');
        setResult({ error: 'Timeout (8s)' });
        onResult?.(null, 'Timeout');
      }, 8000);

      ws.onopen = () => {
        opened = true;
        const latency = Date.now() - start;
        clearTimeout(timeout);
        setStatus('done');
        setResult({ latency });
        onResult?.(latency);
        ws.close();
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        if (!opened) {
          setStatus('error');
          setResult({ error: 'Connection failed' });
          onResult?.(null, 'Connection failed');
        }
      };

      ws.onclose = (e) => {
        clearTimeout(timeout);
        if (!opened) {
          setStatus('error');
          setResult({ error: `Closed: ${e.code}` });
          onResult?.(null, `Closed: ${e.code}`);
        }
      };
    } catch (err) {
      setStatus('error');
      setResult({ error: String(err) });
      onResult?.(null, String(err));
    }
  };

  return (
    <button
      onClick={handleCheck}
      disabled={status === 'checking'}
      className={cn(
        'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border font-medium transition-all',
        status === 'checking'
          ? 'bg-primary/10 text-primary border-primary/20 cursor-wait'
          : status === 'done'
          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
          : status === 'error'
          ? 'bg-red-500/10 text-red-500 border-red-500/20'
          : 'bg-muted/50 text-muted-foreground border-border/50 hover:border-primary/30 hover:text-foreground cursor-pointer',
      )}
    >
      {status === 'checking' ? (
        <><Loader2 className="w-3 h-3 animate-spin" /> Checking…</>
      ) : status === 'done' && result?.latency != null ? (
        <><Wifi className="w-3 h-3" /> {result.latency}ms</>
      ) : status === 'error' ? (
        <><Wifi className="w-3 h-3" /> {result?.error ?? 'Failed'}</>
      ) : (
        <><RefreshCw className="w-3 h-3" /> Check Now</>
      )}
    </button>
  );
}


