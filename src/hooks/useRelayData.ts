import { useState, useEffect, useCallback } from "react";
import type { RelayRecord } from "@/types/relay";
import { RELAY_SEED_DATA } from "@/data/relays";

// In a production app, this would query a backend/Supabase.
// Here we use the seed data with localStorage overrides for submitted relays.

const STORAGE_KEY = "0x_nostr_submitted_relays";

function loadSubmittedRelays(): RelayRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RelayRecord[];
  } catch {
    return [];
  }
}

export function useRelayData() {
  const [relays, setRelays] = useState<RelayRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate async load
    const timer = setTimeout(() => {
      const submitted = loadSubmittedRelays();
      setRelays([...RELAY_SEED_DATA, ...submitted]);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const submitRelay = useCallback((relay: RelayRecord) => {
    const submitted = loadSubmittedRelays();
    const updated = [relay, ...submitted];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setRelays((prev) => [relay, ...prev]);
  }, []);

  return { relays, loading, submitRelay };
}

export function useRelayById(urlEncoded: string) {
  const [relay, setRelay] = useState<RelayRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const url = decodeURIComponent(urlEncoded);
    const timer = setTimeout(() => {
      const submitted = loadSubmittedRelays();
      const all = [...RELAY_SEED_DATA, ...submitted];
      const found = all.find((r) => r.url === url);
      if (found) {
        setRelay(found);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [urlEncoded]);

  return { relay, loading, notFound };
}
