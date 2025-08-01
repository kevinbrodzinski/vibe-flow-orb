import { encode, decode } from 'ngeohash';

export const stepForZoom = (z: number) => 0.03 / 2 ** Math.max(0, Math.max(3, z) - 10);

export function tilesForViewport(
  nw: [number, number], se: [number, number], zoom: number, p = 5
) {
  const ids = new Set<string>();
  const step = stepForZoom(zoom);

  for (let lat = se[0]; lat <= nw[0]; lat += step) {
    for (let lng = nw[1]; lng <= se[1]; lng += step) {
      ids.add(encode(lat, lng, p).slice(0, p));
    }
  }
  return [...ids];
}

/**
 * Get the center point of a geohash
 */
export function geohashToCenter(geohash: string): [number, number] {
  const { latitude, longitude } = decode(geohash);
  return [latitude, longitude];
}

/**
 * Convert HSL color object to CSS hsl string
 */
export function hslToString(hsl: { h: number; s: number; l: number }): string {
  return `hsl(${hsl.h}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%)`;
}

/**
 * Converts visible bounds to a stable list of geohash-6 tile IDs.
 * Used to match the get-field-tiles edge function API contract.
 */
export function viewportToTileIds(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  precision = 6
): string[] {
  const ids = new Set<string>();
  const step = 0.03; // ≈3 km at equator → safe oversample

  for (let lat = minLat; lat <= maxLat; lat += step) {
    for (let lng = minLng; lng <= maxLng; lng += step) {
      ids.add(encode(lat, lng, precision));
    }
  }

  return [...ids];
}

/**
 * Map tile_id to screen coordinates for ripple effects and heat tiles
 */
export function tileIdToScreenCoords(
  tileId: string,
  viewport: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  screenSize: { width: number; height: number }
): { x: number; y: number; size: number } {
  const { latitude, longitude } = decode(tileId);
  
  const x = ((longitude - viewport.minLng) / (viewport.maxLng - viewport.minLng)) * screenSize.width;
  const y = ((latitude - viewport.minLat) / (viewport.maxLat - viewport.minLat)) * screenSize.height;
  
  // Calculate tile size based on precision and viewport
  const latRange = viewport.maxLat - viewport.minLat;
  const lngRange = viewport.maxLng - viewport.minLng;
  const avgRange = (latRange + lngRange) / 2;
  const size = Math.max(20, (avgRange / Math.pow(32, tileId.length - 1)) * screenSize.width * 0.5);
  
  return { x, y, size };
}

/**
 * Calculate radius based on crowd count
 */
export function crowdCountToRadius(count: number): number {
  // Logarithmic scaling for better visual distribution
  const baseRadius = 20;
  const scale = Math.log(count + 1) * 8;
  return Math.min(baseRadius + scale, 100); // Cap at 100px
}