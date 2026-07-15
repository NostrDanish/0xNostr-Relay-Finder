/**
 * Relay Badges System
 *
 * Awards visual achievement badges based on relay performance,
 * features, and community standing. These are computed client-side
 * from the relay's data, not stored anywhere.
 */

import type { LiveRelayRecord } from '@/hooks/useLiveRelayStore';

export interface RelayBadge {
  id: string;
  label: string;
  emoji: string;
  description: string;
  color: string; // tailwind text color
  bgColor: string; // tailwind bg color
  borderColor: string; // tailwind border color
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}

const BADGE_DEFINITIONS: Omit<RelayBadge, 'id'>[] = []; // defined below in computeBadges

/**
 * Compute all badges a relay has earned.
 */
export function computeRelayBadges(relay: LiveRelayRecord): RelayBadge[] {
  const badges: RelayBadge[] = [];
  const nips = relay.liveNip11?.supported_nips ?? relay.nip11?.supported_nips ?? [];
  const latency = relay.liveLatencyMs ?? relay.avgLatencyMs;
  const isOnline = relay.liveOnline ?? relay.isOnline;

  // ── Uptime Badges ─────────────────────────────────────────────────────────

  if (relay.uptimePercent30d >= 99.9) {
    badges.push({
      id: 'uptime-999',
      label: '99.9% Uptime',
      emoji: '\u{1F3C6}', // trophy
      description: 'Maintained 99.9%+ uptime over the last 30 days',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
      rarity: 'legendary',
    });
  } else if (relay.uptimePercent30d >= 99.5) {
    badges.push({
      id: 'uptime-995',
      label: '99.5% Uptime',
      emoji: '\u{1F947}', // gold medal
      description: 'Maintained 99.5%+ uptime over the last 30 days',
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      rarity: 'rare',
    });
  } else if (relay.uptimePercent30d >= 99) {
    badges.push({
      id: 'uptime-99',
      label: '99% Uptime',
      emoji: '\u{1F7E2}', // green circle
      description: 'Maintained 99%+ uptime over the last 30 days',
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      rarity: 'uncommon',
    });
  }

  // ── Latency Badges ────────────────────────────────────────────────────────

  if (latency != null && latency < 50) {
    badges.push({
      id: 'ultra-fast',
      label: 'Ultra Fast',
      emoji: '\u26A1', // lightning
      description: `Sub-50ms latency (${latency}ms)`,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/30',
      rarity: 'rare',
    });
  } else if (latency != null && latency < 100) {
    badges.push({
      id: 'fast-relay',
      label: 'Fast Relay',
      emoji: '\u{1F3CE}\uFE0F', // racing car
      description: `Sub-100ms latency (${latency}ms)`,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      rarity: 'uncommon',
    });
  }

  // ── NIP Support Badges ────────────────────────────────────────────────────

  if (nips.length >= 40) {
    badges.push({
      id: 'nip-master',
      label: 'NIP Master',
      emoji: '\u{1F48E}', // gem
      description: `Supports ${nips.length} NIPs — maximum protocol coverage`,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      borderColor: 'border-primary/30',
      rarity: 'legendary',
    });
  } else if (nips.length >= 25) {
    badges.push({
      id: 'nip-expert',
      label: 'Feature Rich',
      emoji: '\u{1F4E6}', // package
      description: `Supports ${nips.length} NIPs`,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
      borderColor: 'border-violet-500/30',
      rarity: 'rare',
    });
  }

  // ── Feature Badges ────────────────────────────────────────────────────────

  if (relay.nip11?.limitation?.auth_required) {
    badges.push({
      id: 'nip42-auth',
      label: 'NIP-42 Auth',
      emoji: '\u{1F512}', // lock
      description: 'Requires authentication for access',
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
      rarity: 'uncommon',
    });
  }

  if (relay.blossomSupported) {
    badges.push({
      id: 'blossom',
      label: 'Blossom',
      emoji: '\u{1F4C1}', // file folder
      description: 'Supports Blossom media server protocol',
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
      borderColor: 'border-pink-500/30',
      rarity: 'uncommon',
    });
  }

  if (nips.includes(17)) {
    badges.push({
      id: 'dm-ready',
      label: 'DM Ready',
      emoji: '\u{1F4AC}', // speech balloon
      description: 'Supports NIP-17 private direct messages',
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
      borderColor: 'border-violet-500/30',
      rarity: 'common',
    });
  }

  if (nips.includes(50)) {
    badges.push({
      id: 'searchable',
      label: 'Searchable',
      emoji: '\u{1F50D}', // magnifying glass
      description: 'Supports NIP-50 full-text search',
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/30',
      rarity: 'common',
    });
  }

  if (nips.includes(57)) {
    badges.push({
      id: 'zap-enabled',
      label: 'Zap Enabled',
      emoji: '\u26A1', // lightning
      description: 'Supports NIP-57 Lightning zaps',
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      rarity: 'common',
    });
  }

  // ── Trust / Community Badges ──────────────────────────────────────────────

  if (relay.trustScore >= 95) {
    badges.push({
      id: 'community-favorite',
      label: 'Community Favorite',
      emoji: '\u2764\uFE0F', // heart
      description: 'Trust score 95+ from community votes',
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/30',
      rarity: 'rare',
    });
  }

  // ── NIP-66 Monitored ──────────────────────────────────────────────────────

  if (relay.nip66?.enriched) {
    badges.push({
      id: 'nip66-monitored',
      label: 'NIP-66 Monitored',
      emoji: '\u{1F4CA}', // bar chart
      description: 'Actively monitored by NIP-66 health network',
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30',
      rarity: 'common',
    });
  }

  // ── Operator Verified ─────────────────────────────────────────────────────

  if (relay.nip11?.pubkey && relay.websiteUrl) {
    badges.push({
      id: 'verified-operator',
      label: 'Verified Operator',
      emoji: '\u2705', // check mark
      description: 'Operator has published pubkey and website',
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/30',
      rarity: 'uncommon',
    });
  }

  // ── Paid Relay ────────────────────────────────────────────────────────────

  if (!relay.isFree) {
    badges.push({
      id: 'premium-relay',
      label: 'Premium',
      emoji: '\u{1F451}', // crown
      description: 'Paid relay with premium features',
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      rarity: 'common',
    });
  }

  // ── Directory Age ─────────────────────────────────────────────────────────

  const ageMonths = (Date.now() - relay.addedAt) / (30 * 24 * 60 * 60 * 1000);
  if (ageMonths >= 12) {
    badges.push({
      id: 'veteran',
      label: 'Veteran',
      emoji: '\u{1F396}\uFE0F', // military medal
      description: `In the directory for ${Math.floor(ageMonths)} months`,
      color: 'text-amber-700',
      bgColor: 'bg-amber-700/10',
      borderColor: 'border-amber-700/30',
      rarity: 'rare',
    });
  } else if (ageMonths >= 6) {
    badges.push({
      id: 'established',
      label: 'Established',
      emoji: '\u{1F3DB}\uFE0F', // classical building
      description: `In the directory for ${Math.floor(ageMonths)} months`,
      color: 'text-slate-500',
      bgColor: 'bg-slate-500/10',
      borderColor: 'border-slate-500/30',
      rarity: 'uncommon',
    });
  }

  return badges;
}

/**
 * Get the rarity color for display.
 */
export function rarityColor(rarity: RelayBadge['rarity']): string {
  switch (rarity) {
    case 'legendary': return 'text-yellow-500';
    case 'rare': return 'text-violet-500';
    case 'uncommon': return 'text-blue-500';
    case 'common': return 'text-muted-foreground';
  }
}
