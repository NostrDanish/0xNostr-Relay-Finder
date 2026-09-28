/**
 * NIP-66 Relay Data — The SOLE source of relay data in the directory.
 *
 * Every relay that appears in this app was discovered by the NIP-66 monitor
 * network (kind:30166 events) OR submitted by a real person and approved
 * by a moderator (kind:30078 events).
 *
 * There is ZERO synthetic data. No hardcoded uptimes. No estimated trust
 * scores. No fake sparklines. No "seed relays".
 *
 * If a relay isn't visible to monitors right now, it won't appear here
 * until it comes back online and a monitor checks it.
 *
 * ## Infrastructure Relays
 *
 * The app itself connects to a small set of relays for admin operations
 * (submissions, moderation, role management). These are defined in
 * src/lib/constants.ts under APP_RELAY_URLS and are NOT in the directory.
 * They are the plumbing — not the product.
 */

import type { RelayRecord, UseCaseTag, NIP66Data } from '@/types/relay';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS – UI helpers, not relay data
// ═══════════════════════════════════════════════════════════════════════════════

/** All valid use-case tags for filtering/submission (plain strings — used as UseCaseTag directly). */
export const USE_CASE_OPTIONS: UseCaseTag[] = [
  'General',
  'DMs',
  'Zaps',
  'Blossom',
  'Images',
  'Video',
  'Long Form',
  'Communities',
  'Marketplace',
  'Paid Access',
  'High Performance',
  'Privacy',
  'Censorship Resistant',
  'Archive',
  'Inbox',
  'Gaming',
];

/** Country codes for filter dropdowns. */
export const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'DE', name: 'Germany' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' },
  { code: 'CA', name: 'Canada' },
  { code: 'UK', name: 'United Kingdom' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'IS', name: 'Iceland' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'BR', name: 'Brazil' },
  { code: 'RU', name: 'Russia' },
  { code: 'CN', name: 'China' },
  { code: 'KR', name: 'South Korea' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'PL', name: 'Poland' },
  { code: 'RO', name: 'Romania' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'GR', name: 'Greece' },
  { code: 'PT', name: 'Portugal' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'IE', name: 'Ireland' },
  { code: 'ZA', name: 'South Africa' },
];

/**
 * NIP -> use-case tag mapping (same as autoTagger but inline here to keep
 * the data layer self-contained). Only inferred from real supported_nips.
 */
const NIP_TAGS: Record<number, UseCaseTag> = {
  4: 'DMs',
  17: 'DMs',
  23: 'Long Form',
  29: 'Communities',
  50: 'High Performance',
  57: 'Zaps',
  72: 'Communities',
  94: 'Blossom',
  96: 'Blossom',
  99: 'Marketplace',
};

function autoTags(nips: number[]): UseCaseTag[] {
  const tags = new Set<UseCaseTag>(['General']);
  for (const n of nips) {
    if (NIP_TAGS[n]) tags.add(NIP_TAGS[n]);
  }
  return Array.from(tags);
}

/**
 * Convert a NIP-66 monitor observation into a directory relay record.
 *
 * This is called for every kind:30166 event from the NIP-66 meta-relays.
 * The relay's NIP-11 document is embedded in the event content, giving us
 * real name, description, software, supported_nips — all straight from
 * the relay's own HTTP endpoint.
 */
export function observationToRecord(
  relayUrl: string,
  nip66: NIP66Data,
  nip11: { name?: string; description?: string; software?: string; supported_nips?: number[] } | undefined,
  rttMs: number | undefined,
  addedAt: number,
): RelayRecord {
  const nips = nip11?.supported_nips ?? [];

  let hostname = relayUrl;
  try {
    hostname = new URL(relayUrl.replace(/^wss?:\/\//, 'https://')).hostname || relayUrl;
  } catch { /* use relayUrl */ }

  const name = (nip11?.name ?? nip11?.software ?? hostname).slice(0, 60);
  const description = (nip11?.description ?? `Observed by NIP-66 monitor network.`).slice(0, 500);

  const blossomSupported = nips.includes(94) || nips.includes(96);

  return {
    id: relayUrl,
    url: relayUrl,
    name,
    description,
    nip11: {
      name: nip11?.name,
      description: nip11?.description,
      pubkey: undefined,
      software: nip11?.software,
      version: undefined,
      supported_nips: nips,
      limitation: undefined,
      icon: undefined,
    },
    useCases: autoTags(nips),
    priceTiers: [],
    countryCode: undefined,
    isFree: true,
    isOnline: true, // monitor observed it — it was online at that moment
    uptimePercent30d: 0, // unknown until history is computed
    uptimeSpark: [],
    avgLatencyMs: rttMs,
    lastChecked: Date.now(),
    addedAt,
    featured: false,
    trustScore: 0, // not scored — earned from community votes
    blossomSupported,
    nip66,
    importSources: [{ source: 'nip66', importedAt: Date.now(), fieldsUpdated: ['nip11', 'avgLatencyMs', 'isOnline', 'nip66'] }],
  };
}