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

export type UptimePoint = {
  timestamp: number; // unix epoch ms
  online: boolean;
  latencyMs?: number;
};

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

export type NIP11Info = {
  name?: string;
  description?: string;
  pubkey?: string;
  contact?: string;
  supported_nips?: number[];
  software?: string;
  version?: string;
  limitation?: RelayLimitations;
  retention?: Array<{
    kinds?: number[];
    time?: number;
    count?: number;
  }>;
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
};
