import { useState, useEffect, useMemo } from "react";
import type { RelayRecord } from "@/types/relay";
import { RELAY_SEED_DATA } from "@/data/relays";
import { useRelayDirectory } from "@/hooks/useRelayDirectory";

/**
 * Combined relay data hook.
 *
 * Sources (merged in order of priority):
 * 1. Seed data (hardcoded, highest trust)
 * 2. kind:30078 events from wss://0xPrivacy.nostr1.com (user-submitted)
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

  const relays = useMemo(() => {
    if (!seedLoaded) return [];
    const seedUrls = new Set(RELAY_SEED_DATA.map((r) => r.url));
    const nostrOnly = (nostrRelays ?? []).filter((r) => !seedUrls.has(r.url));
    return [...RELAY_SEED_DATA, ...nostrOnly];
  }, [seedLoaded, nostrRelays]);

  const loading = !seedLoaded || nostrLoading;

  return { relays, loading };
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
