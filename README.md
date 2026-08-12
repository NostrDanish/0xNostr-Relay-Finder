# 0xNostrRelays

**The most comprehensive Nostr relay directory ever built.**

Find, compare, and evaluate Nostr relays by uptime, latency, NIP support, pricing, trust, and community reputation. Fully decentralised — all data is stored as signed Nostr events.

[![Edit with Shakespeare](https://shakespeare.diy/badge.svg)](https://shakespeare.diy/clone?url=https%3A%2F%2Fgithub.com%2FNostrDanish%2F0xNostr-Relay-Finder.git)

**Live:** [https://0xrelay-finder.shakespeare.wtf](https://0xrelay-finder.shakespeare.wtf)

---

## Features

### Relay Directory
- **29+ seed relays** with detailed NIP-11 info, plus community-submitted relays
- **Live NIP-66 monitoring** from trusted nostr.watch-style monitors — real-time online/offline status, RTT, geohash
- **NIP-11 batch fetcher** — HTTP fetch of relay info documents with diff tracking
- **Auto-tagging engine** — NIP support is automatically mapped to use-case tags (DMs, Zaps, Blossom, Privacy, Membership, Sync, etc.)
- **Advanced search & filters** — by use case, pricing, uptime, NIP support, country, Blossom, NIP-66 enrichment
- **Sparkline uptime charts** — 14-point visual history per relay
- **Favorite relays (NIP-51)** — heart any relay, stored as your public kind:10012 list
- **Trust badges (NIP-32 + NIP-85)** — label-based and Web-of-Trust scores shown on every card

### Nostr Atlas (World Map)
Interactive dependency-free SVG world map at `/atlas`:

- **Color-coded health markers** — green (healthy), yellow (slow), red (offline)
- **Marker clustering** when zoomed out; individual markers when zoomed in
- **Pan, zoom, click-to-inspect** — full relay details in popup
- **Filters** — by status, software, country, features (auth, payment, Blossom, NIP-66)
- **Geolocation from NIP-66 geohashes** — no tile servers, no external dependencies

### NIP Verification (Unique Differentiator)
Relays self-report their NIP support, but do they actually work? 0xNostrRelays opens a **live WebSocket** to each relay and runs targeted tests:

| NIP | Test |
|-----|------|
| NIP-01 | Send REQ, expect EVENT or EOSE |
| NIP-13 | Send event with nonce tag, check PoW validation |
| NIP-15 | Send REQ, expect EOSE marker |
| NIP-20 | Send EVENT, expect OK response |
| NIP-42 | Check if relay sends AUTH challenge |
| NIP-43 | Send join request, check membership handling |
| NIP-45 | Send COUNT, expect count response |
| NIP-50 | Send search query, expect no error |
| NIP-67 | Check EOSE for `finish`/`more` completeness hints |
| NIP-77 | Send NEG-OPEN, check negentropy support |
| NIP-86 | Probe management API (HTTP, auth-gated) |

Results: **Verified** (tested and works), **Failed** (claimed but doesn't deliver), **No test** (cannot auto-test).

### Health Score Algorithm (Transparent)
Every relay gets a public, auditable health score out of 100:

| Component | Weight | Source |
|-----------|--------|--------|
| 30-day uptime | 25 pts | NIP-66 + probes |
| Average latency | 15 pts | RTT measurements |
| NIP-11 completeness | 10 pts | Has name, description, contact, software, icon |
| Community trust | 10 pts | WoT-weighted votes + NIP-32 labels + NIP-85 assertions |
| NIP support breadth | 10 pts | Count of supported NIPs |
| Operator verification | 10 pts | NIP-11 pubkey, NIP-66 data, website, ToS |
| Membership features | 5 pts | NIP-43 members, roles, invite system |
| Advanced protocol | 5 pts | NIP-67 EOSE hints, NIP-77 negentropy, NIP-86 API |
| Directory age | 5 pts | How long in the directory |

Full breakdown visible on every relay detail page.

### Relay Labels (NIP-32)
Decentralised, cryptographically-signed labels for relays:

- **Trust scores** (`com.0xrelayfinder.trust`) — moderators assign 0-100 trust ratings
- **Categories** (`com.0xrelayfinder.category`) — community-applied labels like "fast", "reliable"
- **Moderation labels** (`social.nos.ontology`) — content policy flags
- **Trusted labelers** — labels from owner/admins are highlighted and weighted

### Trusted Assertions (NIP-85)
Web-of-Trust scoring offloaded to trusted service providers:

- Consumes kind:30382/30384/30385 assertion events from providers like nostr.band
- Relay URL trust scores, operator pubkey ranks, submission ratings
- User-configurable provider lists (kind:10040) with sensible defaults
- Multiple provider scores shown with provenance

### Membership & Access (NIP-43)
Full support for invite-only and membership-based relays:

- **Membership lists** (kind:13534) — see who has access to a relay
- **Role definitions** (kind:33534) — relay-defined roles with labels and colors
- **Join requests** (kind:28934) — claim-based admission with invite codes
- **Invite requests** (kind:28935) — request a claim from the relay
- **Leave requests** (kind:28936) — revoke your own access

### Operator Tools (NIP-86)
Relay operators can manage their relays directly from the app:

- **Management API detection** — probes relay for NIP-86 support
- **NIP-98 authenticated calls** — ban/unban pubkeys, moderate events
- **Method discovery** — `supportedmethods` enumeration
- Ban pubkeys with reasons, manage allowed lists, configure relay metadata

### Relay Sets & Collections (NIP-51)
Curated relay collections at `/sets`:

- **Create relay sets** (kind:30002) — named, described collections of relays
- **Browse community sets** — discover what combinations others recommend
- **Live health per set** — see online/offline status of every relay in a set
- **Copy/share sets** — export relay lists as JSON
- **Favorites list** (kind:10012) — your personal favorite relays, synced to Nostr

### Relay Comments (NIP-22)
Threaded reviews on every relay detail page:

- Scoped to the relay URL via NIP-73 `I` tags
- Nested replies up to 3 levels deep
- Signed by your Nostr identity — no fake reviews
- Live comment counts

### "Fix My Nostr" Diagnostic Wizard
Paste any **npub**, **nprofile**, **NIP-05 address** (user@domain.com), or hex pubkey:

1. Resolves identity (including NIP-05 via well-known endpoint)
2. Fetches their kind:10002 relay list from 7+ relays
3. Probes each relay for online status and latency
4. Generates diagnostic report with letter grade (A–F)
5. Specific warnings: all offline, no write relays, no DM support, low diversity
6. Recommends better relays from the directory with one-click add

### One-Click Relay Management (NIP-07)
- **"Add to My Relays"** button on every relay card and detail page
- Dropdown: Read + Write / Read only / Write only
- Publishes updated kind:10002 via browser signer
- Shows "In My Relays" when already in your list with toggle controls

### "Best Relay for Me" Quiz
3-step interactive recommender at `/recommend`:

1. **Use case** — General / DMs / Long-form / Media / Communities
2. **Pricing** — Free / Paid / Either
3. **Privacy** — Public / Auth-required / Maximum privacy

Returns top 5 personalized recommendations scored by relevance.

### Relay Software Leaderboard
At `/software` — aggregates the NIP-11 `software` field across all relays:

- Rankings by relay count, average uptime, average latency, average NIPs
- Version tracking per implementation
- Expandable relay lists per software
- Links to GitHub for strfry, nostr-rs-relay, khatru, ditto, etc.

### Protocol Coverage Page
At `/protocols` — transparent list of all 34 NIPs the app supports:

- Grouped by category: core, relay, client, social, monetization, privacy, moderation, data
- Implementation status and verification capability per NIP
- Direct links to NIP specifications

### Community Voting & Moderation
- **kind:7 upvotes** — WoT-weighted community reactions on relays
- **kind:6683 tag proposals** — users can propose use-case tags ("best for DMs")
- **Admin dashboard** — approve/reject queue with role hierarchy (owner > admin > mod)
- **NIP-44 encrypted notes** — submitters can attach private notes for moderators
- **kind:1984 reports** — full abuse reporting flow

### Relay Graveyard
Memorial page at `/graveyard` for relays that have gone permanently offline. Tombstone-styled cards with last-seen dates, death duration, and historical use cases.

### App Handler Discovery (NIP-89)
On every relay's NIPs tab, find compatible apps for the event kinds that relay supports — linking out to handler registries so users can open exotic event kinds in the right client.

### Blossom Support (NIP-B7)
- Detects Blossom media capability (NIP-94/96) per relay
- Server health panel with online status
- User's preferred Blossom servers from kind:10063

### Additional Features
- **Relay operator profiles** — if NIP-11 includes a pubkey, fetches kind:0 metadata (avatar, name, bio, Lightning address)
- **Auto-crawling relay discovery** — watches kind:10002, kind:3, and kind:30166 events to discover new relay URLs
- **NIP-66 live monitor subscription** — real-time health data from trusted monitors
- **Web of Trust** — 2-level follow graph for weighting community votes
- **Dark/light/cyberpunk themes** — full theme system with CSS custom properties
- **Nostr-native API** — all data queryable via standard NIP-01 WebSocket protocol
- **PWA installable** — proper manifest with 192/512 PNG icons, home-screen shortcuts
- **Error boundaries** — component crashes show a friendly fallback instead of a white screen

---

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Hero stats, featured relays, CTAs |
| `/relays` | Full directory with search & filters |
| `/relay/:id` | Relay detail — 11 tabs (Overview, Verify, Uptime, NIP-66, Community, Comments, Labels, Membership, Auto-Tags, NIPs, Pricing, Add to Client) |
| `/atlas` | Interactive world map of all geolocated relays |
| `/sets` | NIP-51 relay set collections — create & browse |
| `/protocols` | Protocol coverage — all supported NIPs |
| `/explore` | Curated relay explorations |
| `/build` | Guided relay set builder |
| `/compare` | Side-by-side relay comparison |
| `/recommend` | "Best Relay for Me" quiz |
| `/lookup` | "Fix My Nostr" diagnostic wizard |
| `/software` | Relay software leaderboard |
| `/graveyard` | Memorial for dead relays |
| `/submit` | Relay submission form |
| `/dashboard` | Admin/moderator dashboard |
| `/api` | Nostr protocol query documentation |
| `/about` | About relays and the project |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript |
| Styling | TailwindCSS 3 + shadcn/ui |
| Build | Vite |
| Nostr | Nostrify + nostr-tools |
| Data | TanStack Query |
| Routing | React Router 6 |
| Charts | Recharts |

---

## Quick Start

```bash
# Clone
git clone https://github.com/NostrDanish/0xNostr-Relay-Finder.git
cd 0xNostr-Relay-Finder

# Install
npm install

# Dev server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

---

## Project Structure

```
src/
  components/
    auth/              # Login, signup, account switching
    charts/            # Uptime history visualizations
    layout/            # Navbar, Footer
    relay/             # RelayCard, VotingPanel, SparklineChart, RelayMap,
                       # RelayCommentSection, RelayLabelPanel, RelayMembershipPanel,
                       # RelayManagementPanel, RelayCardExtras, NIP66Badge, etc.
    ui/                # 48+ shadcn/ui components
    ErrorBoundary.tsx  # App-wide crash protection
  hooks/
    useNIPVerifier         # Live WebSocket NIP testing (11 tests)
    useRelayCrawler        # Auto-discovery of new relay URLs
    useNIP66Monitor        # Live NIP-66 health subscription
    useNIP11Batch          # Batch NIP-11 HTTP fetching with diff tracking
    useLiveRelayStore      # Centralized relay data merge
    useRelayDirectory      # kind:30078 submission queries
    useSubmissions         # Admin approval/rejection system
    useWoT                 # Web of Trust computation
    useRelayLabels         # NIP-32 relay labeling
    useTrustedAssertions   # NIP-85 WoT trust scores
    useRelayManagement     # NIP-86 management API client
    useRelayMembership     # NIP-43 membership, roles, join/leave
    useRelaySets           # NIP-51 relay sets & favorites
    useRelayComments       # NIP-22 threaded comments
    useBlossom             # NIP-B7 Blossom detection & health
    useAppHandlers         # NIP-89 app handler discovery
    ...
  pages/
    HomePage               # Hero stats, featured relays, CTAs
    RelaysPage             # Full directory with filters
    RelayDetailPage        # 11-tab relay detail view
    AtlasPage              # World map of relays
    RelaySetsPage          # NIP-51 collections
    ProtocolCoveragePage   # Supported NIPs grid
    LookupPage             # "Fix My Nostr" diagnostic wizard
    RecommenderPage        # "Best Relay for Me" quiz
    SoftwarePage           # Relay software leaderboard
    GraveyardPage          # Memorial for dead relays
    DashboardPage          # Admin moderation dashboard
    SubmitPage             # Relay submission form
    ExplorePage            # Curated explorations
    BuildPage              # Guided relay set builder
    ComparePage            # Side-by-side comparison
    ApiDocsPage            # Nostr protocol query docs
    AboutPage              # About relays and the project
  lib/
    constants.ts       # Relay URLs, event kinds, trusted monitors, use-case map
    healthScore.ts     # Transparent health score algorithm (v2, NIP-enhanced)
    autoTagger.ts      # NIP-to-use-case mapping engine
    utils.ts           # Shared utilities
  data/
    relays.ts          # Seed relay data (29 relays)
  types/
    relay.ts           # TypeScript types for relay records
```

---

## Nostr Protocol

All data is stored as signed Nostr events. See [NIP.md](./NIP.md) for the full event schema.

**Event Kinds Published:**
- `kind:30078` — relay submissions, approvals, role lists (NIP-78)
- `kind:7` — community upvotes/downvotes (NIP-25)
- `kind:6683` — use-case tag proposals (custom)
- `kind:1984` — relay reports (NIP-56)
- `kind:1985` — relay labels (NIP-32)
- `kind:1111` — relay comments (NIP-22)
- `kind:10002` — user relay lists (NIP-65)
- `kind:10012` — favorite relays list (NIP-51)
- `kind:30002` — relay sets (NIP-51)
- `kind:28934` / `kind:28936` — relay join/leave requests (NIP-43)
- `kind:27235` — HTTP auth for management API (NIP-98)

**Event Kinds Consumed:**
- `kind:30166` / `kind:10166` — NIP-66 relay monitoring
- `kind:30382` / `kind:30384` / `kind:30385` — NIP-85 trusted assertions
- `kind:33534` / `kind:13534` — NIP-43 roles and membership lists
- `kind:28935` — NIP-43 invite claims
- `kind:10063` — NIP-B7 Blossom server lists
- `kind:31989` / `kind:31990` — NIP-89 app handler recommendations
- `kind:0` — operator/app profiles
- `kind:3` — follow lists for WoT

**Data Relays:**
- `wss://relay.0xPrivacy.online` (primary)
- `wss://0xPrivacy.nostr1.com` (secondary)
- `wss://relay.damus.io`, `wss://relay.primal.net`, `wss://nos.lol`, `wss://relay.nostr.band`, `wss://relay.snort.social`

**Query the directory directly:**
```
["REQ","sub",{"kinds":[30078],"#t":["relay-submission"],"limit":50}]
```

No API keys. No rate limits. Fully decentralised.

---

## Guides

See [GUIDE.md](./GUIDE.md) for a complete walkthrough of every feature, including:
- How to search and filter relays
- How to use the NIP verification tool
- How to diagnose your own relay configuration
- How to submit a new relay
- How the health score works
- How to use the recommender quiz
- How the admin moderation system works

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, code conventions, and how to contribute.

---

## Roadmap

**Completed:**
- ~~Geographic map view~~ → Nostr Atlas at `/atlas` (dependency-free SVG, NIP-66 geohash)
- ~~Operator self-service dashboard~~ → NIP-86 management panel on relay pages
- ~~Relay labels & trust scoring~~ → NIP-32 + NIP-85 integration
- ~~Relay collections~~ → NIP-51 sets at `/sets`
- ~~Relay reviews~~ → NIP-22 threaded comments

**Upcoming:**
- Own NIP-66 monitor (self-sovereign liveness data)
- Relay changelog (NIP-11 diff tracking over time)
- Embeddable relay status widget
- Multi-relay replication verification (NIP-77-based)
- Directory backup & export
- DVM-powered relay analysis

See the [Gap Analysis & Roadmap](https://github.com/NostrDanish/0xNostr-Relay-Finder/issues) for the full feature plan.

---

## License

[MIT](./LICENSE) — built under [0xPrivacy.online](https://0xPrivacy.online)

Privacy / Decentralisation / Bitcoin + Nostr

---

Vibed with [Shakespeare](https://shakespeare.diy)
