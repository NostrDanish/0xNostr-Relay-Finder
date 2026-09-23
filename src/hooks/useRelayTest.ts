import { useState, useCallback, useEffect, useRef } from "react";
import { relayHttpUrl } from "@/lib/relayUrl";

type TestStatus = "idle" | "connecting" | "connected" | "failed" | "timeout";

interface RelayTestResult {
  status: TestStatus;
  latencyMs?: number;
  error?: string;
  nip11?: Record<string, unknown>;
}

export function useRelayTest() {
  const [result, setResult] = useState<RelayTestResult>({ status: "idle" });
  // Track the in-flight socket and a token so duplicate test() calls can't
  // race each other or leak sockets, and stale callbacks become no-ops.
  const socketRef = useRef<WebSocket | null>(null);
  const tokenRef = useRef(0);

  const detachSocket = useCallback(() => {
    const ws = socketRef.current;
    socketRef.current = null;
    if (ws) {
      ws.onopen = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        // already closed
      }
    }
  }, []);

  const test = useCallback((url: string) => {
    // Invalidate callbacks from any previous test and close its socket.
    tokenRef.current += 1;
    const token = tokenRef.current;
    detachSocket();

    setResult({ status: "connecting" });
    const start = Date.now();
    let settled = false;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      setResult({ status: "failed", error: String(err) });
      return;
    }
    socketRef.current = ws;

    const isCurrent = () => !settled && token === tokenRef.current;

    const timeout = setTimeout(() => {
      if (!isCurrent()) return;
      settled = true;
      try {
        ws.close();
      } catch {
        // ignore
      }
      setResult({ status: "timeout", error: "Connection timed out after 8 seconds" });
    }, 8000);

    ws.onopen = () => {
      if (!isCurrent()) return;
      settled = true;
      const latencyMs = Date.now() - start;
      clearTimeout(timeout);
      setResult({ status: "connected", latencyMs });
      ws.close();
    };

    ws.onerror = () => {
      if (!isCurrent()) return;
      settled = true;
      clearTimeout(timeout);
      setResult({ status: "failed", error: "WebSocket connection failed" });
    };

    ws.onclose = (e) => {
      // No-op once settled — e.g. the close triggered by the timeout above
      // must not overwrite the "timeout" result.
      if (!isCurrent()) return;
      settled = true;
      clearTimeout(timeout);
      setResult({ status: "failed", error: `Connection closed: code ${e.code}` });
    };
  }, [detachSocket]);

  // Close/detach the socket on unmount
  useEffect(() => {
    return () => {
      tokenRef.current += 1;
      detachSocket();
    };
  }, [detachSocket]);

  const reset = useCallback(() => {
    setResult({ status: "idle" });
  }, []);

  return { result, test, reset };
}

export function useNIP11Fetch() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch11 = useCallback(async (wsUrl: string) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      // wss:// → https://, ws:// → http:// (ws:// is NOT served over https)
      const httpUrl = relayHttpUrl(wsUrl);
      if (!httpUrl) throw new Error(`Invalid relay URL: ${wsUrl}`);
      const res = await fetch(httpUrl, {
        headers: { Accept: "application/nostr+json" },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetch11 };
}
