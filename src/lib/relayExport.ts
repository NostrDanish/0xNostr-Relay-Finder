/**
 * Relay Export Utilities (nostr.watch relays.json parity)
 *
 * Client-side export of the relay directory as downloadable JSON/CSV.
 * Equivalent to nostr.watch's static /relays.json API — but generated
 * on demand in the browser from live data.
 */

import type { LiveRelayRecord } from '@/hooks/useLiveRelayStore';

export interface RelayExportRecord {
  url: string;
  name: string;
  description: string;
  online: boolean;
  uptimePercent30d: number;
  avgLatencyMs: number | null;
  trustScore: number;
  country: string | undefined;
  software: string | undefined;
  version: string | undefined;
  supportedNips: number[];
  useCases: string[];
  isFree: boolean;
  authRequired: boolean;
  paymentRequired: boolean;
  blossomSupported: boolean;
  nip66Enriched: boolean;
  geohash: string | undefined;
  operatorPubkey: string | undefined;
  lastChecked: number;
}

/**
 * Convert live relay records to a clean export format.
 */
export function toExportRecords(relays: LiveRelayRecord[]): RelayExportRecord[] {
  return relays.map((r) => ({
    url: r.url,
    name: r.name,
    description: r.description,
    online: r.liveOnline ?? r.isOnline,
    uptimePercent30d: r.uptimePercent30d,
    avgLatencyMs: r.liveLatencyMs ?? r.avgLatencyMs ?? null,
    trustScore: r.trustScore,
    country: r.countryCode,
    software: r.liveNip11?.software ?? r.nip11.software,
    version: r.liveNip11?.version ?? r.nip11.version,
    supportedNips: r.liveNip11?.supported_nips ?? r.nip11.supported_nips ?? [],
    useCases: r.useCases,
    isFree: r.isFree,
    authRequired: r.monitorRequirements?.auth ?? r.nip11.limitation?.auth_required ?? false,
    paymentRequired: r.monitorRequirements?.payment ?? r.nip11.limitation?.payment_required ?? false,
    blossomSupported: r.blossomSupported,
    nip66Enriched: r.nip66?.enriched ?? false,
    geohash: r.geohash,
    operatorPubkey: r.liveNip11?.pubkey ?? r.nip11.pubkey,
    lastChecked: r.lastChecked,
  }));
}

/**
 * Download relays as JSON (relays.json equivalent).
 */
export function exportRelaysAsJson(relays: LiveRelayRecord[]): void {
  const records = toExportRecords(relays);
  const payload = {
    generated_at: new Date().toISOString(),
    generator: '0xRelayFinder',
    count: records.length,
    relays: records,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `relays-${dateSlug()}.json`);
}

/**
 * Download relays as CSV.
 */
export function exportRelaysAsCsv(relays: LiveRelayRecord[]): void {
  const records = toExportRecords(relays);
  const headers = [
    'url', 'name', 'online', 'uptime_30d', 'latency_ms', 'trust_score',
    'country', 'software', 'version', 'nip_count', 'free', 'auth_required',
    'payment_required', 'blossom', 'nip66_enriched', 'geohash',
  ];

  const rows = records.map((r) => [
    r.url,
    csvEscape(r.name),
    r.online ? '1' : '0',
    r.uptimePercent30d.toFixed(1),
    r.avgLatencyMs?.toString() ?? '',
    r.trustScore.toString(),
    r.country ?? '',
    r.software ?? '',
    r.version ?? '',
    r.supportedNips.length.toString(),
    r.isFree ? '1' : '0',
    r.authRequired ? '1' : '0',
    r.paymentRequired ? '1' : '0',
    r.blossomSupported ? '1' : '0',
    r.nip66Enriched ? '1' : '0',
    r.geohash ?? '',
  ]);

  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  downloadBlob(blob, `relays-${dateSlug()}.csv`);
}

/**
 * Download relays as a NIP-65-ready relay list (just URLs + read/write).
 */
export function exportRelaysAsList(relays: LiveRelayRecord[]): void {
  const records = toExportRecords(relays).filter((r) => r.online);
  const list = records.map((r) => ({ url: r.url, read: true, write: true }));
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `relay-list-${dateSlug()}.json`);
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function dateSlug(): string {
  return new Date().toISOString().slice(0, 10);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
