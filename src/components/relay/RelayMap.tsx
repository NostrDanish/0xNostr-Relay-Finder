/**
 * RelayMap — Interactive world map of Nostr relays
 *
 * Displays relays on a Leaflet map with:
 * - Custom clustering by zoom/grid
 * - Color-coded markers (green/yellow/red = healthy/slow/offline)
 * - Popup with key relay stats
 * - Continent-level aggregation at low zoom
 * - Bounds tracking and selected-relay highlighting
 */

import { useMemo, useRef, useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents, Tooltip } from 'react-leaflet';
import type { LatLngTuple, LatLngBounds } from 'leaflet';
import { Link } from 'react-router-dom';
import { ArrowRight, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { LiveRelayRecord } from '@/hooks/useLiveRelayStore';
import { decodeGeohash } from '@/hooks/useNIP66Monitor';
import { relayUrlToId, shortenUrl, cn } from '@/lib/utils';

// ─── Map positioning ────────────────────────────────────────────────────────

const DEFAULT_CENTER: LatLngTuple = [25, 10];
const DEFAULT_ZOOM = 3;

// ─── Visible relay with coordinates ─────────────────────────────────────────

interface PlacedRelay extends LiveRelayRecord {
  lat: number;
  lng: number;
  status: 'online' | 'slow' | 'offline';
}

interface RelayCluster {
  id: string;
  lat: number;
  lng: number;
  count: number;
  relays: PlacedRelay[];
  status: 'online' | 'slow' | 'offline';
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
      const monitorGeohash = relay.nip66?.lastMonitorEvent ? relay.geohash : undefined;
      const relayCountryGeohash = relay.nip11?.relay_countries?.[0]; // not geo, ignore
      if (relay.geohash) {
        coords = decodeGeohash(relay.geohash);
      }
      if (!coords && monitorGeohash) {
        coords = decodeGeohash(monitorGeohash);
      }
      if (!coords) return null;
      return {
        ...relay,
        lat: coords.lat,
        lng: coords.lng,
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

function statusFillColor(status: 'online' | 'slow' | 'offline'): string {
  switch (status) {
    case 'online': return 'rgba(16, 185, 129, 0.15)';
    case 'slow': return 'rgba(234, 179, 8, 0.15)';
    case 'offline': return 'rgba(239, 68, 68, 0.15)';
  }
}

function clusterStatus(relays: PlacedRelay[]): 'online' | 'slow' | 'offline' {
  const hasOnline = relays.some((r) => r.status === 'online');
  if (hasOnline) return 'online';
  const hasSlow = relays.some((r) => r.status === 'slow');
  if (hasSlow) return 'slow';
  return 'offline';
}

// ─── Bounds checker ────────────────────────────────────────────────────────

function inBounds(lat: number, lng: number, bounds: LatLngBounds | null): boolean {
  if (!bounds) return true;
  // Handle wrapped longitude (e.g. crossing dateline)
  return lat >= bounds.getSouth() && lat <= bounds.getNorth() && bounds.contains([lat, lng]);
}

// ─── Clustering hook ───────────────────────────────────────────────────────

function useClusteredRelays(
  placedRelays: PlacedRelay[],
  zoom: number,
  bounds: LatLngBounds | null,
  maxIndividualMarkers = 100
): (PlacedRelay | RelayCluster)[] {
  return useMemo(() => {
    const visible = bounds
      ? placedRelays.filter((r) => inBounds(r.lat, r.lng, bounds))
      : placedRelays;

    // At high zoom, show individual markers
    if (zoom >= 6 || visible.length <= maxIndividualMarkers) {
      return visible;
    }

    // Grid-based clustering
    const gridSize = zoom <= 2 ? 20 : zoom <= 4 ? 10 : 5; // degrees per grid cell
    const clusters = new Map<string, PlacedRelay[]>();

    for (const relay of visible) {
      const cellLat = Math.floor(relay.lat / gridSize) * gridSize;
      const cellLng = Math.floor(relay.lng / gridSize) * gridSize;
      const key = `${cellLat}:${cellLng}`;
      const group = clusters.get(key) ?? [];
      group.push(relay);
      clusters.set(key, group);
    }

    return Array.from(clusters.entries()).map(([key, group]) => ({
      id: key,
      lat: group.reduce((s, r) => s + r.lat, 0) / group.length,
      lng: group.reduce((s, r) => s + r.lng, 0) / group.length,
      count: group.length,
      relays: group,
      status: clusterStatus(group),
    }));
  }, [placedRelays, zoom, bounds, maxIndividualMarkers]);
}

// ─── Map controller (sync state) ──────────────────────────────────────────────

function MapStateController({
  onZoomChange,
  onBoundsChange,
}: {
  onZoomChange: (z: number) => void;
  onBoundsChange: (b: LatLngBounds) => void;
}) {
  const map = useMap();

  useEffect(() => {
    onZoomChange(map.getZoom());
    const bounds = map.getBounds();
    if (bounds) onBoundsChange(bounds);
  }, [map, onZoomChange, onBoundsChange]);

  useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
    moveend: () => {
      const b = map.getBounds();
      if (b) onBoundsChange(b);
    },
  });

  return null;
}

// ─── Relay popup content ───────────────────────────────────────────────────

function RelayPopup({ relay, onShowNearby }: { relay: PlacedRelay; onShowNearby?: (url: string) => void }) {
  const nips = relay.liveNip11?.supported_nips ?? relay.nip11?.supported_nips ?? [];
  const latency = relay.liveLatencyMs ?? relay.avgLatencyMs;

  return (
    <div className="min-w-[220px] max-w-[280px] font-sans">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-2.5 h-2.5 rounded-full', relay.status === 'online' ? 'bg-emerald-500' : relay.status === 'slow' ? 'bg-yellow-500' : 'bg-red-500')} />
        <h3 className="font-bold text-sm truncate">{relay.name}</h3>
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

// ─── Continent outlines (simplified bounding polygons) ────────────────────────

interface Continent {
  name: string;
  code: string;
  polygon: LatLngTuple[][];
  center: [number, number];
}

const CONTINENTS: Continent[] = [
  {
    name: 'North America',
    code: 'NA',
    center: [45, -100],
    polygon: [[[15, -170], [15, -50], [75, -50], [75, -170], [15, -170]]],
  },
  {
    name: 'South America',
    code: 'SA',
    center: [-15, -60],
    polygon: [[[-60, -85], [15, -85], [15, -30], [-60, -30], [-60, -85]]],
  },
  {
    name: 'Europe',
    code: 'EU',
    center: [50, 15],
    polygon: [[[35, -25], [35, 45], [75, 45], [75, -25], [35, -25]]],
  },
  {
    name: 'Africa',
    code: 'AF',
    center: [0, 20],
    polygon: [[[-35, -20], [40, -20], [40, 55], [-35, 55], [-35, -20]]],
  },
  {
    name: 'Asia',
    code: 'AS',
    center: [35, 90],
    polygon: [[[10, 45], [10, 180], [75, 180], [75, 45], [10, 45]]],
  },
  {
    name: 'Oceania',
    code: 'OC',
    center: [-25, 135],
    polygon: [[[-50, 110], [0, 110], [0, 180], [-50, 180], [-50, 110]]],
  },
];

function ContinentLayer({ placedRelays }: { placedRelays: PlacedRelay[] }) {
  const map = useMap();
  const zoom = map.getZoom();

  // Only show continent labels/badges at very low zoom
  if (zoom > 2) return null;

  return (
    <>
      {CONTINENTS.map((continent) => {
        const count = placedRelays.filter(
          (r) =>
            r.lat >= Math.min(...continent.polygon[0].map((c) => c[0])) &&
            r.lat <= Math.max(...continent.polygon[0].map((c) => c[0])) &&
            r.lng >= Math.min(...continent.polygon[0].map((c) => c[1])) &&
            r.lng <= Math.max(...continent.polygon[0].map((c) => c[1]))
        ).length;
        if (count === 0) return null;
        return (
          <CircleMarker
            key={continent.code}
            center={continent.center}
            radius={18}
            pathOptions={{
              fillColor: 'hsl(var(--primary))',
              fillOpacity: 0.2,
              color: 'hsl(var(--primary))',
              weight: 2,
            }}
          >
            <Tooltip permanent direction="top" className="bg-transparent border-0 shadow-none">
              <div className="text-center">
                <div className="font-black text-lg">{count}</div>
                <div className="text-[10px] font-medium text-muted-foreground">{continent.name}</div>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

export interface RelayMapProps {
  relays: LiveRelayRecord[];
  selectedRelayUrl?: string | null;
  onShowNearby?: (url: string) => void;
  height?: string;
  className?: string;
}

export function RelayMap({ relays, selectedRelayUrl, onShowNearby, height = '600px', className }: RelayMapProps) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [bounds, setBounds] = useState<LatLngBounds | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<{ flyTo: (coords: [number, number], zoom: number) => void } | null>(null);

  const placedRelays = useMemo(() => placeRelays(relays), [relays]);
  const displayed = useClusteredRelays(placedRelays, zoom, bounds);

  // Fly to selected relay when it changes
  const selectedRelay = useMemo(
    () => placedRelays.find((r) => r.url === selectedRelayUrl),
    [placedRelays, selectedRelayUrl]
  );

  // Keep track of map instance for flyTo
  function MapReadyController() {
    const map = useMap();
    useEffect(() => {
      setMapReady(true);
      mapRef.current = {
        flyTo: (coords, z) => map.flyTo(coords, z),
      };
    }, [map]);
    return null;
  }

  useEffect(() => {
    if (selectedRelay && mapRef.current) {
      mapRef.current.flyTo([selectedRelay.lat, selectedRelay.lng], Math.max(zoom, 8));
    }
  }, [selectedRelay]);

  return (
    <div className={cn('relative w-full rounded-2xl overflow-hidden border border-border/60', className)} style={{ height }}>
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapStateController onZoomChange={setZoom} onBoundsChange={setBounds} />
        <MapReadyController />

        {/* Continent summary badges at very low zoom */}
        <ContinentLayer placedRelays={placedRelays} />

        {/* Selected relay highlight ring */}
        {selectedRelay && (
          <CircleMarker
            center={[selectedRelay.lat, selectedRelay.lng]}
            radius={18}
            pathOptions={{
              fillColor: 'transparent',
              color: 'hsl(var(--primary))',
              weight: 3,
              opacity: 0.8,
            }}
          />
        )}

        {/* Markers and clusters */}
        {displayed.map((item, idx) => {
          if ('count' in item) {
            // Cluster marker
            const radius = Math.min(32, 10 + item.count * 2);
            return (
              <CircleMarker
                key={`cluster-${item.id}`}
                center={[item.lat, item.lng]}
                radius={radius}
                pathOptions={{
                  fillColor: statusFillColor(item.status),
                  color: statusColor(item.status),
                  weight: 2,
                  fillOpacity: 0.8,
                }}
              >
                <Tooltip direction="top" className="text-xs font-medium">
                  {item.count} relay{item.count !== 1 ? 's' : ''}
                </Tooltip>
                <Popup>
                  <div className="font-sans min-w-[180px]">
                    <h4 className="font-bold text-sm mb-2">{item.count} relay{item.count !== 1 ? 's' : ''}</h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto text-xs">
                      {item.relays.slice(0, 10).map((r) => (
                        <div key={r.url} className="flex items-center gap-2 py-1 border-b border-border/30 last:border-0">
                          <div className={cn('w-2 h-2 rounded-full', r.status === 'online' ? 'bg-emerald-500' : r.status === 'slow' ? 'bg-yellow-500' : 'bg-red-500')} />
                          <span className="truncate flex-1">{shortenUrl(r.url)}</span>
                          <span className="text-muted-foreground">{r.uptimePercent30d.toFixed(0)}%</span>
                        </div>
                      ))}
                      {item.relays.length > 10 && (
                        <div className="text-muted-foreground text-center py-1">+{item.relays.length - 10} more</div>
                      )}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          }

          // Individual relay marker
          const relay = item as PlacedRelay;
          const radius = selectedRelayUrl === relay.url ? 10 : 7;
          return (
            <CircleMarker
              key={relay.url}
              center={[relay.lat, relay.lng]}
              radius={radius}
              pathOptions={{
                fillColor: statusColor(relay.status),
                color: '#fff',
                weight: 2,
                fillOpacity: 0.9,
              }}
            >
              <Popup minWidth={240} maxWidth={300}>
                <RelayPopup relay={relay} onShowNearby={onShowNearby} />
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80 z-10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Radio className="w-4 h-4 animate-spin" />
            Loading Atlas…
          </div>
        </div>
      )}
    </div>
  );
}
