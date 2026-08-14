/**
 * NIP-11 Validation Card — schema warnings for relay operators
 *
 * Shows errors/warnings/infos about the relay's NIP-11 document,
 * helping operators fix their configs. Inspired by nostr.watch's
 * AJV schema validation view (but lightweight, no AJV dependency).
 */

import { useMemo } from 'react';
import {
  FileCheck, AlertTriangle, XCircle, Info, CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { validateNip11, type Nip11Issue } from '@/lib/nip11Validation';
import type { NIP11Info } from '@/types/relay';
import { cn } from '@/lib/utils';

function IssueRow({ issue }: { issue: Nip11Issue }) {
  const config = {
    error: { icon: <XCircle className="w-3.5 h-3.5 text-red-500" />, cls: 'text-red-500' },
    warning: { icon: <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />, cls: 'text-yellow-500' },
    info: { icon: <Info className="w-3.5 h-3.5 text-blue-500" />, cls: 'text-blue-500' },
  }[issue.severity];

  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="mt-0.5 flex-shrink-0">{config.icon}</span>
      <div className="min-w-0">
        <code className="text-xs font-mono font-semibold">{issue.field}</code>
        <p className="text-xs text-muted-foreground">{issue.message}</p>
      </div>
    </div>
  );
}

export function Nip11ValidationCard({ nip11 }: { nip11: NIP11Info | undefined }) {
  const result = useMemo(() => validateNip11(nip11), [nip11]);

  const statusBadge = result.valid && result.issueCount === 0 ? (
    <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-500 gap-1">
      <CheckCircle2 className="w-3 h-3" /> Clean
    </Badge>
  ) : (
    <Badge
      variant="outline"
      className={cn(
        'text-xs gap-1',
        result.errors.length > 0
          ? 'border-red-500/30 text-red-500'
          : 'border-yellow-500/30 text-yellow-500',
      )}
    >
      {result.errors.length > 0 ? (
        <><XCircle className="w-3 h-3" /> {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}</>
      ) : (
        <><AlertTriangle className="w-3 h-3" /> {result.warnings.length} warning{result.warnings.length !== 1 ? 's' : ''}</>
      )}
    </Badge>
  );

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileCheck className="w-4 h-4 text-primary" />
          NIP-11 Validation
          <span className="ml-auto">{statusBadge}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {result.valid && result.issueCount === 0 && result.infos.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-500 py-2">
            <CheckCircle2 className="w-4 h-4" />
            Document looks great — no issues found.
          </div>
        ) : (
          <div className="space-y-1 divide-y divide-border/20">
            {result.errors.map((issue, i) => (
              <IssueRow key={`e${i}`} issue={issue} />
            ))}
            {result.warnings.map((issue, i) => (
              <IssueRow key={`w${i}`} issue={issue} />
            ))}
            {result.infos.map((issue, i) => (
              <IssueRow key={`i${i}`} issue={issue} />
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground/70 mt-3">
          Validation runs client-side against the NIP-11 spec. Fixing these improves
          discoverability in relay directories and compatibility with clients.
        </p>
      </CardContent>
    </Card>
  );
}
