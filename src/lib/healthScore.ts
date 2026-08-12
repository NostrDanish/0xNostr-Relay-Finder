/**
 * Relay Health Score Algorithm
 *
 * A transparent, auditable scoring system with public formula.
 * Each component contributes a portion of the total 100-point score.
 * Breakdown is visible on the relay detail page.
 *
 * Updated for NIP-32/43/51/85/86/77 support.
 */

import type { LiveRelayRecord } from '@/hooks/useLiveRelayStore';
import type { LabelStats } from '@/hooks/useRelayLabels';
import type { RelayTrustScore } from '@/hooks/useTrustedAssertions';
import type { RelayMembership } from '@/hooks/useRelayMembership';

export interface HealthScoreBreakdown {
  /** Total score 0-100 */
  total: number;
  /** Letter grade A-F */
  grade: string;
  /** Individual component scores */
  components: HealthComponent[];
}

export interface HealthComponent {
  name: string;
  description: string;
  /** Max points for this component */
  maxPoints: number;
  /** Actual points earned */
  points: number;
  /** 0-1 percentage */
  percent: number;
}

/**
 * Extended relay record with additional NIP data for health scoring.
 */
export interface ExtendedRelayRecord extends LiveRelayRecord {
  /** NIP-32 label stats */
  labelStats?: LabelStats;
  /** NIP-85 trusted assertion score */
  trustedAssertion?: RelayTrustScore;
  /** NIP-43 membership data */
  membership?: RelayMembership;
  /** NIP-67 EOSE hints supported */
  eoseHintsSupported?: boolean;
  /** NIP-77 negentropy supported */
  negentropySupported?: boolean;
  /** NIP-86 management API supported */
  managementApiSupported?: boolean;
}

/**
 * Compute a transparent health score for a relay.
 *
 * Components (v2 — NIP-enhanced):
 * - 30-day uptime: 25 pts (reduced from 35 to make room for NIP features)
 * - Average latency: 15 pts (reduced from 20)
 * - NIP-11 completeness: 10 pts
 * - Community trust (NIP-32 labels + NIP-85 assertions): 10 pts
 * - NIP support breadth: 10 pts
 * - Operator verification: 10 pts
 * - NIP-43 membership features: 5 pts
 * - NIP-67/77/86 advanced features: 5 pts
 * - Directory age: 5 pts
 */
export function computeHealthScore(relay: ExtendedRelayRecord): HealthScoreBreakdown {
  const components: HealthComponent[] = [];

  // 1. Uptime (25 points)
  const uptimePoints = Math.min(relay.uptimePercent30d, 100) * 0.25;
  components.push({
    name: '30-Day Uptime',
    description: `${relay.uptimePercent30d.toFixed(1)}% uptime over the last 30 days`,
    maxPoints: 25,
    points: Math.round(uptimePoints * 10) / 10,
    percent: relay.uptimePercent30d / 100,
  });

  // 2. Latency (15 points) — <50ms = 15pts, >2000ms = 0pts
  let latencyPoints = 0;
  const latency = relay.liveLatencyMs ?? relay.avgLatencyMs;
  if (latency != null) {
    latencyPoints = Math.max(0, 15 - (latency / 133));
    latencyPoints = Math.min(latencyPoints, 15);
  }
  components.push({
    name: 'Latency',
    description: latency != null ? `${latency}ms average round-trip time` : 'No latency data available',
    maxPoints: 15,
    points: Math.round(latencyPoints * 10) / 10,
    percent: latencyPoints / 15,
  });

  // 3. NIP-11 completeness (10 points)
  const nip11 = relay.liveNip11 ?? relay.nip11;
  let nip11Score = 0;
  if (nip11.name) nip11Score += 2;
  if (nip11.description) nip11Score += 2;
  if (nip11.contact || nip11.pubkey) nip11Score += 2;
  if (nip11.icon) nip11Score += 1;
  if (nip11.software) nip11Score += 1;
  if ((nip11.supported_nips?.length ?? 0) > 0) nip11Score += 2;
  nip11Score = Math.min(nip11Score, 10);

  const nip11Fields: string[] = [];
  if (nip11.name) nip11Fields.push('name');
  if (nip11.description) nip11Fields.push('description');
  if (nip11.contact || nip11.pubkey) nip11Fields.push('contact');
  if (nip11.icon) nip11Fields.push('icon');
  if (nip11.software) nip11Fields.push('software');
  if ((nip11.supported_nips?.length ?? 0) > 0) nip11Fields.push('NIPs');

  components.push({
    name: 'NIP-11 Info',
    description: nip11Fields.length > 0
      ? `Provides: ${nip11Fields.join(', ')}`
      : 'No NIP-11 document available',
    maxPoints: 10,
    points: nip11Score,
    percent: nip11Score / 10,
  });

  // 4. Community trust (10 points) — NIP-32 labels + NIP-85 assertions + votes
  let communityPoints = 0;

  // Base trust score from votes
  communityPoints += Math.min(relay.trustScore * 0.05, 5);

  // NIP-32 trusted labels bonus
  if (relay.labelStats?.trustScore) {
    communityPoints += Math.min(relay.labelStats.trustScore * 0.03, 3);
  }

  // NIP-85 trusted assertion bonus
  if (relay.trustedAssertion?.score) {
    communityPoints += Math.min(relay.trustedAssertion.score * 0.02, 2);
  }

  communityPoints = Math.min(communityPoints, 10);

  const trustSources: string[] = [];
  if (relay.trustScore > 0) trustSources.push('community votes');
  if (relay.labelStats?.trustScore) trustSources.push('trusted labels');
  if (relay.trustedAssertion?.score) trustSources.push('WoT assertions');

  components.push({
    name: 'Community Trust',
    description: trustSources.length > 0
      ? `From: ${trustSources.join(', ')}`
      : 'No trust data available',
    maxPoints: 10,
    points: Math.round(communityPoints * 10) / 10,
    percent: communityPoints / 10,
  });

  // 5. NIP support breadth (10 points)
  const nipCount = nip11.supported_nips?.length ?? 0;
  // 1 NIP = 0.5 point, max 10 points (20+ NIPs = max)
  const nipPoints = Math.min(nipCount * 0.5, 10);
  components.push({
    name: 'NIP Support',
    description: `Supports ${nipCount} NIP${nipCount !== 1 ? 's' : ''}`,
    maxPoints: 10,
    points: Math.round(nipPoints * 10) / 10,
    percent: nipPoints / 10,
  });

  // 6. Operator verification (10 points)
  let operatorPoints = 0;
  if (nip11.pubkey) operatorPoints += 4;
  if (relay.nip66?.enriched) operatorPoints += 3;
  if (relay.websiteUrl) operatorPoints += 2;
  if (relay.nip11?.terms_of_service) operatorPoints += 1;
  operatorPoints = Math.min(operatorPoints, 10);

  const verifyItems: string[] = [];
  if (nip11.pubkey) verifyItems.push('operator pubkey');
  if (relay.nip66?.enriched) verifyItems.push('NIP-66 monitored');
  if (relay.websiteUrl) verifyItems.push('website');
  if (relay.nip11?.terms_of_service) verifyItems.push('ToS');

  components.push({
    name: 'Operator Verification',
    description: verifyItems.length > 0
      ? `Verified: ${verifyItems.join(', ')}`
      : 'No operator verification data',
    maxPoints: 10,
    points: operatorPoints,
    percent: operatorPoints / 10,
  });

  // 7. NIP-43 membership features (5 points)
  let membershipPoints = 0;
  if (relay.membership) {
    if (relay.membership.memberCount > 0) membershipPoints += 2;
    if (relay.membership.roles.length > 0) membershipPoints += 2;
    if (relay.membership.requiresInvite) membershipPoints += 1;
  }

  components.push({
    name: 'Membership Features',
    description: relay.membership
      ? `${relay.membership.memberCount} members, ${relay.membership.roles.length} roles`
      : 'No membership data',
    maxPoints: 5,
    points: membershipPoints,
    percent: membershipPoints / 5,
  });

  // 8. Advanced NIP features (5 points)
  let advancedPoints = 0;
  if (relay.eoseHintsSupported) advancedPoints += 1.5;
  if (relay.negentropySupported) advancedPoints += 2;
  if (relay.managementApiSupported) advancedPoints += 1.5;

  const advancedFeatures: string[] = [];
  if (relay.eoseHintsSupported) advancedFeatures.push('NIP-67');
  if (relay.negentropySupported) advancedFeatures.push('NIP-77');
  if (relay.managementApiSupported) advancedFeatures.push('NIP-86');

  components.push({
    name: 'Advanced Protocol',
    description: advancedFeatures.length > 0
      ? `Supports: ${advancedFeatures.join(', ')}`
      : 'No advanced NIP features detected',
    maxPoints: 5,
    points: Math.round(advancedPoints * 10) / 10,
    percent: advancedPoints / 5,
  });

  // 9. Directory age (5 points)
  const ageMs = Date.now() - relay.addedAt;
  const ageMonths = ageMs / (30 * 24 * 60 * 60 * 1000);
  const agePoints = Math.min(ageMonths, 5);
  components.push({
    name: 'Directory Age',
    description: ageMonths >= 1
      ? `In directory for ${Math.floor(ageMonths)} month${Math.floor(ageMonths) !== 1 ? 's' : ''}`
      : 'Recently added to directory',
    maxPoints: 5,
    points: Math.round(agePoints * 10) / 10,
    percent: agePoints / 5,
  });

  // Total
  const total = Math.round(Math.min(components.reduce((s, c) => s + c.points, 0), 100));

  // Grade
  let grade: string;
  if (total >= 90) grade = 'A';
  else if (total >= 80) grade = 'B';
  else if (total >= 65) grade = 'C';
  else if (total >= 50) grade = 'D';
  else grade = 'F';

  return { total, grade, components };
}

/**
 * Get the color class for a grade.
 */
export function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-emerald-500';
    case 'B': return 'text-blue-500';
    case 'C': return 'text-yellow-500';
    case 'D': return 'text-orange-500';
    case 'F': return 'text-red-500';
    default: return 'text-muted-foreground';
  }
}

export function gradeBgColor(grade: string): string {
  switch (grade) {
    case 'A': return 'bg-emerald-500/10 border-emerald-500/30';
    case 'B': return 'bg-blue-500/10 border-blue-500/30';
    case 'C': return 'bg-yellow-500/10 border-yellow-500/30';
    case 'D': return 'bg-orange-500/10 border-orange-500/30';
    case 'F': return 'bg-red-500/10 border-red-500/30';
    default: return 'bg-muted border-border';
  }
}
