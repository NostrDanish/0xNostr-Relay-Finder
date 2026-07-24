/**
 * WorldMapSvg — Lightweight, dependency-free world map silhouette.
 *
 * A simplified equirectangular-projection world map rendered as inline SVG
 * paths (no external tiles, images, or mapping libraries required). Used as
 * the backdrop for AtlasPage's relay markers, which are positioned on top
 * using the same equirectangular projection (see latLngToPercent below).
 *
 * viewBox is 1000 x 500 (2:1 ratio matches equirectangular projection).
 */

export function latLngToPercent(lat: number, lng: number): { xPct: number; yPct: number } {
  const xPct = ((lng + 180) / 360) * 100;
  const yPct = ((90 - lat) / 180) * 100;
  return { xPct, yPct };
}

interface WorldMapSvgProps {
  className?: string;
  landColor?: string;
  strokeColor?: string;
}

/**
 * Simplified continent silhouettes (equirectangular, viewBox 0 0 1000 500).
 * These are deliberately low-fidelity blob shapes — enough to be
 * recognizable as continents without needing an external map library,
 * tile server, or heavy GeoJSON dataset.
 */
export function WorldMapSvg({ className, landColor = 'currentColor', strokeColor = 'transparent' }: WorldMapSvgProps) {
  return (
    <svg
      viewBox="0 0 1000 500"
      className={className}
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g fill={landColor} stroke={strokeColor} strokeWidth={0.5} opacity={0.9}>
        {/* North America */}
        <path d="M55,120 L90,95 L130,90 L160,100 L185,95 L210,110 L230,105 L245,120 L240,145 L255,165 L245,190 L225,205 L235,225 L215,245 L195,240 L180,260 L160,255 L150,275 L130,270 L120,245 L95,235 L85,210 L65,200 L60,175 L45,160 L50,140 Z" />
        {/* Greenland */}
        <path d="M255,70 L280,60 L305,65 L310,85 L290,100 L265,95 L255,85 Z" />
        {/* South America */}
        <path d="M215,270 L245,265 L265,280 L275,310 L270,345 L280,375 L270,410 L255,435 L240,430 L230,400 L215,380 L210,340 L195,310 L200,285 Z" />
        {/* Europe */}
        <path d="M460,110 L485,95 L510,100 L530,90 L550,100 L545,120 L560,135 L545,150 L520,155 L505,145 L485,150 L470,135 L465,120 Z" />
        {/* Africa */}
        <path d="M470,165 L510,160 L540,170 L555,195 L550,225 L560,255 L550,285 L535,320 L515,345 L495,340 L485,310 L470,280 L460,250 L450,220 L455,190 Z" />
        {/* Asia */}
        <path d="M560,80 L610,65 L660,60 L710,70 L760,65 L800,80 L830,100 L850,95 L870,115 L855,140 L865,165 L840,180 L810,175 L790,195 L760,190 L740,210 L710,200 L690,215 L660,205 L640,185 L610,190 L590,170 L570,150 L575,120 L560,105 Z" />
        {/* India subcontinent */}
        <path d="M660,205 L690,200 L705,225 L695,255 L675,270 L660,250 L655,225 Z" />
        {/* Southeast Asia / Indonesia */}
        <path d="M745,235 L775,230 L800,245 L790,265 L760,270 L740,255 Z" />
        <path d="M810,250 L835,245 L850,260 L835,275 L810,270 Z" />
        {/* Japan */}
        <path d="M870,140 L885,135 L895,150 L888,165 L875,160 Z" />
        {/* UK/Ireland */}
        <path d="M445,105 L460,100 L465,115 L455,125 L442,118 Z" />
        {/* Australia */}
        <path d="M790,330 L830,320 L865,330 L880,355 L865,380 L830,390 L800,380 L780,360 Z" />
        {/* New Zealand */}
        <path d="M905,395 L915,390 L920,405 L910,415 L902,405 Z" />
        {/* Madagascar */}
        <path d="M570,320 L580,315 L585,335 L575,350 L568,335 Z" />
      </g>
    </svg>
  );
}
