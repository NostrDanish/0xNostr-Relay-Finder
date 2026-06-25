/**
 * AutoTagsPanel — shows auto-detected use-case tags based on NIP-11 + NIP-66 data.
 * Explains *why* each tag was assigned.
 */

import { Cpu, Info, ChevronDown, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { UseCaseBadge } from './UseCaseBadge';
import { autoTagRelay, type AutoTagResult } from '@/lib/autoTagger';
import { useLiveNIP11 } from '@/hooks/useLiveNIP11';
import type { RelayRecord, UseCaseTag } from '@/types/relay';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface AutoTagsPanelProps {
  relay: RelayRecord;
}

export function AutoTagsPanel({ relay }: AutoTagsPanelProps) {
  const { data: liveNip11, isLoading: fetchingLive } = useLiveNIP11(relay.url);
  const [showReasons, setShowReasons] = useState(false);

  // Use live NIP-11 if available, otherwise fall back to stored
  const nip11 = liveNip11 ?? relay.nip11;
  const autoResult: AutoTagResult = autoTagRelay(nip11, relay.nip66);

  const isLive = !!liveNip11;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary" />
          Auto-Detected Tags
          {fetchingLive && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          {isLive && (
            <span className="text-xs bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 px-1.5 py-0.5 rounded-full font-medium">
              Live NIP-11
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          These tags are automatically inferred from the relay&apos;s NIP-11 info document, supported NIPs, and NIP-66 monitor data.
        </p>

        {/* Auto tags display */}
        <div className="flex flex-wrap gap-1.5">
          {autoResult.allTags.map((tag) => (
            <UseCaseBadge key={tag} tag={tag as UseCaseTag} size="md" />
          ))}
          {autoResult.allTags.length === 0 && (
            <span className="text-xs text-muted-foreground">No tags could be automatically inferred.</span>
          )}
        </div>

        {/* Reasoning (collapsible) */}
        {autoResult.reasons.size > 0 && (
          <Collapsible open={showReasons} onOpenChange={setShowReasons}>
            <CollapsibleTrigger className="flex items-center gap-2 text-xs text-primary hover:underline">
              <Info className="w-3 h-3" />
              {showReasons ? 'Hide' : 'Show'} reasoning
              <ChevronDown className={cn('w-3 h-3 transition-transform', showReasons && 'rotate-180')} />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="space-y-2 bg-muted/30 rounded-lg p-3 border border-border/40">
                {Array.from(autoResult.reasons.entries()).map(([tag, reasons]) => (
                  <div key={tag} className="text-xs">
                    <span className="font-semibold text-foreground">{tag}:</span>
                    <ul className="list-disc list-inside text-muted-foreground ml-2 mt-0.5 space-y-0.5">
                      {reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* NIP breakdown */}
        {(nip11.supported_nips ?? []).length > 0 && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {(nip11.supported_nips ?? []).length} NIPs detected
            </span>
            {' — '}
            {(nip11.supported_nips ?? []).map(n => `NIP-${String(n).padStart(2, '0')}`).join(', ')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
