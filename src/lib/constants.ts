/**
 * 0xRelayFinder — App Constants, Relay Config & Event Kinds
 *
 * All app data is stored on our dedicated relays and keyed by the owner's npub.
 * The system uses NIP-78 (kind:30078) for app-specific addressable data,
 * kind:7 (NIP-25 reactions) for upvotes/downvotes on relays,
 * kind:6683 for community tag proposals,
 * NIP-66 (kind:30166/10166) for live relay monitoring,
 * and NIP-11 for relay info documents.
 */

// ─── App Relays ───────────────────────────────────────────────────────────────
/** Our own relays — always included for writes and reads */
export const APP_RELAY_PRIMARY = 'wss://relay.0xPrivacy.online';
export const APP_RELAY_SECONDARY = 'wss://0xPrivacy.nostr1.com';

/**
 * Stable public relays we also publish to and read from.
 * This ensures data is always reachable even if our relays have downtime,
 * and gives us broad discoverability across the Nostr network.
 */
export const PUBLIC_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.nostr.band',
  'wss://relay.snort.social',
];

/**
 * Full relay group — ours + public.
 * All app data (submissions, votes, tags, roles) is published to ALL of these
 * and read from ALL of these. Our relays come first so they're prioritised.
 */
export const APP_RELAY_URLS = [
  APP_RELAY_PRIMARY,
  APP_RELAY_SECONDARY,
  ...PUBLIC_RELAYS,
];

/** Backwards compat alias — points to primary */
export const APP_RELAY_URL = APP_RELAY_PRIMARY;

// ─── App Identity (Owner) ─────────────────────────────────────────────────────
/**
 * The app owner's Nostr pubkey (hex).
 * npub1mzyv84a27q0n3d2s6e3l3yzxw209gcz0ydc06d0pup07juptpqesemalsu
 * Has ALL permissions: approve/reject, add/remove admins & mods, manage directory.
 */
export const OWNER_PUBKEY_HEX = 'd888c3d7aaf01f38b550d663f89046729e54604f2370fd35e1e05fe9702b0833';
export const OWNER_NPUB = 'npub1mzyv84a27q0n3d2s6e3l3yzxw209gcz0ydc06d0pup07juptpqesemalsu';

/** Backwards compat alias */
export const APP_PUBKEY_HEX = OWNER_PUBKEY_HEX;
export const APP_NPUB = OWNER_NPUB;

// ─── Roles ────────────────────────────────────────────────────────────────────
/**
 * Role hierarchy:
 *   owner  > admin  > moderator > user
 */
export type AppRole = 'owner' | 'admin' | 'moderator' | 'user';

export const ADMIN_ROLES_D_TAG = '0xadmin-roles';
export const MOD_ROLES_D_TAG = '0xmod-roles';

// ─── Event Kinds ──────────────────────────────────────────────────────────────
/**
 * kind:30078 — NIP-78 App-Specific Addressable Event
 * Used for: relay submissions, approval decisions, role lists, admin data
 */
export const KIND_RELAY_SUBMISSION = 30078;

/**
 * kind:1984 — NIP-56 Report
 * Used for flagging relay issues
 */
export const KIND_RELAY_REPORT = 1984;

/**
 * kind:7 — NIP-25 Reaction
 * Used for upvotes (+) and downvotes (-) on relay submission events.
 * Tags the relay submission event via `e` tag and relay URL via `r` tag.
 * Votes from users with higher WoT scores are weighted more.
 */
export const KIND_REACTION = 7;

/**
 * kind:6683 — Relay Tag Proposal (custom, regular event)
 * Used when users propose a use-case tag for a relay.
 * content = the tag being proposed (e.g. "dm-relay", "zap-relay", "blossom")
 * tags:
 *   ["r", "wss://relay.example.com"]       // relay URL
 *   ["t", "relay-tag-proposal"]             // for filtering
 *   ["t", "dm-relay"]                       // the proposed tag (kebab-case)
 *   ["alt", "Relay tag proposal: dm-relay for wss://relay.example.com"]
 */
export const KIND_RELAY_TAG_PROPOSAL = 6683;

/**
 * kind:30166 — NIP-66 Relay Discovery (from monitors)
 * kind:10166 — NIP-66 Monitor Announcement
 */
export const KIND_RELAY_DISCOVERY = 30166;
export const KIND_MONITOR_ANNOUNCEMENT = 10166;

/**
 * kind:10002 — NIP-65 Relay List Metadata
 * Used for discovering which relays a user publishes to.
 */
export const KIND_RELAY_LIST = 10002;

/**
 * kind:1985 — NIP-32 Labeling
 * Used for labeling relays with trust scores, categories, and quality assessments.
 * The `L` tag defines the namespace, `l` tag carries the label value.
 * Labels from trusted moderators are consumed and aggregated.
 */
export const KIND_LABEL = 1985;

/**
 * kind:30382 — NIP-85 Trusted Assertion (User)
 * Used for WoT-based relay operator trust scoring.
 */
export const KIND_TRUSTED_ASSERTION_USER = 30382;

/**
 * kind:30384 — NIP-85 Trusted Assertion (Addressable Event)
 * Used for WoT-based relay submission trust scoring.
 */
export const KIND_TRUSTED_ASSERTION_ADDRESSABLE = 30384;

/**
 * kind:30385 — NIP-85 Trusted Assertion (NIP-73 Identifier)
 * Used for relay URL trust scoring.
 */
export const KIND_TRUSTED_ASSERTION_EXTERNAL = 30385;

/**
 * kind:10040 — NIP-85 Trusted Provider List
 * Lists which trusted assertion providers a user follows.
 */
export const KIND_TRUSTED_PROVIDERS = 10040;

/**
 * kind:30002 — NIP-51 Relay Sets
 * Used for user-curated relay collections.
 */
export const KIND_RELAY_SET = 30002;

/**
 * kind:10012 — NIP-51 Relay Feeds
 * User's favorite relays list.
 */
export const KIND_FAVORITE_RELAYS = 10012;

/**
 * kind:10063 — NIP-B7 Blossom Servers
 * Lists Blossom media servers the user prefers.
 */
export const KIND_BLOSSOM_SERVERS = 10063;

/**
 * kind:1111 — NIP-22 Comment
 * Used for relay review comments, always scoped to a relay URL (I tag).
 */
export const KIND_COMMENT = 1111;

/**
 * kind:3 — Follow List
 * Used for WoT computation (follow graph).
 */
export const KIND_FOLLOW_LIST = 3;

/** d-tag prefixes */
export const RELAY_SUBMISSION_D_PREFIX = '0xrelay:';
export const APPROVAL_D_PREFIX = '0xapproval:';

// ─── NIP-66 Meta-Relays ───────────────────────────────────────────────────────
/**
 * Dedicated NIP-66 data relays where monitors publish kind:30166/10166 events.
 * Learned from nostr.watch's config (apps/gui/config/nip66-relays.json).
 * These are READ-ONLY sources for monitoring data — we never publish to them.
 */
export const NIP66_META_RELAYS = [
  'wss://relay.nostr.watch',
  'wss://relaypag.es',
  'wss://monitorlizard.nostr1.com',
];

/**
 * Relay group for NIP-66 monitoring data: meta-relays first (richest data),
 * then our app relays + big indexers as fallback.
 */
export const NIP66_DATA_RELAYS = [
  ...NIP66_META_RELAYS,
  APP_RELAY_PRIMARY,
  APP_RELAY_SECONDARY,
  'wss://relay.nostr.band',
  'wss://relay.damus.io',
  'wss://nos.lol',
];

// ─── NIP-66 Trusted Monitors ─────────────────────────────────────────────────
export const TRUSTED_MONITOR_PUBKEYS = [
  'cf45a6ba1363ad7ed213a078e710d24f2b7a9be1929acabb228084d29b3e08f8', // nostr.watch
  'a8e76c3ace7829f9ee44cf9293309e21a1824bf1e57631d00685a1ed0b0bd8a2', // alt monitor
  'febbaba219357c6c64adfa2e01789f274aa60e90c289938bfc80dd91facb3ea4', // secondary
];

// ─── Auto-Tag NIP Mapping ─────────────────────────────────────────────────────
/**
 * Maps supported NIP numbers to use-case tags.
 * When a relay's NIP-11 info reports supporting a NIP, these tags
 * are automatically inferred.
 */
export const NIP_TO_USE_CASE_MAP: Record<number, string[]> = {
  4:  ['DMs'],                          // NIP-04 Encrypted DMs (legacy)
  17: ['DMs', 'Privacy'],               // NIP-17 Private Direct Messages
  23: ['Long Form'],                    // NIP-23 Long-form content
  29: ['Communities'],                   // NIP-29 Relay-based groups
  32: ['Moderation'],                    // NIP-32 Labeling
  42: ['Paid Access'],                   // NIP-42 Auth (often for paid)
  43: ['Invite-Only', 'Membership'],     // NIP-43 Membership/access requests
  50: ['High Performance'],              // NIP-50 Search (indicates indexing capability)
  51: ['Lists'],                         // NIP-51 Lists (relays sets, etc.)
  56: ['Moderation'],                    // NIP-56 Reporting
  57: ['Zaps'],                          // NIP-57 Lightning Zaps
  65: ['Lists'],                         // NIP-65 Relay List Metadata
  66: ['Monitoring'],                    // NIP-66 Relay Discovery
  67: ['High Performance'],              // NIP-67 EOSE Completeness
  71: ['Video', 'Images'],               // NIP-71 Video events
  72: ['Communities'],                   // NIP-72 Moderated communities
  77: ['High Performance', 'Sync'],      // NIP-77 Negentropy Syncing
  85: ['Trust'],                         // NIP-85 Trusted Assertions
  86: ['Operator Tools'],                // NIP-86 Relay Management API
  94: ['Blossom', 'Images'],             // NIP-94 File metadata
  96: ['Blossom', 'Images', 'Video'],    // NIP-96 HTTP File Storage
  99: ['Marketplace'],                   // NIP-99 Classified Listings
  100: ['Lists'],                        // NIP-10010 Membership lists (NIP-43)
};

/**
 * Maps NIP-11 limitation fields to use-case tags.
 */
export const LIMITATION_TO_USE_CASE: Record<string, string[]> = {
  'payment_required': ['Paid Access'],
  'auth_required': ['Privacy'],
  'restricted_writes': ['Privacy'],
};

/**
 * Maps NIP-66 capabilities to use-case tags.
 */
export const CAPABILITY_TO_USE_CASE: Record<string, string[]> = {
  'blossom': ['Blossom', 'Images'],
};

// ─── Use-Case Tag Definitions ─────────────────────────────────────────────────
/**
 * All valid use-case tags with descriptions and the NIPs that trigger them.
 * Used for both auto-tagging and user-proposed tags.
 */
export const USE_CASE_DEFINITIONS: Record<string, { label: string; description: string; auto: boolean }> = {
  'General':              { label: 'General',              description: 'Everyday Nostr usage: notes, follows, feeds', auto: false },
  'DMs':                  { label: 'DMs',                  description: 'Optimized for encrypted direct messages (NIP-04, NIP-17)', auto: true },
  'Zaps':                 { label: 'Zaps',                 description: 'Lightning zap support (NIP-57)', auto: true },
  'Blossom':              { label: 'Blossom',              description: 'Blossom media server / NIP-94/96 file storage', auto: true },
  'Images':               { label: 'Images',               description: 'Image hosting and NIP-94 file metadata', auto: true },
  'Video':                { label: 'Video',                description: 'Video content and NIP-71 video events', auto: true },
  'Long Form':            { label: 'Long Form',            description: 'NIP-23 long-form articles and blogs', auto: true },
  'Communities':          { label: 'Communities',          description: 'NIP-29 groups or NIP-72 moderated communities', auto: true },
  'Marketplace':          { label: 'Marketplace',          description: 'NIP-99 classified listings and commerce', auto: true },
  'Paid Access':          { label: 'Paid Access',          description: 'Requires payment or NIP-42 auth for access', auto: true },
  'High Performance':     { label: 'High Performance',     description: 'Optimized for speed, search (NIP-50), negentropy sync (NIP-77), high throughput', auto: true },
  'Privacy':              { label: 'Privacy',              description: 'Privacy-focused with auth, restricted writes, or GDPR', auto: true },
  'Censorship Resistant': { label: 'Censorship Resistant', description: 'Minimal moderation, free speech policies', auto: false },
  'Archive':              { label: 'Archive',              description: 'Long-term event storage and historical data', auto: false },
  'Inbox':                { label: 'Inbox',                description: 'Personal inbox relay for mentions and DMs', auto: false },
  'Gaming':               { label: 'Gaming',               description: 'Gaming-related events and real-time data', auto: false },
  'Moderation':           { label: 'Moderation',           description: 'NIP-32 labeling, NIP-56 reporting, NIP-86 management API', auto: true },
  'Invite-Only':          { label: 'Invite-Only',          description: 'NIP-43 membership-based access requiring invites', auto: true },
  'Membership':           { label: 'Membership',           description: 'NIP-43 membership lists and role-based access', auto: true },
  'Lists':                { label: 'Lists',                description: 'NIP-51 relay sets, NIP-65 relay lists, favorites', auto: true },
  'Monitoring':           { label: 'Monitoring',           description: 'NIP-66 liveness monitoring and relay discovery', auto: true },
  'Trust':                { label: 'Trust',                description: 'NIP-85 trusted assertions and WoT scoring', auto: true },
  'Sync':                 { label: 'Sync',                 description: 'NIP-77 negentropy syncing for efficient data transfer', auto: true },
  'Operator Tools':       { label: 'Operator Tools',       description: 'NIP-86 relay management API for operators', auto: true },
};

// ─── Fallback Seed Relays ─────────────────────────────────────────────────────
/** Same as PUBLIC_RELAYS — exported under legacy name for backwards compat */
export const SEED_RELAYS = PUBLIC_RELAYS;

// ─── CORS Proxy ───────────────────────────────────────────────────────────────
export const CORS_PROXY_TEMPLATE = 'https://proxy.shakespeare.diy/?url={href}';
export function corsProxy(url: string): string {
  return CORS_PROXY_TEMPLATE.replace('{href}', encodeURIComponent(url));
}
