/**
 * RelayMap — Interactive world map of Nostr relays
 *
 * A dependency-free map built with inline SVG + CSS (no external mapping
 * library, tile server, or image assets required — this avoids CDN/CSS
 * asset resolution issues that come with libraries like Leaflet in
 * restricted build environments).
 *
 * Features:
 * - Simplified world map silhouette (WorldMapSvg) as backdrop
 * - Color-coded markers (green/yellow/red = healthy/slow/offline)
 * - Grid-based clustering when zoomed out / many relays are close together
 * - Pan (drag) and zoom (buttons, wheel, pinch) via CSS transform
 * - Click a marker/cluster for a popover with relay details
 * - Selected-relay highlight + fly-to-on-select behavior
 */

import { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Minus, Plus, Locate, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { LiveRelayRecord } from '@/hooks/useLiveRelayStore';
import { decodeGeohash } from '@/hooks/useNIP66Monitor';
import { relayUrlToId, shortenUrl, cn } from '@/lib/utils';
import { WorldMapSvg, latLngToPercent } from './WorldMapSvg';

// ─── Visible relay with coordinates ─────────────────────────────────────────

interface PlacedRelay extends LiveRelayRecord {
  lat: number;
  lng: number;
  xPct: number;
  yPct: number;
  status: 'online' | 'slow' | 'offline';
}

interface RelayCluster {
  id: string;
  xPct: number;
  yPct: number;
  count: number;
  relays: PlacedRelay[];
  status: 'online' | 'slow' | 'offline';
}

type DisplayItem = PlacedRelay | RelayCluster;

function isCluster(item: DisplayItem): item is RelayCluster {
  return 'count' in item;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getRelayStatus(relay: LiveRelayRecord): 'online' | 'slow' | 'offline' {
  const online = relay.liveOnline ?? relay.isOnline;
  if (!online) return 'offline';
  const lat = relay.liveLatencyMs ?? relay.avgLatencyMs;
  if (lat != null && lat > 250) return 'slow';
  return 'online';
}

function placeRelays(relays: LiveRelayRecord[]): PlacedRelay[] {
  return relays
    .map((relay) => {
      let coords = null;
      if (relay.geohash) {
        coords = decodeGeohash(relay.geohash);
      }
      if (!coords) return null;
      const { xPct, yPct } = latLngToPercent(coords.lat, coords.lng);
      return {
        ...relay,
        lat: coords.lat,
        lng: coords.lng,
        xPct,
        yPct,
        status: getRelayStatus(relay),
      } as PlacedRelay;
    })
    .filter((r): r is PlacedRelay => r != null);
}

function statusColor(status: 'online' | 'slow' | 'offline'): string {
  switch (status) {
    case 'online': return '#10b981'; // emerald-500
    case 'slow': return '#eab308'; // yellow-500
    case 'offline': return '#ef4444'; // red-500
  }
}

function clusterStatus(relays: PlacedRelay[]): 'online' | 'slow' | 'offline' {
  const hasOnline = relays.some((r) => r.status === 'online');
  if (hasOnline) return 'online';
  const hasSlow = relays.some((r) => r.status === 'slow');
  if (hasSlow) return 'slow';
  return 'offline';
}

// ─── Clustering ─────────────────────────────────────────────────────────────

function useClusteredRelays(
  placedRelays: PlacedRelay[],
  zoom: number,
  maxIndividualMarkers = 150
): DisplayItem[] {
  return useMemo(() => {
    // At high zoom, always show individual markers
    if (zoom >= 3 || placedRelays.length <= maxIndividualMarkers) {
      return placedRelays;
    }

    // Grid-based clustering in percent-space; grid cell size shrinks as zoom increases
    const gridSize = zoom <= 1 ? 6 : 3; // percent per grid cell
    const clusters = new Map<string, PlacedRelay[]>();

    for (const relay of placedRelays) {
      const cellX = Math.floor(relay.xPct / gridSize) * gridSize;
      const cellY = Math.floor(relay.yPct / gridSize) * gridSize;
      const key = `${cellX}:${cellY}`;
      const group = clusters.get(key) ?? [];
      group.push(relay);
      clusters.set(key, group);
    }

    return Array.from(clusters.entries()).map(([key, group]) => {
      if (group.length === 1) return group[0];
      return {
        id: key,
        xPct: group.reduce((s, r) => s + r.xPct, 0) / group.length,
        yPct: group.reduce((s, r) => s + r.yPct, 0) / group.length,
        count: group.length,
        relays: group,
        status: clusterStatus(group),
      } as RelayCluster;
    });
  }, [placedRelays, zoom, maxIndividualMarkers]);
}

// ─── Popup content ──────────────────────────────────────────────────────────

function RelayPopupContent({ relay, onShowNearby, onClose }: { relay: PlacedRelay; onShowNearby?: (url: string) => void; onClose: () => void }) {
  const nips = relay.liveNip11?.supported_nips ?? relay.nip11?.supported_nips ?? [];
  const latency = relay.liveLatencyMs ?? relay.avgLatencyMs;

  return (
    <div className="min-w-[220px] max-w-[280px] font-sans bg-card border border-border rounded-xl shadow-2xl p-3">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', relay.status === 'online' ? 'bg-emerald-500' : relay.status === 'slow' ? 'bg-yellow-500' : 'bg-red-500')} />
          <h3 className="font-bold text-sm truncate">{relay.name}</h3>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground flex-shrink-0" aria-label="Close">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <code className="text-[10px] text-muted-foreground font-mono block mb-2 truncate">{shortenUrl(relay.url)}</code>

      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="bg-muted/50 rounded px-2 py-1">
          <div className="text-muted-foreground text-[10px]">Uptime</div>
          <div className="font-bold">{relay.uptimePercent30d.toFixed(1)}%</div>
        </div>
        <div className="bg-muted/50 rounded px-2 py-1">
          <div className="text-muted-foreground text-[10px]">Latency</div>
          <div className="font-bold">{latency != null ? `${latency}ms` : 'N/A'}</div>
        </div>
        <div className="bg-muted/50 rounded px-2 py-1">
          <div className="text-muted-foreground text-[10px]">NIPs</div>
          <div className="font-bold">{nips.length}</div>
        </div>
        <div className="bg-muted/50 rounded px-2 py-1">
          <div className="text-muted-foreground text-[10px]">Software</div>
          <div className="font-bold truncate">{relay.nip11?.software ?? 'Unknown'}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {relay.blossomSupported && <Badge variant="outline" className="text-[9px] border-sky-500/30 text-sky-500 px-1 py-0">Blossom</Badge>}
        {relay.nip11?.limitation?.auth_required && <Badge variant="outline" className="text-[9px] border-rose-500/30 text-rose-500 px-1 py-0">Auth</Badge>}
        {relay.nip11?.limitation?.payment_required && <Badge variant="outline" className="text-[9px] border-yellow-500/30 text-yellow-500 px-1 py-0">Paid</Badge>}
      </div>

      <div className="flex gap-2">
        <Link to={`/relay/${relayUrlToId(relay.url)}`} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="default" className="gap-1.5 text-xs h-7">
            Details <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
        {onShowNearby && (
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => onShowNearby(relay.url)}>
            Nearby
          </Button>
        )}
      </div>
    </div>
  );
}

function ClusterPopupContent({ cluster, onClose }: { cluster: RelayCluster; onClose: () => void }) {
  return (
    <div className="font-sans min-w-[200px] max-w-[240px] bg-card border border-border rounded-xl shadow-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-bold text-sm">{cluster.count} relay{cluster.count !== 1 ? 's' : ''}</h4>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto text-xs">
        {cluster.relays.slice(0, 12).map((r) => (
          <Link
            key={r.url}
            to={`/relay/${relayUrlToId(r.url)}`}
            className="flex items-center gap-2 py-1 border-b border-border/30 last:border-0 hover:text-primary"
          >
            <div className={cn('w-2 h-2 rounded-full flex-shrink-0', r.status === 'online' ? 'bg-emerald-500' : r.status === 'slow' ? 'bg-yellow-500' : 'bg-red-500')} />
            <span className="truncate flex-1">{shortenUrl(r.url)}</span>
            <span className="text-muted-foreground">{r.uptimePercent30d.toFixed(0)}%</span>
          </Link>
        ))}
        {cluster.relays.length > 12 && (
          <div className="text-muted-foreground text-center py-1">+{cluster.relays.length - 12} more</div>
        )}
      </div>
    </div>
  );
}

// ─── Main map component ─────────────────────────────────────────────────────

export interface RelayMapProps {
  relays: LiveRelayRecord[];
  selectedRelayUrl?: string | null;
  onShowNearby?: (url: string) => void;
  height?: string;
  className?: string;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

export function RelayMap({ relays, selectedRelayUrl, onShowNearby, height = '600px', className }: RelayMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStateRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [activePopup, setActivePopup] = useState<DisplayItem | null>(null);

  const placedRelays = useMemo(() => placeRelays(relays), [relays]);
  const displayed = useClusteredRelays(placedRelays, zoom);

  const selectedRelay = useMemo(
    () => placedRelays.find((r) => r.url === selectedRelayUrl),
    [placedRelays, selectedRelayUrl]
  );

  const clampPan = useCallback((x: number, y: number, z: number) => {
    // Allow panning within bounds proportional to zoom level
    const maxOffset = (z - 1) * 50;
    return {
      x: Math.min(maxOffset, Math.max(-maxOffset, x)),
      y: Math.min(maxOffset * 0.5, Math.max(-maxOffset * 0.5, y)),
    };
  }, []);

  const zoomTo = useCallback((newZoom: number, focus?: { xPct: number; yPct: number }) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom));
    setZoom(clamped);
    if (focus) {
      // Center the focus point by panning toward it proportionally to zoom delta
      setPan(clampPan(50 - focus.xPct, 50 - focus.yPct, clamped));
    } else {
      setPan((prev) => clampPan(prev.x, prev.y, clamped));
    }
  }, [clampPan]);

  // Fly to selected relay
  useEffect(() => {
    if (selectedRelay) {
      zoomTo(Math.max(zoom, 4), { xPct: selectedRelay.xPct, yPct: selectedRelay.yPct });
      setActivePopup(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRelay?.url]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.5 : 0.5;
    zoomTo(zoom + delta);
  }, [zoom, zoomTo]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDragging(true);
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
    setActivePopup(null);
  }, [pan]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !dragStateRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragStateRef.current.startX) / rect.width) * 100;
    const dy = ((e.clientY - dragStateRef.current.startY) / rect.height) * 100;
    const next = clampPan(dragStateRef.current.panX + dx, dragStateRef.current.panY + dy, zoom);
    setPan(next);
  }, [dragging, zoom, clampPan]);

  const handlePointerUp = useCallback(() => {
    setDragging(false);
    dragStateRef.current = null;
  }, []);

  const handleReset = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setActivePopup(null);
  }, []);

  const handleMarkerClick = useCallback((item: DisplayItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePopup(item);
  }, []);

  return (
    <div className={cn('relative w-full rounded-2xl overflow-hidden border border-border/60 bg-[#0b1120] select-none', className)} style={{ height }}>
      <div
        ref={containerRef}
        className={cn('relative w-full h-full overflow-hidden touch-none', dragging ? 'cursor-grabbing' : 'cursor-grab')}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={() => setActivePopup(null)}
      >
        {/* Graticule background */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '10% 10%',
            color: 'hsl(var(--foreground))',
          }}
        />

        {/* Pannable / zoomable map layer */}
        <div
          className="absolute inset-0 transition-transform duration-150 ease-out"
          style={{
            transform: `scale(${zoom}) translate(${pan.x}%, ${pan.y}%)`,
            transformOrigin: 'center center',
          }}
        >
          <WorldMapSvg
            className="absolute inset-0 w-full h-full"
            landColor="rgba(255,255,255,0.06)"
          />

          {/* Markers & clusters, positioned absolutely by percent */}
          {displayed.map((item) => {
            const clustered = isCluster(item);
            const isSelected = !clustered && selectedRelayUrl === item.url;
            const size = clustered ? Math.min(28, 14 + item.count * 1.5) : isSelected ? 12 : 8;

            return (
              <button
                key={clustered ? `cluster-${item.id}` : item.url}
                onClick={(e) => handleMarkerClick(item, e)}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 shadow-lg transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-primary"
                style={{
                  left: `${item.xPct}%`,
                  top: `${item.yPct}%`,
                  width: `${size / zoom}px`,
                  height: `${size / zoom}px`,
                  backgroundColor: statusColor(item.status),
                  boxShadow: isSelected ? '0 0 0 4px hsl(var(--primary) / 0.4)' : undefined,
                }}
                title={clustered ? `${item.count} relays` : item.name}
              >
                {clustered && (
                  <span
                    className="absolute inset-0 flex items-center justify-center text-white font-bold"
                    style={{ fontSize: `${Math.max(7, 9 / zoom)}px` }}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Popup — lives inside the same transformed layer, with an inverse
              scale applied so its size/text stays readable at any zoom. */}
          {activePopup && (
            <div
              className="absolute z-20"
              style={{
                left: `${activePopup.xPct}%`,
                top: `${activePopup.yPct}%`,
                transform: `translate(-50%, calc(-100% - 10px)) scale(${1 / zoom})`,
                transformOrigin: 'bottom center',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {isCluster(activePopup) ? (
                <ClusterPopupContent cluster={activePopup} onClose={() => setActivePopup(null)} />
              ) : (
                <RelayPopupContent relay={activePopup} onShowNearby={onShowNearby} onClose={() => setActivePopup(null)} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-10">
        <Button size="icon" variant="secondary" className="h-8 w-8 shadow-lg" onClick={() => zoomTo(zoom + 1)} aria-label="Zoom in">
          <Plus className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="secondary" className="h-8 w-8 shadow-lg" onClick={() => zoomTo(zoom - 1)} aria-label="Zoom out">
          <Minus className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="secondary" className="h-8 w-8 shadow-lg" onClick={handleReset} aria-label="Reset view">
          <Locate className="w-4 h-4" />
        </Button>
      </div>

      {/* Marker count badge */}
      <div className="absolute bottom-3 left-3 z-10">
        <Badge variant="secondary" className="shadow-lg text-xs">
          {placedRelays.length} relay{placedRelays.length !== 1 ? 's' : ''} mapped
        </Badge>
      </div>
    </div>
  );
}
