# 0xNostrRelays --- User Guide

A complete walkthrough of every feature in the relay directory.

---

## Table of Contents

1. [Browsing & Searching Relays](#1-browsing--searching-relays)
2. [Understanding Relay Cards](#2-understanding-relay-cards)
3. [Relay Detail Page](#3-relay-detail-page)
4. [NIP Verification (Testing Relay Claims)](#4-nip-verification)
5. [Health Score Explained](#5-health-score-explained)
6. [Adding Relays to Your List](#6-adding-relays-to-your-list)
7. ["Fix My Nostr" Diagnostic Wizard](#7-fix-my-nostr-diagnostic-wizard)
8. ["Best Relay for Me" Quiz](#8-best-relay-for-me-quiz)
9. [Relay Software Leaderboard](#9-relay-software-leaderboard)
10. [Relay Graveyard](#10-relay-graveyard)
11. [Submitting a New Relay](#11-submitting-a-new-relay)
12. [Community Voting](#12-community-voting)
13. [Admin Moderation Dashboard](#13-admin-moderation-dashboard)
14. [Nostr Protocol API](#14-nostr-protocol-api)
15. [Nostr Atlas (World Map)](#15-nostr-atlas-world-map)
16. [Relay Sets & Favorites](#16-relay-sets--favorites)
17. [Labels, Trust & Comments](#17-labels-trust--comments)
18. [Membership & Operator Tools](#18-membership--operator-tools)
19. [Protocol Coverage Page](#19-protocol-coverage-page)

---

## 1. Browsing & Searching Relays

### Home Page

The home page shows:
- **Live network stats** --- total relays, online count, average latency, free relays, countries represented, and NIP support counts --- all updated in real time
- **Featured relays** --- hand-picked for reliability
- **Highest uptime relays** --- sorted by 30-day uptime percentage
- **Browse by use case** --- click any use-case badge to filter the full directory
- **Quick filters** --- one-click links for "Free Relays", "High Uptime", "Privacy Focused", etc.

### Explore Page (`/relays`)

The full relay directory with:
- **Text search** --- search by name, URL, description, NIP support, or use-case tags
- **Use case filter** --- General, DMs, Zaps, Blossom, Privacy, Communities, etc.
- **Pricing filter** --- Free / Paid / Any
- **Uptime filter** --- minimum uptime percentage slider
- **NIP filter** --- select required NIPs (NIP-50 Search, NIP-17 DMs, etc.)
- **Country filter** --- filter by relay location
- **Special filters** --- Online only, Blossom only, NIP-66 enriched only
- **Sort options** --- by uptime, trust score, newest, alphabetical, community votes
- **Grid / List toggle** --- two layout options

### URL Parameters

You can deep-link into the directory with query parameters:
```
/relays?q=damus              # search "damus"
/relays?pricing=free          # free relays only
/relays?useCase=Privacy       # privacy-focused relays
/relays?minUptime=99          # 99%+ uptime
/relays?nip66Only=true        # only NIP-66 enriched relays
/relays?blossomOnly=true      # only Blossom-enabled relays
```

---

## 2. Understanding Relay Cards

Each relay card shows:

| Element | Meaning |
|---------|---------|
| Green dot (pulsing) | Relay is online |
| Red dot | Relay is offline |
| Sparkline chart | 14-point uptime history (green = up, red = down) |
| Uptime badge | 30-day uptime percentage with color coding |
| Use-case badges | What the relay is optimized for |
| NIP badges | Key supported NIPs (NIP-50 Search, NIP-42 Auth, etc.) |
| Blossom badge | Relay supports Blossom media uploads |
| NIP-66 badge | Real-time health data from an official monitor |
| Trust badge (shield) | NIP-32/NIP-85 trust score (0-100) from moderators or WoT providers |
| Community tags | Most-voted community labels |
| Country flag | Where the relay is hosted |
| Latency | Average round-trip time in milliseconds |
| Heart button | Add/remove from your NIP-51 favorites (kind:10012) |
| "Add to Relays" button | One-click add to your NIP-65 relay list |

---

## 3. Relay Detail Page

Click any relay card to see its full detail page. The page has multiple tabs:

### Overview Tab
- **NIP-11 Relay Information** --- name, software, version, contact, pubkey
- **Limitations & Policies** --- message size limits, auth requirements, posting policy
- **Live Connection Test** --- open a real WebSocket to the relay and measure latency
- **What This Relay Is Best For** --- detailed use-case descriptions
- **Health Score** --- transparent 100-point score with full breakdown (see section 5)
- **Operator Profile** --- if the relay operator published a NIP-11 pubkey, their Nostr profile is displayed (avatar, name, bio, Lightning address)

### Verify Tab
See [NIP Verification](#4-nip-verification) below.

### Uptime Tab
- 30-day uptime percentage, average latency, trust score
- Uptime history chart (Recharts visualization)
- 14-point recent check sparkline with hover tooltips

### NIP-66 Tab
- Live data from NIP-66 monitors (nostr.watch-style)
- RTT Open / Read / Write measurements
- Network type (clearnet, tor)
- Relay type, events per day, connected users
- Geolocation from geohash (latitude/longitude)
- Monitor requirements (auth, payment, PoW, writes)
- Capabilities matrix
- NIP-66/NIP-11 conflict detection

### Community Tab
- **Voting panel** --- upvote relays for specific use-case tags
- Relay.tools one-click integration link (when available)

### Comments Tab (NIP-22)
- **Threaded reviews** --- signed by your Nostr identity, no fake reviews
- **Nested replies** --- up to 3 levels deep
- Comments are scoped to the relay URL via NIP-73 `I` tags, so they're portable across apps

### Labels Tab (NIP-32 + NIP-85)
- **Trusted assertion score** --- WoT-based 0-100 score from providers like nostr.band
- **Categories** --- community-applied labels ("fast", "reliable", "dm-friendly")
- **Moderation labels** --- content policy flags from moderators
- **Add labels** --- logged-in users can apply category/UGC labels; moderators can set trust scores

### Membership Tab (NIP-43 + NIP-86)
- **Membership status** --- see if you're a member, member count, and roles
- **Join with invite code** --- claim-based admission for invite-only relays
- **Request invite** --- ask the relay for a claim (kind:28935)
- **Leave relay** --- revoke your own access (kind:28936)
- **Operator tools** --- if the relay supports NIP-86 and you're authenticated, ban/unban pubkeys and manage the relay directly

### Auto-Tags Tab
- Shows which use-case tags were automatically inferred from NIP support
- Explains the mapping: NIP-17 -> DMs + Privacy, NIP-50 -> High Performance, etc.

### NIPs Tab
- Full list of supported NIPs with links to the NIP specification on GitHub
- Each NIP shows its human-readable name
- **Compatible Apps (NIP-89)** --- find apps that handle the event kinds this relay supports
- **Blossom Servers (NIP-B7)** --- health status of associated media servers (when supported)

### Pricing Tab
- Price tiers with features, billing period, and payment links
- Free and paid tiers shown side by side

### Add to Client Tab
- Step-by-step instructions for adding the relay to Damus, Primal, Snort, and Amethyst
- Relay URL with one-click copy button

---

## 4. NIP Verification

This is what makes 0xRelays-Finder unique. Instead of trusting a relay's self-reported NIP support, we **actually test it**.

### How It Works

1. Go to any relay's detail page
2. Click the **"Verify"** tab
3. Click **"Verify NIP Support"**
4. The tool opens a live WebSocket connection to the relay
5. For each testable NIP, it sends a targeted test message and checks the response

### What Gets Tested

| NIP | Test Method | What We Check |
|-----|------------|---------------|
| NIP-01 (Basic Protocol) | Send `REQ` with `{kinds:[1], limit:1}` | Relay returns `EVENT` or `EOSE` |
| NIP-13 (Proof of Work) | Send `EVENT` with `nonce` tag | Relay validates PoW difficulty |
| NIP-15 (EOSE) | Send `REQ` with `{kinds:[0], limit:0}` | Relay sends `EOSE` marker |
| NIP-20 (Command Results) | Send invalid `EVENT` | Relay responds with `OK` (accepted or rejected) |
| NIP-42 (Authentication) | Wait after connection | Relay sends `AUTH` challenge within 2 seconds |
| NIP-43 (Membership) | Send kind:28934 join request | Relay responds with membership-aware `OK` |
| NIP-45 (Counting) | Send `COUNT` request | Relay responds with count object |
| NIP-50 (Search) | Send `REQ` with `search` filter | Relay doesn't immediately close/error |
| NIP-67 (EOSE Hints) | Send `REQ`, inspect `EOSE` | `EOSE` carries `["finish"]` / `["more"]` hints |
| NIP-77 (Negentropy) | Send `NEG-OPEN` | Relay responds with `NEG-MSG` |
| NIP-86 (Management API) | HTTP POST `supportedmethods` | Relay answers the management RPC |

### Result States

- **Verified** (green checkmark) --- relay was tested and the NIP works correctly
- **Failed** (red X) --- relay claims to support this NIP but the test failed
- **No test** (grey) --- this NIP cannot be automatically tested from the browser
- **Pending** (outline) --- not yet tested

### Verification Score

After testing, a percentage score is calculated: `verified / (verified + failed) * 100`. This tells you what fraction of testable NIPs actually work.

---

## 5. Health Score Explained

Every relay receives a transparent health score from 0 to 100, broken into 9 components (v2 — NIP-enhanced):

| Component | Max Points | How It's Calculated |
|-----------|-----------|-------------------|
| **30-Day Uptime** | 25 | Direct mapping: 100% uptime = 25 points |
| **Latency** | 15 | Under 50ms = 15 pts, over 2000ms = 0 pts, linear scale |
| **NIP-11 Completeness** | 10 | 2 pts each for name, description, contact; 1 pt for icon, software; 2 pts for having NIPs listed |
| **Community Trust** | 10 | Up to 5 pts from WoT-weighted votes, 3 pts from NIP-32 trusted labels, 2 pts from NIP-85 assertions |
| **NIP Support Breadth** | 10 | 0.5 point per supported NIP, max 10 (20+ NIPs) |
| **Operator Verification** | 10 | 4 pts for NIP-11 pubkey, 3 pts for NIP-66 monitoring, 2 pts for website, 1 pt for ToS |
| **Membership Features** | 5 | 2 pts for members list, 2 pts for roles, 1 pt for invite system (NIP-43) |
| **Advanced Protocol** | 5 | 1.5 pts NIP-67 EOSE hints, 2 pts NIP-77 negentropy, 1.5 pts NIP-86 management API |
| **Directory Age** | 5 | 1 point per month in the directory, max 5 |

### Letter Grades

| Score | Grade |
|-------|-------|
| 90--100 | A |
| 80--89 | B |
| 65--79 | C |
| 50--64 | D |
| 0--49 | F |

The full breakdown with progress bars is visible on every relay's detail page under the Overview tab.

---

## 6. Adding Relays to Your List

### Requirements
- A Nostr browser signer extension (nos2x, Alby, etc.)
- Log in to 0xNostrRelays using your Nostr account

### How to Add

1. Find a relay you want to use
2. Click the **"Add to My Relays"** button (appears on every relay card and detail page)
3. Choose one of:
   - **Read + Write** (most common) --- you'll publish to and read from this relay
   - **Read only** --- you'll read from this relay but not publish to it
   - **Write only** --- you'll publish to this relay but not read from it
4. The app publishes a new `kind:10002` event with your updated relay list

### Managing Your Relay List

When a relay is already in your list, the button changes to **"In My Relays"** with a dropdown:
- Toggle **Read** on/off
- Toggle **Write** on/off
- **Remove from list** --- takes the relay out of your kind:10002

Every change publishes a new kind:10002 event signed by your browser extension.

---

## 7. "Fix My Nostr" Diagnostic Wizard

Navigate to `/lookup` or click "Fix My Nostr" on the home page.

### What It Accepts

- **npub** --- `npub1abc123...`
- **nprofile** --- `nprofile1...`
- **NIP-05 address** --- `user@domain.com` (resolved via `/.well-known/nostr.json`)
- **Hex pubkey** --- 64-character hex string

### Diagnostic Steps

1. **Resolve Identity** --- decodes the input to a hex pubkey (including NIP-05 HTTP resolution)
2. **Fetch Relay List** --- queries kind:10002 from 7+ relays in parallel
3. **Show Profile** --- displays the user's name, avatar, and NIP-05
4. **Summary Stats** --- total relays, read relays, write relays, last updated
5. **Health Diagnostic** --- generates specific, actionable warnings:

| Severity | Example Warning |
|----------|----------------|
| Critical | All relays are offline --- nobody can reach you |
| Critical | No write relays --- you can't publish |
| Critical | No read relays --- you can't receive DMs |
| Warning | Only 1 relay (single point of failure) |
| Warning | All relays require payment (limits audience) |
| Warning | No relays with NIP-17 DM support |
| Warning | Low geographic diversity (all same country) |
| Info | Many relays configured (may slow down clients) |
| OK | 3+ relays online --- good coverage |
| OK | Balanced read/write config |
| OK | DM support available |

6. **Relay Table** --- each relay shown with: URL, read/write flags, online/offline status, latency, sparkline, link to detail page
7. **Suggested Relays** --- if the score is below 90, recommends free, high-uptime relays from the directory with one-click add buttons

---

## 8. "Best Relay for Me" Quiz

Navigate to `/recommend` or click "Find Your Perfect Relay" on the home page.

### The 3 Questions

**Step 1 --- Use Case**
| Option | What It Means |
|--------|--------------|
| General Chat | Notes, feeds, social interactions |
| Direct Messages | Private conversations, NIP-17 |
| Long-Form Content | Articles, blogs, NIP-23 |
| Images & Video | Blossom, NIP-94/96 media |
| Communities | Groups, moderated spaces |

**Step 2 --- Pricing**
| Option | Filter Applied |
|--------|---------------|
| Free Only | `isFree === true` |
| Happy to Pay | `isFree === false` |
| Either is Fine | No pricing filter |

**Step 3 --- Privacy**
| Option | Filter Applied |
|--------|---------------|
| Public is Fine | No privacy filter |
| Prefer Auth | Relays with auth_required or Privacy use case |
| Maximum Privacy | Same as above, prioritised |

### Scoring

After answering, each relay in the directory is scored based on:
- **Use case match** --- NIPs that match your selected use case (NIP-17 for DMs, NIP-23 for long-form, etc.)
- **Use case tag match** --- relay's use-case tags matching your selection
- **Uptime** --- higher uptime = higher score
- **Latency bonus** --- sub-100ms relays get a boost
- **NIP-66 bonus** --- monitored relays get a small boost

The top 5 results are shown as cards with:
- Relay name, URL, online status
- Why it was recommended (specific reasons)
- Uptime, latency, NIP count stats
- Sparkline chart
- "Add to Relays" button for one-click adding

---

## 9. Relay Software Leaderboard

Navigate to `/software` or click "Relay Software" in the navigation.

### What It Shows

The leaderboard aggregates the `software` field from each relay's NIP-11 document and groups relays by implementation:

| Metric | Meaning |
|--------|---------|
| **Relay Count** | How many relays run this software |
| **Online %** | What fraction of relays running this software are currently online |
| **Avg Uptime** | Average 30-day uptime across all relays |
| **Avg Latency** | Average round-trip time |
| **Avg NIPs** | Average number of supported NIPs |
| **Versions** | Which versions are in use |

### Known Software

The leaderboard recognises and links to repositories for:
- **strfry** --- high-performance C++ relay
- **nostr-rs-relay** --- popular Rust implementation
- **nostream** --- TypeScript/Node.js relay
- **khatru** --- Go relay framework
- **Ditto** --- Nostr server with ActivityPub bridge
- **Blossom Server** --- media-focused relay

Each software entry can be expanded to show individual relays running that implementation, with links to their detail pages.

---

## 10. Relay Graveyard

Navigate to `/graveyard` or click "Relay Graveyard" on the home page.

The Graveyard is a memorial for relays that have gone permanently offline:

- **Criteria**: relay is offline AND no NIP-66 monitor event in the last 30 days
- **Tombstone cards** show: relay name, URL, when it was added, when it was last seen, how long it's been dead
- **Search** dead relays by name or URL
- **Sort** by: most recently died, longest dead, alphabetical

---

## 11. Submitting a New Relay

Navigate to `/submit` and log in with your Nostr browser extension.

### Submission Form

1. Enter the relay **WSS URL** (e.g., `wss://relay.example.com`)
2. The form auto-fetches the relay's **NIP-11 document** and pre-fills fields
3. Add a **name** and **description**
4. Select **use cases** (General, DMs, Privacy, etc.)
5. Set **pricing** (Free or Paid, with price if applicable)
6. Optionally attach **encrypted notes** for moderators (NIP-44 encrypted to the app owner)
7. Click **Submit**

### What Happens Next

1. A `kind:30078` event is published to all app relays, tagged with `relay-submission`
2. The relay appears in the admin dashboard under "Pending"
3. An admin or moderator reviews and approves or rejects it
4. Once approved, the relay appears in the public directory
5. The relay is probed for liveness and enriched with NIP-66 and NIP-11 data

---

## 12. Community Voting

### Upvoting Relays

On any relay's detail page (Community tab), you can vote for use-case tags:
- Click a tag like "Best for DMs" or "High Reliability"
- Your vote is published as a `kind:7` reaction event
- Votes are weighted by Web of Trust:

| WoT Level | Weight |
|-----------|--------|
| Owner / Admin / Mod | 5x |
| Directly followed by owner | 3x |
| 2nd-degree follow | 2x |
| Everyone else | 1x |

### Tag Proposals

Users can propose new use-case tags for relays via `kind:6683` events. These appear in the moderation queue for admin review.

---

## 13. Admin Moderation Dashboard

Navigate to `/dashboard` (requires moderator, admin, or owner role).

### Role Hierarchy

| Role | Permissions |
|------|------------|
| **Owner** | Everything. Add/remove admins and mods. Manage role lists. |
| **Admin** | Approve/reject submissions. Add/remove mods. Read reports. Remove approved relays. |
| **Moderator** | Approve/reject submissions. Read reports. |
| **User** | Submit relays. Vote on tags. |

### Dashboard Tabs

- **Queue** --- pending submissions awaiting review (with approve/reject buttons)
- **Approved** --- all approved relays (with remove option)
- **Rejected** --- rejected submissions
- **Reports** --- kind:1984 abuse reports from users
- **Roles** --- add/remove admins and moderators (owner only)
- **Stats** --- directory overview, app relay info, quick actions

### How Approval Works

1. Moderator clicks "Approve" or "Reject" on a submission
2. A new `kind:30078` approval event is published with `["t", "relay-approval"]`
3. The approval event references the original submission via an `e` tag
4. The live directory re-queries and merges the decision
5. Approved relays appear in the public directory; rejected ones are hidden

---

## 14. Nostr Protocol API

Navigate to `/api` for full documentation on querying the directory via Nostr.

### Direct WebSocket Query

All directory data is stored as standard Nostr events. Connect to any of these relays with a WebSocket:

```
wss://relay.0xPrivacy.online
wss://0xPrivacy.nostr1.com
wss://relay.damus.io
wss://relay.primal.net
wss://nos.lol
wss://relay.nostr.band
wss://relay.snort.social
```

### Example Queries

**Get all relay submissions:**
```json
["REQ", "subs", {"kinds": [30078], "#t": ["relay-submission"], "limit": 50}]
```

**Get approved submissions only:**
```json
["REQ", "approved", {"kinds": [30078], "#t": ["relay-approval"], "limit": 50}]
```

**Get community votes for a relay:**
```json
["REQ", "votes", {"kinds": [7], "#r": ["wss://relay.example.com"], "limit": 50}]
```

**Get tag proposals:**
```json
["REQ", "tags", {"kinds": [6683], "#r": ["wss://relay.example.com"], "limit": 20}]
```

**Get abuse reports:**
```json
["REQ", "reports", {"kinds": [1984], "#t": ["relay-issue"], "limit": 20}]
```

**Get relay labels (NIP-32):**
```json
["REQ", "labels", {"kinds": [1985], "#r": ["wss://relay.example.com"], "limit": 50}]
```

**Get relay comments (NIP-22):**
```json
["REQ", "comments", {"kinds": [1111], "#I": ["wss://relay.example.com"], "limit": 100}]
```

**Get relay sets (NIP-51):**
```json
["REQ", "sets", {"kinds": [30002], "limit": 50}]
```

No API keys. No rate limits. No authentication required. Fully decentralised.

See [NIP.md](./NIP.md) for the complete event schema with field-by-field documentation.

---

## 15. Nostr Atlas (World Map)

Navigate to `/atlas` or click "Atlas" in the navbar.

The Atlas is a dependency-free SVG world map showing every geolocated relay:

- **Color-coded markers** --- green (healthy), yellow (slow, >250ms), red (offline)
- **Clustering** --- zoomed out, nearby relays group into numbered clusters; zoom in to see individual markers
- **Pan & zoom** --- drag to pan, scroll wheel or +/- buttons to zoom
- **Click a marker** --- popup with relay details (uptime, latency, NIPs, software) and a link to the full page
- **Filters** --- status, software, country, features (auth, payment, Blossom, NIP-66)
- **Stats bar** --- mapped relays, online/slow/offline counts, countries represented

Geolocation comes from NIP-66 monitor geohashes --- no tile servers, no tracking, fully self-contained.

---

## 16. Relay Sets & Favorites

### Favorites (kind:10012)

Click the **heart icon** on any relay card or detail page. Your favorites are published as a public NIP-51 list and sync across any client that reads kind:10012.

### Relay Sets (kind:30002)

Navigate to `/sets` to browse community-curated relay collections:

- **Create a set** --- pick a unique ID, title, description, and select relays from the directory
- **Live health** --- every set shows real-time online/offline counts per relay
- **Copy a set** --- export the relay list as JSON with one click
- **Delete your sets** --- publishes a NIP-09 deletion request

Sets are addressable events, so they're portable --- any NIP-51-aware client can read them.

---

## 17. Labels, Trust & Comments

### Trust Badges

Relays can carry a 0-100 trust badge from two sources:

1. **NIP-32 labels** --- moderators publish `com.0xrelayfinder.trust` labels
2. **NIP-85 trusted assertions** --- WoT providers (e.g. nostr.band) publish rank scores for relay URLs

When both exist, the highest confidence score is displayed. Hover the badge to see the source.

### Adding Labels

On a relay's **Labels** tab:
- Anyone logged in can add **category** or **UGC** labels
- Moderators can additionally set **trust scores** (0-100) and **moderation** labels

### Comments

On a relay's **Comments** tab:
- Post a top-level review, or reply to existing comments (up to 3 levels deep)
- Comments are signed Nostr events (kind:1111) --- they can't be faked
- Comments follow NIP-22, so other Nostr apps can display the same threads

---

## 18. Membership & Operator Tools

### Joining a Membership Relay (NIP-43)

On a relay's **Membership** tab:

1. If the relay is invite-only, click **Join**
2. Paste an invite code (claim), or click **Request invite from relay** to ask for one
3. The app sends a kind:28934 join request to the relay
4. Once accepted, you appear in the relay's member list (kind:13534)

To leave, click **Leave** --- this sends a kind:28936 request revoking your access.

### Operator Tools (NIP-86)

If a relay supports the NIP-86 Management API and you're the operator:

1. The Membership tab shows **Operator Tools** with a green "Management API Available" status
2. Authenticate with your Nostr signer (NIP-98 HTTP auth)
3. Available actions: ban/unban pubkeys with reasons, list allowed/banned pubkeys, moderation queue, relay configuration

The app probes `supportedmethods` to detect NIP-86 support automatically.

---

## 19. Protocol Coverage Page

Navigate to `/protocols` for a transparent list of all 34 NIPs the app supports:

- **Grouped by category** --- core, relay, client, social, monetization, privacy, moderation, data
- **Implementation status** --- implemented vs. not
- **Verification capability** --- which NIPs can be tested live from the browser
- **Spec links** --- direct links to each NIP's specification

---

*Built under [0xPrivacy.online](https://0xPrivacy.online) --- Privacy / Decentralisation / Bitcoin + Nostr*
