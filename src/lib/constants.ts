/**
 * 0xNostrRelayFinder app constants
 */

/** Our dedicated relay for storing relay submissions and directory sync */
export const APP_RELAY_URL = 'wss://0xPrivacy.nostr1.com';

/**
 * The app's own Nostr pubkey (hex).
 * Used as the recipient for NIP-44 encrypted submission data.
 * npub1mzyv84a27q0n3d2s6e3l3yzxw209gcz0ydc06d0pup07juptpqesemalsu
 */
export const APP_PUBKEY_HEX = 'd888c3d7aaf01f38b550d663f89046729e54604f2370fd35e1e05fe9702b0833';

export const APP_NPUB = 'npub1mzyv84a27q0n3d2s6e3l3yzxw209gcz0ydc06d0pup07juptpqesemalsu';

/**
 * Nostr event kinds used by this app:
 *
 * kind:30078 — NIP-78 App-Specific Addressable Event
 *   Used for:
 *   - Relay submissions: d-tag = "0xrelay:<encoded_url>"
 *   - Public relay info (NIP-11 snapshot + use-cases + pricing)
 *   - The content is JSON with public relay data
 *
 * Tags on relay submission events:
 *   ["d", "0xrelay:<url_encoded>"]        — addressable identifier
 *   ["r", "<wss_url>"]                    — relay URL (indexed, queryable)
 *   ["t", "relay-submission"]             — category tag
 *   ["t", "<use_case>"]                   — one per use case tag
 *   ["status", "pending"|"approved"|"rejected"]
 *   ["alt", "Nostr relay directory submission"]  — NIP-31 human readable
 *
 * kind:1984 — NIP-56 Reporting
 *   Used for flagging relay issues / moderation requests
 *   ["e", <submission_event_id>]          — references the submission
 *   ["r", "<wss_url>"]                    — relay URL
 *   ["t", "relay-issue"]
 *
 * kind:7 — Reactions (NIP-25)
 *   Used for community upvotes on relay submissions
 */
export const KIND_RELAY_SUBMISSION = 30078;
export const KIND_RELAY_REPORT = 1984;

/** d-tag prefix for relay submission addressable events */
export const RELAY_SUBMISSION_D_PREFIX = '0xrelay:';

/** Fallback relays for querying the directory (in addition to APP_RELAY_URL) */
export const SEED_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
];
