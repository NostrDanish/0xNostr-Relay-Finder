/**
 * Relay Health Score Algorithm
 *
 * A transparent, auditable scoring system with public formula.
 * Each component contributes a portion of the total 100-point score.
 * Breakdown is visible on the relay detail page.
 */

import type { LiveRelayRecord } from '@/hooks/useLiveRelayStore';

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
 * Compute a transparent health score for a relay.
 *
 * Components:
 * - 30-day uptime: 35 pts
 * - Average latency: 20 pts
 * - NIP-11 completeness: 10 pts
 * - Community trust: 10 pts
 * - NIP support breadth: 10 pts
 * - Operator verification: 10 pts
 * - Directory age: 5 pts
 */
export function computeHealthScore(relay: LiveRelayRecord): HealthScoreBreakdown {
  const components: HealthComponent[] = [];

  // 1. Uptime (35 points)
  const uptimePoints = Math.min(relay.uptimePercent30d, 100) * 0.35;
  components.push({
    name: '30-Day Uptime',
    description: `${relay.uptimePercent30d.toFixed(1)}% uptime over the last 30 days`,
    maxPoints: 35,
    points: Math.round(uptimePoints * 10) / 10,
    percent: relay.uptimePercent30d / 100,
  });

  // 2. Latency (20 points) — <50ms = 20pts, >2000ms = 0pts
  let latencyPoints = 0;
  const latency = relay.liveLatencyMs ?? relay.avgLatencyMs;
  if (latency != null) {
    // 50ms = 20pts, 100ms = 18pts, 200ms = 14pts, 500ms = 8pts, 1000ms = 4pts, 2000ms = 0pts
    latencyPoints = Math.max(0, 20 - (latency / 100));
    latencyPoints = Math.min(latencyPoints, 20);
  }
  components.push({
    name: 'Latency',
    description: latency != null ? `${latency}ms average round-trip time` : 'No latency data available',
    maxPoints: 20,
    points: Math.round(latencyPoints * 10) / 10,
    percent: latencyPoints / 20,
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

  // 4. Community trust score (10 points) — from existing trustScore
  const communityPoints = Math.min(relay.trustScore * 0.1, 10);
  components.push({
    name: 'Community Trust',
    description: `Trust score: ${relay.trustScore}/100 from community votes`,
    maxPoints: 10,
    points: Math.round(communityPoints * 10) / 10,
    percent: communityPoints / 10,
  });

  // 5. NIP support breadth (10 points)
  const nipCount = nip11.supported_nips?.length ?? 0;
  // 1 NIP = 1 point, max 10 points
  const nipPoints = Math.min(nipCount, 10);
  components.push({
    name: 'NIP Support',
    description: `Supports ${nipCount} NIP${nipCount !== 1 ? 's' : ''}`,
    maxPoints: 10,
    points: nipPoints,
    percent: nipPoints / 10,
  });

  // 6. Operator verification (10 points)
  let operatorPoints = 0;
  if (nip11.pubkey) operatorPoints += 5; // Has operator pubkey
  if (relay.nip66?.enriched) operatorPoints += 3; // NIP-66 data available
  if (relay.websiteUrl) operatorPoints += 2; // Has website
  operatorPoints = Math.min(operatorPoints, 10);

  const verifyItems: string[] = [];
  if (nip11.pubkey) verifyItems.push('operator pubkey');
  if (relay.nip66?.enriched) verifyItems.push('NIP-66 monitored');
  if (relay.websiteUrl) verifyItems.push('website');

  components.push({
    name: 'Operator Verification',
    description: verifyItems.length > 0
      ? `Verified: ${verifyItems.join(', ')}`
      : 'No operator verification data',
    maxPoints: 10,
    points: operatorPoints,
    percent: operatorPoints / 10,
  });

  // 7. Directory age (5 points)
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
