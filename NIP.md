# 0xRelayFinder — Custom Nostr Event Schema

## Overview

0xRelayFinder is a Nostr relay discovery application that stores all data on-chain using Nostr events. It uses a combination of existing NIPs and one custom event kind for its relay directory, community voting, auto-tagging, and admin moderation systems.

## Data Relays

All app data is published to and read from:
- `wss://relay.0xPrivacy.online` (primary)
- `wss://0xPrivacy.nostr1.com` (secondary)

## App Owner

- **npub**: `npub1mzyv84a27q0n3d2s6e3l3yzxw209gcz0ydc06d0pup07juptpqesemalsu`
- **hex**: `d888c3d7aaf01f38b550d663f89046729e54604f2370fd35e1e05fe9702b0833`

---

## Event Kinds Used

### kind:30078 — NIP-78 App-Specific Addressable Event

Used for all app data storage with different d-tag prefixes:

#### Relay Submission
```json
{
  "kind": 30078,
  "content": "{\"url\":\"wss://relay.example.com\",\"name\":\"Example Relay\",\"description\":\"...\",\"nip11\":{...},\"useCases\":[\"General\",\"DMs\"],\"isFree\":true,\"submittedAt\":1234567890,\"submitterPubkey\":\"<hex>\",\"version\":\"1.0\"}",
  "tags": [
    ["d", "0xrelay:wss%3A%2F%2Frelay.example.com"],
    ["r", "wss://relay.example.com"],
    ["t", "relay-submission"],
    ["t", "0xnostrrelays"],
    ["t", "general"],
    ["t", "dms"],
    ["status", "pending"],
    ["pricing", "free"],
    ["alt", "Nostr relay directory submission for wss://relay.example.com"],
    ["encrypted_notes", "<nip44_ciphertext>"],
    ["p", "<app_pubkey_hex>"]
  ]
}
```

#### Approval Decision
```json
{
  "kind": 30078,
  "content": "{\"url\":\"wss://relay.example.com\",\"decision\":\"approved\",\"reason\":\"\",\"reviewedAt\":1234567890,\"reviewerPubkey\":\"<hex>\"}",
  "tags": [
    ["d", "0xapproval:<submission_event_id>"],
    ["e", "<submission_event_id>"],
    ["r", "wss://relay.example.com"],
    ["status", "approved"],
    ["t", "relay-approval"],
    ["alt", "Relay submission approved: wss://relay.example.com"]
  ]
}
```

#### Admin Role List
```json
{
  "kind": 30078,
  "content": "[\"<hex_pubkey_1>\",\"<hex_pubkey_2>\"]",
  "tags": [
    ["d", "0xadmin-roles"],
    ["t", "0xnostrrelays-roles"],
    ["alt", "0xNostrRelays role list: 0xadmin-roles"]
  ]
}
```
*Only publishable by the owner (`d888c3d7...`).*

#### Moderator Role List
```json
{
  "kind": 30078,
  "content": "[\"<hex_pubkey_1>\",\"<hex_pubkey_2>\"]",
  "tags": [
    ["d", "0xmod-roles"],
    ["t", "0xnostrrelays-roles"],
    ["alt", "0xNostrRelays role list: 0xmod-roles"]
  ]
}
```
*Only publishable by the owner or admins.*

---

### kind:7 — NIP-25 Reaction

Used for upvoting/downvoting relays:

```json
{
  "kind": 7,
  "content": "+",
  "tags": [
    ["r", "wss://relay.example.com"],
    ["t", "0xrelayfinder-vote"],
    ["alt", "Upvote for relay wss://relay.example.com"]
  ]
}
```

- `content: "+"` = upvote, `content: "-"` = downvote
- Votes are weighted by Web of Trust (WoT) proximity to the app owner
- Weight multipliers: Owner/Admin = 5x, Direct follow = 3x, 2nd degree = 2x, Everyone else = 1x

---

### kind:6683 — Relay Tag Proposal (Custom)

Used when users propose a use-case tag for a relay (e.g., "this relay is best for DMs"):

```json
{
  "kind": 6683,
  "content": "best-for-dms",
  "tags": [
    ["r", "wss://relay.example.com"],
    ["t", "relay-tag-proposal"],
    ["t", "best-for-dms"],
    ["alt", "Relay tag proposal: Best for DMs for wss://relay.example.com"]
  ]
}
```

- Content field contains the kebab-case tag being proposed
- One event per user per tag per relay (deduplication by content + pubkey + relay URL)
- WoT-weighted like upvotes

---

### kind:1984 — NIP-56 Report

Used for reporting relay issues:

```json
{
  "kind": 1984,
  "content": "Detailed description of the issue...",
  "tags": [
    ["r", "wss://relay.example.com"],
    ["e", "<submission_event_id>"],
    ["t", "relay-issue"],
    ["reason", "spam"]
  ]
}
```

---

## External NIPs Used

### NIP-11 — Relay Information Document
- Fetched over HTTPS from relay URL
- Used for auto-tagging based on supported NIPs, limitations, software
- Feeds the auto-tagger engine that maps NIPs → use-case tags

### NIP-66 — Relay Liveness Monitoring
- kind:30166 (Relay Discovery) — health data from monitors
- kind:10166 (Monitor Announcement) — monitor metadata
- Filtered by trusted monitor pubkeys
- Provides: latency, uptime, capabilities, live status

### NIP-65 — Relay List Metadata
- kind:10002 events
- Used to discover which relays users write to

### NIP-02 — Follow List
- kind:3 events
- Used to build the Web of Trust graph for vote weighting

### NIP-44 — Encrypted Direct Messages
- Used for encrypting private operator notes in relay submissions
- Encrypted to the app owner's pubkey

---

## Auto-Tagging System

The auto-tagger maps NIP support to use-case tags:

| NIP | Tags |
|-----|------|
| NIP-04 | DMs |
| NIP-17 | DMs, Privacy |
| NIP-23 | Long Form |
| NIP-29 | Communities |
| NIP-42 | Paid Access |
| NIP-50 | High Performance |
| NIP-57 | Zaps |
| NIP-71 | Video, Images |
| NIP-72 | Communities |
| NIP-94 | Blossom, Images |
| NIP-96 | Blossom, Images, Video |
| NIP-99 | Marketplace |

Additional heuristics:
- `payment_required: true` → Paid Access
- `auth_required: true` → Privacy
- `max_message_length >= 524288` → Images
- `max_subscriptions >= 50` → High Performance
- Software contains "strfry" → High Performance
- Software contains "blossom" → Blossom, Images

---

## Web of Trust (WoT) System

Vote weights are determined by distance from the app owner in the Nostr follow graph:

| Level | Description | Weight |
|-------|-------------|--------|
| 0 | App owner + admins + moderators | 5x |
| 1 | Directly followed by level 0 | 3x |
| 2 | Followed by level 1 users | 2x |
| 3 | Everyone else with a Nostr identity | 1x |

The WoT graph is built by querying kind:3 (Follow List) events for the trust anchors and their first-degree follows.
