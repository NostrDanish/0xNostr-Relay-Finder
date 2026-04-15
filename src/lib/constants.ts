/**
 * 0xNostrRelayFinder — App Constants & Role System
 */

// ─── App Relay ────────────────────────────────────────────────────────────────
/** Our dedicated relay for storing submissions, approvals, and role events */
export const APP_RELAY_URL = 'wss://0xPrivacy.nostr1.com';

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
 *
 * owner:     All permissions. Hard-coded to OWNER_PUBKEY_HEX. Cannot be revoked.
 * admin:     Approve/reject submissions, read encrypted reports, add/remove mods.
 *            Stored as kind:30078 with d="0xadmin-roles" by OWNER.
 * moderator: Approve/reject submissions, read reports (not encrypted).
 *            Stored as kind:30078 with d="0xmod-roles" by OWNER or admins.
 */
export type AppRole = 'owner' | 'admin' | 'moderator' | 'user';

/**
 * Addressable event d-tags for role lists.
 * Published by the owner to the app relay.
 * kind:30078, d="0xadmin-roles"  → content = JSON array of hex pubkeys
 * kind:30078, d="0xmod-roles"    → content = JSON array of hex pubkeys
 */
export const ADMIN_ROLES_D_TAG = '0xadmin-roles';
export const MOD_ROLES_D_TAG = '0xmod-roles';

// ─── Event Kinds ──────────────────────────────────────────────────────────────
/**
 * kind:30078 — NIP-78 App-Specific Addressable Event
 *
 * Used for:
 *  • Relay submissions  d-tag = "0xrelay:<url_encoded>"
 *    tags: r, t(relay-submission), status(pending|approved|rejected), alt
 *    encrypted_notes tag = NIP-44 ciphertext to owner pubkey
 *
 *  • Admin role list    d-tag = "0xadmin-roles"
 *    content = JSON.stringify([hex_pubkey, ...])  (published by owner only)
 *
 *  • Mod role list      d-tag = "0xmod-roles"
 *    content = JSON.stringify([hex_pubkey, ...])  (published by owner or admin)
 *
 *  • Approval decision  d-tag = "0xapproval:<event_id>"
 *    tags: e(submission_event_id), status(approved|rejected), r(relay_url)
 *    Published by owner/admin/mod
 *
 * kind:1984 — NIP-56 Report
 *  Used for flagging relay issues
 *  tags: e(submission_id), r(relay_url), t(relay-issue), reason
 */
export const KIND_RELAY_SUBMISSION = 30078;
export const KIND_RELAY_REPORT = 1984;

/** d-tag prefixes */
export const RELAY_SUBMISSION_D_PREFIX = '0xrelay:';
export const APPROVAL_D_PREFIX = '0xapproval:';

/** Fallback seed relays for broader discovery */
export const SEED_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
];
