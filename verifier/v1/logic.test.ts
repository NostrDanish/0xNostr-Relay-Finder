import { describe, it, expect } from 'vitest';
import { normalizeRelayUrl, relayHttpUrl, isValidRelayUrl, relayListFingerprint } from '@/lib/relayUrl';
import { computeHealthScore } from '@/lib/healthScore';

describe('normalizeRelayUrl', () => {
  it('canonicalizes case and trailing slash', () => {
    expect(normalizeRelayUrl('wss://Relay.Damus.IO/')).toBe('wss://relay.damus.io');
  });
  it('strips default ports', () => {
    expect(normalizeRelayUrl('wss://relay.example.com:443')).toBe('wss://relay.example.com');
  });
  it('keeps non-default ports', () => {
    expect(normalizeRelayUrl('wss://relay.example.com:7777')).toBe('wss://relay.example.com:7777');
  });
  it('upgrades ws to wss', () => {
    expect(normalizeRelayUrl('ws://relay.example.com')).toBe('wss://relay.example.com');
  });
  it('rejects garbage', () => {
    expect(normalizeRelayUrl('wssfoo')).toBeNull();
    expect(normalizeRelayUrl('https://not-a-relay.com')).toBeNull();
    expect(normalizeRelayUrl('')).toBeNull();
  });
  it('keeps paths, strips trailing slashes on path', () => {
    expect(normalizeRelayUrl('wss://relay.example.com/nostr/')).toBe('wss://relay.example.com/nostr');
  });
});

describe('relayHttpUrl', () => {
  it('maps wss to https', () => {
    expect(relayHttpUrl('wss://relay.damus.io')).toBe('https://relay.damus.io');
  });
  it('maps ws to http (not https)', () => {
    expect(relayHttpUrl('ws://relay.damus.io')).toBe('http://relay.damus.io');
  });
  it('rejects non-ws schemes', () => {
    expect(relayHttpUrl('https://x.com')).toBeNull();
  });
});

describe('isValidRelayUrl / relayListFingerprint', () => {
  it('validates', () => {
    expect(isValidRelayUrl('wss://a.com')).toBe(true);
    expect(isValidRelayUrl('wssfoo')).toBe(false);
  });
  it('fingerprint differs for same-length different sets', () => {
    expect(relayListFingerprint(['wss://a.com', 'wss://b.com'])).not.toBe(
      relayListFingerprint(['wss://c.com', 'wss://d.com']),
    );
  });
});

describe('computeHealthScore robustness', () => {
  const base = {
    url: 'wss://x.com',
    name: 'x',
    nip11: {},
    supportedNips: [],
    addedAt: Date.now(),
  } as never;

  it('never produces NaN total', () => {
    const r = computeHealthScore({
      ...base,
      uptimePercent30d: NaN,
      liveLatencyMs: NaN,
      avgLatencyMs: undefined,
    } as never);
    expect(Number.isFinite(r.total)).toBe(true);
    expect(r.total).toBeGreaterThanOrEqual(0);
    expect(r.total).toBeLessThanOrEqual(100);
  });

  it('clamps negative inputs', () => {
    const r = computeHealthScore({
      ...base,
      uptimePercent30d: -50,
      liveLatencyMs: -10,
    } as never);
    expect(r.total).toBeGreaterThanOrEqual(0);
    for (const c of r.components) {
      expect(c.points).toBeGreaterThanOrEqual(0);
      expect(c.points).toBeLessThanOrEqual(c.maxPoints);
      expect(Number.isFinite(c.points)).toBe(true);
    }
  });
});
