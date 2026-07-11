# Contributing to 0xNostrRelays

Thanks for your interest in contributing! This project is open source under the MIT license and welcomes contributions from the Nostr community.

---

## Getting Started

### Prerequisites

- **Node.js 18+** (recommended: latest LTS)
- **npm** (comes with Node.js)
- A **Nostr browser extension** (nos2x, Alby, etc.) for testing login-related features

### Setup

```bash
# 1. Fork & clone
git clone https://github.com/YOUR_USERNAME/0xNostr-Relay-Finder.git
cd 0xNostr-Relay-Finder

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

The dev server runs at `http://localhost:5173` with hot module replacement.

### Useful Scripts

| Script | What it does |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build to `dist/` |
| `npm test` | TypeScript check + ESLint + Vitest + build |

---

## Project Architecture

### Data Flow

```
Seed Data (29 relays)
       |
       v
  useRelayData ------> useLiveRelayStore ------> UI Components
       ^                     ^      ^
       |                     |      |
useRelayDirectory      useNIP66Monitor  useNIP11Batch
(kind:30078 events)    (kind:30166)     (HTTP NIP-11)
```

1. **Seed data** (`src/data/relays.ts`) provides the base directory
2. **useRelayDirectory** queries Nostr relays for user-submitted relays (kind:30078)
3. **useNIP66Monitor** subscribes to NIP-66 health events from trusted monitors
4. **useNIP11Batch** fetches NIP-11 documents over HTTP in parallel
5. **useLiveRelayStore** merges all sources into enriched `LiveRelayRecord` objects

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/constants.ts` | Relay URLs, event kinds, trusted monitor pubkeys |
| `src/lib/healthScore.ts` | Health score algorithm (7 components, 100 points) |
| `src/lib/autoTagger.ts` | NIP-to-use-case mapping engine |
| `src/types/relay.ts` | Core TypeScript types for relay records |
| `src/hooks/useLiveRelayStore.ts` | Central data merge store |
| `src/hooks/useNIPVerifier.ts` | WebSocket-based NIP verification engine |
| `src/hooks/useRelayCrawler.ts` | Auto-discovery of new relay URLs |
| `NIP.md` | Custom Nostr event schema documentation |

### State Management

- **TanStack Query** for all server state (Nostr queries, NIP-11 fetches)
- **React Context** for app config, theme, and wallet connections
- **localStorage** for user preferences and relay configuration
- No Redux, Zustand, or other state libraries

### Styling

- **TailwindCSS 3** with custom CSS properties for theming
- **shadcn/ui** components (48+ available in `src/components/ui/`)
- **Inter Variable** as the primary typeface
- Dark mode via `.dark` class on `<html>`

---

## Code Conventions

### TypeScript

- **Never use `any`** --- always use proper types
- Export types from `src/types/` for shared interfaces
- Use `NostrEvent` from `@nostrify/nostrify` for event types

### Naming

- **Files**: PascalCase for components (`RelayCard.tsx`), camelCase for hooks (`useRelayData.ts`)
- **Components**: PascalCase (`function RelayCard()`)
- **Hooks**: `use` prefix, camelCase (`useNIP66Monitor`)
- **Constants**: UPPER_SNAKE_CASE (`APP_RELAY_URL`)

### Nostr Events

- Always filter by `authors` when querying privileged data (admin actions, etc.)
- Use `nostr.group(APP_RELAY_URLS)` to query from all app relays
- Validate event structure before using content

### Imports

- Use `@/` path alias for all project imports
- Group: React/external libs first, then `@/` imports
- UI components from `@/components/ui/`

---

## Adding Features

### New Pages

1. Create the page component in `src/pages/`
2. Add the route in `src/AppRouter.tsx` (above the `*` catch-all)
3. Add a link in the Navbar if it should be in primary navigation
4. Add SEO metadata with `useSeoMeta()` from `@unhead/react`

### New Hooks

1. Create in `src/hooks/`
2. Use `useQuery` from TanStack Query for data fetching
3. Use `useNostr()` from `@nostrify/react` for Nostr queries
4. Document the hook's purpose in a JSDoc comment

### New Relay Data Sources

1. Add the data source hook (e.g., `useMyNewSource.ts`)
2. Integrate into `useLiveRelayStore.ts` with a merge function
3. Add any new fields to `LiveRelayRecord` interface

### Custom Event Kinds

1. Check existing NIPs first --- avoid custom kinds when an existing NIP works
2. If a new kind is needed, document it in `NIP.md`
3. Add the kind constant to `src/lib/constants.ts`
4. Include a NIP-31 `alt` tag with a human-readable description

---

## Testing

The project uses **Vitest** with React Testing Library:

```bash
# Run tests
npm test

# Run just unit tests (skip build)
npx vitest run

# Watch mode
npx vitest
```

### Test Structure

- Tests live alongside the code they test (`Component.test.tsx`)
- Use `TestApp` wrapper from `src/test/TestApp.tsx` for context providers
- Mock Nostr queries when testing components that fetch data

---

## Submitting Changes

### Pull Request Process

1. **Fork** the repository
2. Create a **feature branch** from `main` (`git checkout -b feat/my-feature`)
3. Make your changes following the code conventions above
4. Run `npm test` and ensure everything passes
5. Write a clear PR description explaining what changed and why
6. Submit the PR

### Commit Messages

Use conventional commit format:

```
feat: add relay changelog tracking
fix: approval events not merging in dashboard stats
docs: update GUIDE.md with recommender quiz walkthrough
refactor: extract health score into standalone lib
```

### What Makes a Good PR

- Solves a real problem or adds value for Nostr users
- Follows existing code patterns and conventions
- Includes TypeScript types (no `any`)
- Passes `npm test` without errors
- Has a clear, descriptive commit message

---

## Reporting Issues

Open an issue on GitHub with:

1. **What you expected** to happen
2. **What actually happened** (screenshots help)
3. **Steps to reproduce** the issue
4. **Browser and OS** version
5. **Nostr extension** being used (if relevant)

---

## Community

- **Nostr**: Follow the project owner at `npub1mzyv84a27q0n3d2s6e3l3yzxw209gcz0ydc06d0pup07juptpqesemalsu`
- **Website**: [0xPrivacy.online](https://0xPrivacy.online)
- **Live App**: [0xrelay-finder.shakespeare.wtf](https://0xrelay-finder.shakespeare.wtf)

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
