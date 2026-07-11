# 0xNostrRelays

**The most comprehensive Nostr relay directory ever built.**

Find, compare, and evaluate Nostr relays by uptime, latency, NIP support, pricing, and community reputation. Fully decentralised --- all data is stored as signed Nostr events.

[![Edit with Shakespeare](https://shakespeare.diy/badge.svg)](https://shakespeare.diy/clone?url=https%3A%2F%2Fgithub.com%2FNostrDanish%2F0xNostr-Relay-Finder.git)

**Live:** [https://0xrelay-finder.shakespeare.wtf](https://0xrelay-finder.shakespeare.wtf)

---

## Features

### Relay Directory
- **29+ seed relays** with detailed NIP-11 info, plus community-submitted relays
- **Live NIP-66 monitoring** from trusted nostr.watch-style monitors --- real-time online/offline status, RTT, geohash
- **NIP-11 batch fetcher** --- HTTP fetch of relay info documents with diff tracking
- **Auto-tagging engine** --- NIP support is automatically mapped to use-case tags (DMs, Zaps, Blossom, Privacy, etc.)
- **Advanced search & filters** --- by use case, pricing, uptime, NIP support, country, Blossom, NIP-66 enrichment
- **Sparkline uptime charts** --- 14-point visual history per relay

### NIP Verification (Unique Differentiator)
Relays self-report their NIP support, but do they actually work? 0xNostrRelays opens a **live WebSocket** to each relay and runs targeted tests:

| NIP | Test |
|-----|------|
| NIP-01 | Send REQ, expect EVENT or EOSE |
| NIP-15 | Send REQ, expect EOSE marker |
| NIP-20 | Send EVENT, expect OK response |
| NIP-42 | Check if relay sends AUTH challenge |
| NIP-45 | Send COUNT, expect count response |
| NIP-50 | Send search query, expect no error |

Results: **Verified** (tested and works), **Failed** (claimed but doesn't deliver), **No test** (cannot auto-test).

### Health Score Algorithm (Transparent)
Every relay gets a public, auditable health score out of 100:

| Component | Weight | Source |
|-----------|--------|--------|
| 30-day uptime | 35 pts | NIP-66 + probes |
| Average latency | 20 pts | RTT measurements |
| NIP-11 completeness | 10 pts | Has name, description, contact, software |
| Community trust | 10 pts | WoT-weighted votes |
| NIP support breadth | 10 pts | Count of supported NIPs |
| Operator verification | 10 pts | NIP-11 pubkey, NIP-66 data, website |
| Directory age | 5 pts | How long in the directory |

Full breakdown visible on every relay detail page.

### "Fix My Nostr" Diagnostic Wizard
Paste any **npub**, **nprofile**, **NIP-05 address** (user@domain.com), or hex pubkey:

1. Resolves identity (including NIP-05 via well-known endpoint)
2. Fetches their kind:10002 relay list from 7+ relays
3. Probes each relay for online status and latency
4. Generates diagnostic report with letter grade (A--F)
5. Specific warnings: all offline, no write relays, no DM support, low diversity
6. Recommends better relays from the directory with one-click add

### One-Click Relay Management (NIP-07)
- **"Add to My Relays"** button on every relay card and detail page
- Dropdown: Read + Write / Read only / Write only
- Publishes updated kind:10002 via browser signer
- Shows "In My Relays" when already in your list with toggle controls

### "Best Relay for Me" Quiz
3-step interactive recommender at `/recommend`:

1. **Use case** --- General / DMs / Long-form / Media / Communities
2. **Pricing** --- Free / Paid / Either
3. **Privacy** --- Public / Auth-required / Maximum privacy

Returns top 5 personalized recommendations scored by relevance.

### Relay Software Leaderboard
At `/software` --- aggregates the NIP-11 `software` field across all relays:

- Rankings by relay count, average uptime, average latency, average NIPs
- Version tracking per implementation
- Expandable relay lists per software
- Links to GitHub for strfry, nostr-rs-relay, khatru, ditto, etc.

### Community Voting & Moderation
- **kind:7 upvotes** --- WoT-weighted community reactions on relays
- **kind:6683 tag proposals** --- users can propose use-case tags ("best for DMs")
- **Admin dashboard** --- approve/reject queue with role hierarchy (owner > admin > mod)
- **NIP-44 encrypted notes** --- submitters can attach private notes for moderators
- **kind:1984 reports** --- full abuse reporting flow

### Relay Graveyard
Memorial page at `/graveyard` for relays that have gone permanently offline. Tombstone-styled cards with last-seen dates, death duration, and historical use cases.

### Additional Features
- **Relay operator profiles** --- if NIP-11 includes a pubkey, fetches kind:0 metadata (avatar, name, bio, Lightning address)
- **Auto-crawling relay discovery** --- watches kind:10002, kind:3, and kind:30166 events to discover new relay URLs
- **NIP-66 live monitor subscription** --- real-time health data from trusted monitors
- **Web of Trust** --- 2-level follow graph for weighting community votes
- **Dark/light theme** --- full theme system with CSS custom properties
- **Nostr-native API** --- all data queryable via standard NIP-01 WebSocket protocol

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
    auth/           # Login, signup, account switching
    charts/         # Uptime history visualizations
    comments/       # Relay comment system
    dm/             # Direct messaging
    layout/         # Navbar, Footer
    relay/          # RelayCard, VotingPanel, SparklineChart,
                    # AddToRelayListButton, NIP66Badge, etc.
    ui/             # 48+ shadcn/ui components
  hooks/
    useNIPVerifier  # Live WebSocket NIP testing
    useRelayCrawler # Auto-discovery of new relay URLs
    useNIP66Monitor # Live NIP-66 health subscription
    useNIP11Batch   # Batch NIP-11 HTTP fetching with diff tracking
    useLiveRelayStore # Centralized relay data merge
    useRelayDirectory # kind:30078 submission queries
    useSubmissions  # Admin approval/rejection system
    useWoT          # Web of Trust computation
    useNpubLookup   # npub/NIP-05 relay list lookup
    ...
  pages/
    HomePage        # Hero stats, featured relays, CTAs
    RelaysPage      # Full directory with filters
    RelayDetailPage # Tabs: Overview, Verify, Uptime, NIP-66, Community, NIPs, Pricing
    LookupPage      # "Fix My Nostr" diagnostic wizard
    RecommenderPage # "Best Relay for Me" quiz
    SoftwarePage    # Relay software leaderboard
    GraveyardPage   # Memorial for dead relays
    DashboardPage   # Admin moderation dashboard
    SubmitPage      # Relay submission form
    ApiDocsPage     # Nostr protocol query docs
    AboutPage       # About relays and the project
  lib/
    constants.ts    # Relay URLs, event kinds, trusted monitors
    healthScore.ts  # Transparent health score algorithm
    autoTagger.ts   # NIP-to-use-case mapping engine
    utils.ts        # Shared utilities
  data/
    relays.ts       # Seed relay data (29 relays)
  types/
    relay.ts        # TypeScript types for relay records
```

---

## Nostr Protocol

All data is stored as signed Nostr events. See [NIP.md](./NIP.md) for the full event schema.

**Event Kinds Used:**
- `kind:30078` --- relay submissions, approvals, role lists (NIP-78)
- `kind:7` --- community upvotes/downvotes (NIP-25)
- `kind:6683` --- use-case tag proposals (custom)
- `kind:1984` --- relay reports (NIP-56)
- `kind:30166` / `kind:10166` --- NIP-66 relay monitoring (consumed)
- `kind:10002` --- NIP-65 relay lists (consumed + published)

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

See the [Gap Analysis & Roadmap](https://github.com/NostrDanish/0xNostr-Relay-Finder/issues) for the full feature plan, including:

- Geographic map view (Leaflet + NIP-66 geohash)
- Own NIP-66 monitor (self-sovereign liveness data)
- Relay changelog (NIP-11 diff tracking over time)
- Embeddable relay status widget
- Operator self-service dashboard
- Multi-relay replication verification
- Directory backup & export

---

## License

[MIT](./LICENSE) --- built under [0xPrivacy.online](https://0xPrivacy.online)

Privacy / Decentralisation / Bitcoin + Nostr
