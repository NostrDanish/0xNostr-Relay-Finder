/**
 * NIP-11 Document Validation (lightweight, no AJV)
 *
 * Validates relay info documents against NIP-11 expectations and
 * produces human-readable warnings/errors. Inspired by nostr.watch's
 * schema validation view, but dependency-free.
 *
 * Severity levels:
 * - error: breaks clients or is clearly wrong (bad types)
 * - warning: likely a mistake (bad URL, unsupported NIP numbers)
 * - info: recommendations (missing name/description)
 */

import type { NIP11Info } from '@/types/relay';

export interface Nip11Issue {
  severity: 'error' | 'warning' | 'info';
  field: string;
  message: string;
}

export interface Nip11Validation {
  valid: boolean;
  errors: Nip11Issue[];
  warnings: Nip11Issue[];
  infos: Nip11Issue[];
  /** Total issue count (errors + warnings) */
  issueCount: number;
}

const HEX_64 = /^[0-9a-f]{64}$/i;
const URL_RE = /^https?:\/\/.+/i;

/** Known NIP numbers (from the official registry) — used for sanity warnings */
const KNOWN_NIPS = new Set([
  1, 2, 4, 5, 9, 10, 11, 13, 14, 15, 17, 18, 19, 21, 22, 23, 24, 25, 27, 29, 30,
  32, 34, 35, 36, 37, 38, 39, 40, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52,
  53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 64, 65, 66, 67, 68, 69, 70, 71, 73,
  75, 77, 78, 84, 85, 86, 87, 88, 89, 92, 94, 96, 98, 99,
]);

export function validateNip11(doc: NIP11Info | null | undefined): Nip11Validation {
  const issues: Nip11Issue[] = [];

  if (!doc) {
    return {
      valid: false,
      errors: [{ severity: 'error', field: 'document', message: 'No NIP-11 document available (relay did not respond to application/nostr+json)' }],
      warnings: [],
      infos: [],
      issueCount: 1,
    };
  }

  // ─── Errors (wrong types / clearly broken) ──────────────────────────────
  if (doc.supported_nips !== undefined) {
    if (!Array.isArray(doc.supported_nips)) {
      issues.push({ severity: 'error', field: 'supported_nips', message: 'supported_nips must be an array' });
    } else {
      const bad = doc.supported_nips.filter((n) => typeof n !== 'number' || !Number.isInteger(n) || n < 0);
      if (bad.length > 0) {
        issues.push({ severity: 'error', field: 'supported_nips', message: `Invalid NIP entries: ${bad.slice(0, 5).join(', ')}` });
      }
    }
  }

  if (doc.pubkey !== undefined && !HEX_64.test(doc.pubkey)) {
    issues.push({ severity: 'error', field: 'pubkey', message: 'pubkey is not a valid 64-char hex string' });
  }

  if (doc.name !== undefined && typeof doc.name !== 'string') {
    issues.push({ severity: 'error', field: 'name', message: 'name must be a string' });
  }

  // ─── Warnings (likely mistakes) ─────────────────────────────────────────
  if (doc.name && doc.name.length > 30) {
    issues.push({ severity: 'warning', field: 'name', message: `name is ${doc.name.length} chars (NIP-11 recommends < 30 to avoid truncation)` });
  }

  if (doc.icon && !URL_RE.test(doc.icon)) {
    issues.push({ severity: 'warning', field: 'icon', message: 'icon is not a valid http(s) URL' });
  }

  if (doc.software && !URL_RE.test(doc.software)) {
    issues.push({ severity: 'warning', field: 'software', message: 'software should be a URL to the project homepage (per NIP-11)' });
  }

  if (doc.supported_nips) {
    const unknown = doc.supported_nips.filter((n) => !KNOWN_NIPS.has(n));
    if (unknown.length > 0) {
      issues.push({ severity: 'warning', field: 'supported_nips', message: `Unknown/custom NIP numbers: ${unknown.slice(0, 8).join(', ')}${unknown.length > 8 ? '…' : ''}` });
    }
  }

  if (doc.limitation?.min_pow_difficulty !== undefined) {
    const pow = doc.limitation.min_pow_difficulty;
    if (typeof pow !== 'number' || pow < 0 || pow > 64) {
      issues.push({ severity: 'warning', field: 'limitation.min_pow_difficulty', message: `Unusual PoW difficulty: ${pow}` });
    }
  }

  // ─── Infos (recommendations) ────────────────────────────────────────────
  if (!doc.name) issues.push({ severity: 'info', field: 'name', message: 'Missing name — recommended for directory listings' });
  if (!doc.description) issues.push({ severity: 'info', field: 'description', message: 'Missing description — helps users understand the relay' });
  if (!doc.pubkey) issues.push({ severity: 'info', field: 'pubkey', message: 'Missing operator pubkey — reduces trust signals' });
  if (!doc.icon) issues.push({ severity: 'info', field: 'icon', message: 'Missing icon — relay will show a generic avatar' });
  if (!doc.software) issues.push({ severity: 'info', field: 'software', message: 'Missing software field — hides relay from software leaderboard' });
  if (!doc.supported_nips || doc.supported_nips.length === 0) {
    issues.push({ severity: 'info', field: 'supported_nips', message: 'No supported_nips listed — auto-tagging and filters won\'t work' });
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    infos,
    issueCount: errors.length + warnings.length,
  };
}
