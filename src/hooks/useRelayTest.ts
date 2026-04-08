import { useState, useCallback } from "react";

type TestStatus = "idle" | "connecting" | "connected" | "failed" | "timeout";

interface RelayTestResult {
  status: TestStatus;
  latencyMs?: number;
  error?: string;
  nip11?: Record<string, unknown>;
}

export function useRelayTest() {
  const [result, setResult] = useState<RelayTestResult>({ status: "idle" });

  const test = useCallback((url: string) => {
    setResult({ status: "connecting" });
    const start = Date.now();
    let opened = false;

    let ws: WebSocket;
    let timeout: ReturnType<typeof setTimeout>;

    try {
      ws = new WebSocket(url);

      timeout = setTimeout(() => {
        ws.close();
        setResult({ status: "timeout", error: "Connection timed out after 8 seconds" });
      }, 8000);

      ws.onopen = () => {
        opened = true;
        const latencyMs = Date.now() - start;
        clearTimeout(timeout);
        setResult({ status: "connected", latencyMs });
        ws.close();
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        setResult({ status: "failed", error: "WebSocket connection failed" });
      };

      ws.onclose = (e) => {
        clearTimeout(timeout);
        if (!opened) {
          setResult({ status: "failed", error: `Connection closed: code ${e.code}` });
        }
      };
    } catch (err) {
      setResult({ status: "failed", error: String(err) });
    }
  }, []);

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
      const httpUrl = wsUrl.replace(/^wss?:\/\//, "https://");
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
