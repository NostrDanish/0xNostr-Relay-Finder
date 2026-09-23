/**
 * Shared relay URL utilities.
 *
 * Single source of truth for relay URL normalization, validation, and
 * scheme mapping. All discovery / monitor / directory / submission code
 * MUST use these helpers so the same physical relay always keys
 * identically across the app (dedup, enrichment lookups, caches).
 */

/**
 * Normalize a relay URL to its canonical form, or return null if invalid.
 *
 * Canonical form: `wss://<lowercase-host>[:port][/path]`
 * - Requires ws:// or wss:// scheme (ws:// is upgraded to wss://).
 * - Lowercases the host, strips trailing slashes, drops default ports
 *   (443 for wss, 80 for ws — noted before upgrade).
 * - Rejects garbage like `wssfoo`, missing hosts, non-URL input.
 */
export function normalizeRelayUrl(url: string): string | null {
  try {
    const trimmed = url.trim();
    if (!trimmed.startsWith('wss://') && !trimmed.startsWith('ws://')) return null;

    const parsed = new URL(trimmed);
    if (!parsed.hostname) return null;

    const isSecure = parsed.protocol === 'wss:';
    const defaultPort = isSecure ? '443' : '80';

    let normalized = `wss://${parsed.hostname.toLowerCase()}`;
    if (parsed.port && parsed.port !== defaultPort) {
      normalized += `:${parsed.port}`;
    }
    if (parsed.pathname && parsed.pathname !== '/') {
      normalized += parsed.pathname.replace(/\/+$/, '');
    }
    return normalized;
  } catch {
    return null;
  }
}

/** True if the string is a syntactically valid ws(s) relay URL. */
export function isValidRelayUrl(url: string): boolean {
  return normalizeRelayUrl(url) !== null;
}

/**
 * Map a relay WebSocket URL to its HTTP(S) counterpart for NIP-11 fetches.
 * `wss://` → `https://`, `ws://` → `http://`. Returns null for invalid input.
 */
export function relayHttpUrl(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed.startsWith('wss://')) return `https://${trimmed.slice('wss://'.length)}`;
  if (trimmed.startsWith('ws://')) return `http://${trimmed.slice('ws://'.length)}`;
  return null;
}

/** Stable fingerprint for a list of relay URLs (for react-query keys). */
export function relayListFingerprint(urls: readonly string[]): string {
  return urls.length + ':' + urls.join('|');
}
