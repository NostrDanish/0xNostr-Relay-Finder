import { useState, useEffect, useMemo } from "react";
import type { RelayRecord } from "@/types/relay";
import { RELAY_SEED_DATA } from "@/data/relays";
import { useRelayDirectory } from "@/hooks/useRelayDirectory";
import { useDiscoveredRelays } from "@/hooks/useDiscoveredRelays";
import { normalizeRelayUrl } from "@/lib/relayUrl";

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
  // Live Nostr directory from our app relay
  const { data: nostrRelays, isLoading: nostrLoading } = useRelayDirectory();

  // Stage 1: merge seed + submitted to get the known set.
  // Seed data is available synchronously (no artificial delay).
  const baseRelays = useMemo(() => {
    // Dedup by canonical URL so equivalent forms of the same physical
    // relay can't appear twice, even if the seed list contains dupes.
    const seenUrls = new Set<string>();
    const dedupedSeed = RELAY_SEED_DATA.filter((r) => {
      const key = normalizeRelayUrl(r.url) ?? r.url;
      if (seenUrls.has(key)) return false;
      seenUrls.add(key);
      return true;
    });
    const nostrOnly = (nostrRelays ?? []).filter(
      (r) => !seenUrls.has(normalizeRelayUrl(r.url) ?? r.url),
    );
    return [...dedupedSeed, ...nostrOnly];
  }, [nostrRelays]);

  // Stage 2: auto-discover relays from the NIP-66 monitor network
  const baseUrls = useMemo(() => baseRelays.map((r) => r.url), [baseRelays]);
  const { discovered, totalFound } = useDiscoveredRelays(baseUrls);

  const relays = useMemo(() => {
    return [...baseRelays, ...discovered];
  }, [baseRelays, discovered]);

  const loading = nostrLoading;

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
    const decoded = decodeURIComponent(urlEncoded);
    const target = normalizeRelayUrl(decoded) ?? decoded;
    return relays.find((r) => (normalizeRelayUrl(r.url) ?? r.url) === target) ?? null;
  }, [relays, loading, urlEncoded]);

  // Reset the notFound latch when a different relay is requested.
  useEffect(() => {
    setNotFound(false);
  }, [urlEncoded]);

  useEffect(() => {
    if (!loading && !relay) setNotFound(true);
  }, [loading, relay]);

  return { relay, loading, notFound };
}
