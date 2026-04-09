// ─── Use-case tags ───────────────────────────────────────────────────────────
export type UseCaseTag =
  | 'General'
  | 'Images'
  | 'Video'
  | 'Blossom'
  | 'Paid Access'
  | 'High Performance'
  | 'Censorship Resistant'
  | 'Communities'
  | 'Long Form'
  | 'Marketplace'
  | 'Gaming'
  | 'Privacy'
  | 'Archive'
  | 'Inbox'
  | 'DMs'
  | 'Zaps';

// ─── Community vote tags (user-submitted) ────────────────────────────────────
export type VoteTag =
  | 'Best for Images'
  | 'Best for Video/Blossom'
  | 'Best for General Chat'
  | 'Best for High-Volume'
  | 'Censorship-Resistant'
  | 'Low-Latency'
  | 'Free Tier'
  | 'Best for DMs'
  | 'Best for Long-Form'
  | 'Best for Zaps'
  | 'Best for Developers'
  | 'Best for Communities'
  | 'Privacy Focused'
  | 'High Reliability';

export const ALL_VOTE_TAGS: VoteTag[] = [
  'Best for Images', 'Best for Video/Blossom', 'Best for General Chat',
  'Best for High-Volume', 'Censorship-Resistant', 'Low-Latency', 'Free Tier',
  'Best for DMs', 'Best for Long-Form', 'Best for Zaps', 'Best for Developers',
  'Best for Communities', 'Privacy Focused', 'High Reliability',
];

// ─── Pricing ─────────────────────────────────────────────────────────────────
export type PriceTier = {
  name: string;
  price: number; // monthly USD, 0 = free
  currency: 'USD' | 'sats';
  billing?: 'monthly' | 'yearly' | 'one-time';
  features: string[];
  limits?: {
    maxEvents?: number;
    maxConnections?: number;
    maxEventSize?: number; // bytes
    storageQuota?: string;
  };
};

// ─── Uptime history point ─────────────────────────────────────────────────────
export type UptimePoint = {
  timestamp: number; // unix epoch ms
  online: boolean;
  latencyMs?: number;
};

// ─── NIP-11 relay limitations ────────────────────────────────────────────────
export type RelayLimitations = {
  max_message_length?: number;
  max_subscriptions?: number;
  max_filters?: number;
  max_limit?: number;
  max_subid_length?: number;
  min_prefix?: number;
  max_event_tags?: number;
  max_content_length?: number;
  min_pow_difficulty?: number;
  auth_required?: boolean;
  payment_required?: boolean;
  restricted_writes?: boolean;
  created_at_lower_limit?: number;
  created_at_upper_limit?: number;
};

// ─── NIP-11 info document ────────────────────────────────────────────────────
export type NIP11Info = {
  name?: string;
  description?: string;
  pubkey?: string;
  contact?: string;
  supported_nips?: number[];
  software?: string;
  version?: string;
  limitation?: RelayLimitations;
  retention?: Array<{ kinds?: number[]; time?: number; count?: number }>;
  relay_countries?: string[];
  language_tags?: string[];
  tags?: string[];
  posting_policy?: string;
  payments_url?: string;
  icon?: string;
  fees?: {
    admission?: Array<{ amount: number; unit: string }>;
    subscription?: Array<{ amount: number; unit: string; period?: number }>;
    publication?: Array<{ kinds: number[]; amount: number; unit: string }>;
  };
};

// ─── NIP-66 health data (kind:30166 / kind:10166) ────────────────────────────
export type NIP66Data = {
  /** Whether official NIP-66 monitor data exists for this relay */
  enriched: boolean;
  /** Unix epoch ms of the latest kind:30166 event */
  lastMonitorEvent?: number;
  /** Liveness status from official monitor */
  liveStatus?: 'online' | 'offline' | 'degraded';
  /** Round-trip latency in ms from monitor */
  monitorLatencyMs?: number;
  /** Monitor pubkey (hex) that published the kind:30166 event */
  monitorPubkey?: string;
  /** Capability flags reported by NIP-66 */
  capabilities?: {
    read: boolean;
    write: boolean;
    relay: boolean;
    blossom: boolean;
    hasNip11: boolean;
  };
  /** Whether NIP-66 data contradicts NIP-11 (flag for review) */
  conflictsWithNip11?: boolean;
  /** Human-readable conflict description */
  conflictDetail?: string;
  /** Activity metrics from monitor */
  eventsPerDay?: number;
  connectedUsers?: number;
};

// ─── Import-source tracking ───────────────────────────────────────────────────
export type ImportSource = {
  source: 'nip11' | 'nip66' | 'xport.top' | 'nostr.watch' | 'trustedrelays' | 'manual';
  importedAt: number; // unix epoch ms
  /** Specific data fields updated by this source */
  fieldsUpdated?: string[];
};

// ─── Community vote aggregate ────────────────────────────────────────────────
export type CommunityTagVote = {
  tag: VoteTag;
  upvotes: number;
  /** 0-100 percentage of voters who chose this tag */
  percent: number;
};

// ─── Core relay record ───────────────────────────────────────────────────────
export type RelayRecord = {
  id: string;
  url: string; // wss://...
  name: string;
  description: string;
  nip11: NIP11Info;
  useCases: UseCaseTag[];
  priceTiers: PriceTier[];
  countryCode?: string;
  countryName?: string;
  isFree: boolean;
  isOnline: boolean;
  uptimePercent30d: number;
  uptimeSpark: number[]; // last 14 data points (0/1)
  avgLatencyMs?: number;
  lastChecked: number; // unix epoch ms
  addedAt: number; // unix epoch ms
  featured: boolean;
  trustScore: number; // 0-100
  operatorNpub?: string;
  websiteUrl?: string;
  paymentUrl?: string;
  /** Blossom media server support */
  blossomSupported?: boolean;
  /** NIP-66 enrichment data */
  nip66?: NIP66Data;
  /** Import source history */
  importSources?: ImportSource[];
  /** Community voted tags */
  communityTags?: CommunityTagVote[];
  /** relay.tools integration URL */
  relayToolsUrl?: string;
};

// ─── Local vote record (stored in localStorage) ──────────────────────────────
export type LocalVote = {
  relayUrl: string;
  tag: VoteTag;
  voterPubkey?: string;
  votedAt: number;
};
