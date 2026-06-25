/**
 * Auto-Tagging Engine for 0xRelayFinder
 *
 * Analyzes a relay's NIP-11 info document and NIP-66 data to automatically
 * assign use-case tags. This is the "smart system" that looks at what NIPs
 * and event kinds a relay supports and figures out what it's good for.
 */

import type { NIP11Info, NIP66Data, UseCaseTag } from '@/types/relay';
import {
  NIP_TO_USE_CASE_MAP,
  LIMITATION_TO_USE_CASE,
  CAPABILITY_TO_USE_CASE,
} from '@/lib/constants';

export interface AutoTagResult {
  /** Tags inferred from NIP support */
  nipTags: UseCaseTag[];
  /** Tags inferred from relay limitations */
  limitationTags: UseCaseTag[];
  /** Tags inferred from NIP-66 capabilities */
  capabilityTags: UseCaseTag[];
  /** All tags combined and deduplicated */
  allTags: UseCaseTag[];
  /** Explanation for each tag (for UI display) */
  reasons: Map<string, string[]>;
}

/**
 * Analyze a relay's NIP-11 document and NIP-66 data to produce auto-tags.
 */
export function autoTagRelay(
  nip11: NIP11Info,
  nip66?: NIP66Data
): AutoTagResult {
  const reasons = new Map<string, string[]>();

  function addReason(tag: string, reason: string) {
    const existing = reasons.get(tag) ?? [];
    existing.push(reason);
    reasons.set(tag, existing);
  }

  // ── Step 1: NIP-based tagging ───────────────────────────────────────────
  const nipTags: Set<string> = new Set();
  const supportedNips = nip11.supported_nips ?? [];

  for (const nip of supportedNips) {
    const tags = NIP_TO_USE_CASE_MAP[nip];
    if (tags) {
      for (const tag of tags) {
        nipTags.add(tag);
        addReason(tag, `Supports NIP-${String(nip).padStart(2, '0')}`);
      }
    }
  }

  // ── Step 2: Limitation-based tagging ────────────────────────────────────
  const limitationTags: Set<string> = new Set();
  if (nip11.limitation) {
    for (const [key, tags] of Object.entries(LIMITATION_TO_USE_CASE)) {
      const val = (nip11.limitation as Record<string, unknown>)[key];
      if (val === true) {
        for (const tag of tags) {
          limitationTags.add(tag);
          addReason(tag, `NIP-11 limitation: ${key} = true`);
        }
      }
    }
  }

  // Check for large message size (indicates media support)
  if (nip11.limitation?.max_message_length && nip11.limitation.max_message_length >= 524288) {
    limitationTags.add('Images');
    addReason('Images', `Large max_message_length (${nip11.limitation.max_message_length} bytes)`);
  }

  // Check for large content length
  if (nip11.limitation?.max_content_length && nip11.limitation.max_content_length >= 100000) {
    limitationTags.add('Long Form');
    addReason('Long Form', `Large max_content_length (${nip11.limitation.max_content_length} chars)`);
  }

  // Check for high subscription limit (indicates power/indexing)
  if (nip11.limitation?.max_subscriptions && nip11.limitation.max_subscriptions >= 50) {
    limitationTags.add('High Performance');
    addReason('High Performance', `High max_subscriptions (${nip11.limitation.max_subscriptions})`);
  }

  // ── Step 3: NIP-66 capability-based tagging ─────────────────────────────
  const capabilityTags: Set<string> = new Set();
  if (nip66?.capabilities) {
    for (const [cap, tags] of Object.entries(CAPABILITY_TO_USE_CASE)) {
      if ((nip66.capabilities as Record<string, boolean>)[cap]) {
        for (const tag of tags) {
          capabilityTags.add(tag);
          addReason(tag, `NIP-66 capability: ${cap}`);
        }
      }
    }
  }

  // ── Step 4: Software-based heuristics ───────────────────────────────────
  const sw = (nip11.software ?? '').toLowerCase();
  if (sw.includes('strfry')) {
    nipTags.add('High Performance');
    addReason('High Performance', 'Running strfry (known for high throughput)');
  }
  if (sw.includes('blossom')) {
    nipTags.add('Blossom');
    nipTags.add('Images');
    addReason('Blossom', 'Running Blossom server software');
    addReason('Images', 'Running Blossom server software');
  }

  // ── Step 5: Payment detection ───────────────────────────────────────────
  if (nip11.fees || nip11.payments_url) {
    limitationTags.add('Paid Access');
    addReason('Paid Access', nip11.payments_url ? `Has payments URL: ${nip11.payments_url}` : 'Has fee structure defined');
  }

  // ── Combine and deduplicate ─────────────────────────────────────────────
  const allTags = new Set([...nipTags, ...limitationTags, ...capabilityTags]);

  // Always add "General" if the relay supports NIP-01 basics
  if (supportedNips.includes(1) || supportedNips.length === 0) {
    allTags.add('General');
  }

  return {
    nipTags: [...nipTags] as UseCaseTag[],
    limitationTags: [...limitationTags] as UseCaseTag[],
    capabilityTags: [...capabilityTags] as UseCaseTag[],
    allTags: [...allTags] as UseCaseTag[],
    reasons,
  };
}

/**
 * Merge auto-generated tags with manually-assigned tags.
 * Auto tags fill gaps; manual tags take priority.
 */
export function mergeAutoTags(
  manualTags: UseCaseTag[],
  autoResult: AutoTagResult
): UseCaseTag[] {
  const merged = new Set<string>(manualTags);
  for (const tag of autoResult.allTags) {
    merged.add(tag);
  }
  return [...merged] as UseCaseTag[];
}
