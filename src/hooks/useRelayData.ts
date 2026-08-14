import { useState, useEffect, useMemo } from "react";
import type { RelayRecord } from "@/types/relay";
import { RELAY_SEED_DATA } from "@/data/relays";
import { useRelayDirectory } from "@/hooks/useRelayDirectory";
import { useDiscoveredRelays } from "@/hooks/useDiscoveredRelays";

/**
 * Combined relay data hook.
 *
 * Sources (merged in order of priority):
 * 1. Seed data (hardcoded, highest trust)
 * 2. kind:30078 events from our app relays (user-submitted, reviewed)
 * 3. NIP-66 discovered relays (auto-imported from the monitor network —
 *    every relay any monitor has health-checked, with real data attached)
 *
 * Deduplication is handled by URL — seed data always wins.
 */
export function useRelayData() {
  const [seedLoaded, setSeedLoaded] = useState(false);

  // Simulate a brief async load for seed data (gives UI time to render skeleton)
  useEffect(() => {
    const t = setTimeout(() => setSeedLoaded(true), 250);
    return () => clearTimeout(t);
  }, []);

  // Live Nostr directory from our app relay
  const { data: nostrRelays, isLoading: nostrLoading } = useRelayDirectory();

  // Stage 1: merge seed + submitted to get the known set
  const baseRelays = useMemo(() => {
    if (!seedLoaded) return [];
    const seedUrls = new Set(RELAY_SEED_DATA.map((r) => r.url));
    const nostrOnly = (nostrRelays ?? []).filter((r) => !seedUrls.has(r.url));
    return [...RELAY_SEED_DATA, ...nostrOnly];
  }, [seedLoaded, nostrRelays]);

  // Stage 2: auto-discover relays from the NIP-66 monitor network
  const baseUrls = useMemo(() => baseRelays.map((r) => r.url), [baseRelays]);
  const { discovered, totalFound } = useDiscoveredRelays(baseUrls);

  const relays = useMemo(() => {
    return [...baseRelays, ...discovered];
  }, [baseRelays, discovered]);

  const loading = !seedLoaded || nostrLoading;

  return { relays, loading, discoveredCount: discovered.length, discoverableTotal: totalFound };
}

/**
 * Looks up a single relay by encoded URL.
 * Checks seed data first, then Nostr-sourced relays.
 */
export function useRelayById(urlEncoded: string) {
  const [notFound, setNotFound] = useState(false);
  const { relays, loading } = useRelayData();

  const relay = useMemo(() => {
    if (loading) return null;
    const url = decodeURIComponent(urlEncoded);
    return relays.find((r) => r.url === url) ?? null;
  }, [relays, loading, urlEncoded]);

  useEffect(() => {
    if (!loading && !relay) setNotFound(true);
  }, [loading, relay]);

  return { relay, loading, notFound };
}
