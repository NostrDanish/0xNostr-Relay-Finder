# 0xRelayFinder — Custom Nostr Event Schema

## Overview

0xRelayFinder is a Nostr relay discovery application that stores all data on-chain using Nostr events. It uses a combination of existing NIPs and one custom event kind for its relay directory, community voting, auto-tagging, and admin moderation systems.

## Data Relays

All app data is published to and read from the full relay group:

**Our relays (always included):**
- `wss://relay.0xPrivacy.online` (primary)
- `wss://0xPrivacy.nostr1.com` (secondary)

**Public relays (for stability and discoverability):**
- `wss://relay.damus.io`
- `wss://relay.primal.net`
- `wss://nos.lol`
- `wss://relay.nostr.band`
- `wss://relay.snort.social`

**NIP-66 meta-relays (read-only, monitoring data + relay discovery):**
- `wss://relay.nostr.watch` (primary nostr.watch relay)
- `wss://relaypag.es` (Relaypages NIP-66 relay)
- `wss://monitorlizard.nostr1.com` (Monitor Lizard relay)

App data (submissions, votes, labels, etc.) is published to our relays + public relays. NIP-66 monitoring data is read from the meta-relays where monitors publish — including kind:30166 from **all monitors** (not just trusted ones), which powers automatic relay discovery: every observed `d` tag is a relay the network has health-checked, and is auto-imported into the directory with its real RTT/NIP/geohash data attached.

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

### kind:1985 — NIP-32 Label

Used for labeling relays with trust scores, categories, and moderation flags:

```json
{
  "kind": 1985,
  "content": "Trust score: 85/100",
  "tags": [
    ["L", "com.0xrelayfinder.trust"],
    ["l", "85", "com.0xrelayfinder.trust"],
    ["r", "wss://relay.example.com"]
  ]
}
```

**Namespaces used:**
- `com.0xrelayfinder.trust` — 0-100 trust score (trusted labelers only: owner + admins)
- `com.0xrelayfinder.category` — free-form categories like "fast", "reliable"
- `social.nos.ontology` — content moderation labels (moderators only)
- `ugc` — user-generated labels (anyone)

Labels from trusted labelers are highlighted in the UI and weighted in the health score.

---

### kind:1111 — NIP-22 Comment

Threaded relay reviews, scoped to the relay URL via NIP-73 `I` tags:

```json
{
  "kind": 1111,
  "content": "Rock-solid relay, 3 months without a hiccup.",
  "tags": [
    ["I", "wss://relay.example.com"],
    ["K", "web"],
    ["i", "wss://relay.example.com"],
    ["k", "web"]
  ]
}
```

Replies add a lowercase `e` tag pointing to the parent comment:

```json
{
  "kind": 1111,
  "content": "Agreed, best DM relay I've used.",
  "tags": [
    ["I", "wss://relay.example.com"],
    ["K", "web"],
    ["i", "wss://relay.example.com"],
    ["k", "web"],
    ["e", "<parent_comment_id>"],
    ["k", "1111"],
    ["p", "<parent_comment_author>"]
  ]
}
```

---

### kind:10012 — NIP-51 Favorite Relays List

The user's personal favorite relays (replaceable list):

```json
{
  "kind": 10012,
  "content": "",
  "tags": [
    ["relay", "wss://relay.damus.io"],
    ["relay", "wss://relay.primal.net"]
  ]
}
```

---

### kind:30002 — NIP-51 Relay Set

User-curated named relay collections (addressable, shareable):

```json
{
  "kind": 30002,
  "content": "",
  "tags": [
    ["d", "my-privacy-relays"],
    ["title", "My Privacy Relays"],
    ["description", "Hand-picked relays with strong privacy policies"],
    ["relay", "wss://relay.example.com"],
    ["relay", "wss://another.example.com"]
  ]
}
```

---

### kind:28934 / 28936 — NIP-43 Join / Leave Requests

**Join request** (sent to the relay, requires invite claim):

```json
{
  "kind": 28934,
  "content": "",
  "tags": [
    ["-"],
    ["claim", "<invite-code>"]
  ]
}
```

**Leave request** (revoke own access):

```json
{
  "kind": 28936,
  "content": "",
  "tags": [["-"]]
}
```

---

### kind:27235 — NIP-98 HTTP Auth

Used to authenticate NIP-86 Relay Management API calls:

```json
{
  "kind": 27235,
  "content": "",
  "tags": [
    ["u", "https://relay.example.com"],
    ["method", "POST"],
    ["payload", "<sha256-of-body>"]
  ]
}
```

Base64-encoded into the `Authorization: Nostr <base64>` header of the management API request.

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
- Provides: latency, uptime, capabilities, live status, geohash

### NIP-85 — Trusted Assertions (consumed)
- kind:30382 — operator pubkey WoT rank
- kind:30384 — relay submission event rank
- kind:30385 — relay URL trust rank
- kind:10040 — user's preferred assertion providers
- Default provider: nostr.band (`4fd5e210...`) — users can override via kind:10040
- Displayed as trust badges on relay cards and detail pages

### NIP-43 — Relay Access Metadata (consumed)
- kind:33534 — relay role definitions (from relay's `self` pubkey)
- kind:13534 — membership lists (from relay's `self` pubkey)
- kind:28935 — invite claims (ephemeral, from relay's `self` pubkey)
- kind:8000 / 8001 — member add/remove notifications

### NIP-86 — Relay Management API (consumed)
- HTTP JSON-RPC endpoint at the relay's URL
- `supportedmethods` probe detects support
- Authenticated via NIP-98 (kind:27235)
- Enables operator tools: ban/unban pubkeys, moderation queue, relay config

### NIP-89 — App Handler Discovery (consumed)
- kind:31989 — handler recommendations
- kind:31990 — handler info (supported kinds, URLs)
- Surfaces compatible apps for the event kinds a relay supports

### NIP-B7 — Blossom (consumed)
- kind:10063 — user's preferred Blossom servers
- NIP-94/96 in `supported_nips` indicates media capability
- Server health checks against `/upload` endpoint

### NIP-67 — EOSE Completeness Hint (verified)
- Checked during verification: does `EOSE` carry `["finish"]` / `["more"]` hints?

### NIP-77 — Negentropy Syncing (verified)
- Checked during verification: does the relay answer `NEG-OPEN` with `NEG-MSG`?

### NIP-65 — Relay List Metadata
- kind:10002 events
- Used to discover which relays users write to

### NIP-02 — Follow List
- kind:3 events
- Used to build the Web of Trust graph for vote weighting

### NIP-44 — Encrypted Payloads
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
| NIP-32 | Moderation |
| NIP-42 | Paid Access |
| NIP-43 | Invite-Only, Membership |
| NIP-50 | High Performance |
| NIP-51 | Lists |
| NIP-56 | Moderation |
| NIP-57 | Zaps |
| NIP-65 | Lists |
| NIP-66 | Monitoring |
| NIP-67 | High Performance |
| NIP-71 | Video, Images |
| NIP-72 | Communities |
| NIP-77 | High Performance, Sync |
| NIP-85 | Trust |
| NIP-86 | Operator Tools |
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
