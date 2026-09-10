/**
 * osmFetcher.ts
 * Fetches comprehensive OpenStreetMap vector and tagging data for 3D reconstruction.
 * Uses multi-endpoint failover and in-memory caching.
 */

export interface OSMElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  members?: Array<{ type: string; ref: number; role: string }>;
  tags?: Record<string, string>;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  geometry?: Array<{ lat: number; lon: number }>;
}

export interface OSMDataResponse {
  version?: number;
  generator?: string;
  elements: OSMElement[];
}

// Primary and fallback Overpass API mirrors (ordered by reliability from browser)
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const _OSM_CLIENT_CACHE = new Map<string, OSMDataResponse>();

/**
 * Fetch detailed OSM data around a geographic coordinate with radius (meters).
 * Includes building, building:part, heights, levels, roof details, historic tags,
 * and all associated node coordinates.
 */
export async function fetchDetailedOSMData(
  lat: number,
  lng: number,
  radius: number = 180,
  osmId?: string | number,
): Promise<OSMDataResponse | null> {
  const cacheKey = `${lat.toFixed(5)}_${lng.toFixed(5)}_${radius}_${osmId || ''}`;
  if (_OSM_CLIENT_CACHE.has(cacheKey)) {
    return _OSM_CLIENT_CACHE.get(cacheKey)!;
  }

  // Build query: if specific OSM ID is provided, include it explicitly, plus surrounding geometry
  let query = '';
  if (osmId && typeof osmId === 'string' && osmId.includes('/')) {
    const [type, id] = osmId.split('/');
    const typeKeyword = type === 'way' ? 'way' : type === 'relation' ? 'relation' : 'node';
    query = `
[out:json][timeout:25];
(
  ${typeKeyword}(${id});
  way["building"](around:${radius},${lat},${lng});
  relation["building"](around:${radius},${lat},${lng});
  way["building:part"](around:${radius},${lat},${lng});
  relation["building:part"](around:${radius},${lat},${lng});
  way["historic"](around:${radius},${lat},${lng});
  relation["historic"](around:${radius},${lat},${lng});
  way["tourism"](around:${radius},${lat},${lng});
  relation["tourism"](around:${radius},${lat},${lng});
  way["man_made"](around:${radius},${lat},${lng});
  relation["man_made"](around:${radius},${lat},${lng});
);
(._;>;);
out body;
`.trim();
  } else {
    query = `
[out:json][timeout:25];
(
  way["building"](around:${radius},${lat},${lng});
  relation["building"](around:${radius},${lat},${lng});
  way["building:part"](around:${radius},${lat},${lng});
  relation["building:part"](around:${radius},${lat},${lng});
  way["historic"](around:${radius},${lat},${lng});
  relation["historic"](around:${radius},${lat},${lng});
  way["tourism"](around:${radius},${lat},${lng});
  relation["tourism"](around:${radius},${lat},${lng});
  way["man_made"](around:${radius},${lat},${lng});
  relation["man_made"](around:${radius},${lat},${lng});
);
(._;>;);
out body;
`.trim();
  }

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20_000);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const contentType = response.headers.get('Content-Type') || '';
        // Skip endpoints returning HTML (rate-limit pages)
        if (!contentType.includes('json') && !contentType.includes('osm') && !contentType.includes('text/plain')) {
          console.warn(`[OSM Fetcher] ${endpoint} returned non-JSON content-type: ${contentType}`);
          continue;
        }
        const text = await response.text();
        if (text.startsWith('{')) {
          const data: OSMDataResponse = JSON.parse(text);
          if (data && Array.isArray(data.elements) && data.elements.length > 0) {
            _OSM_CLIENT_CACHE.set(cacheKey, data);
            return data;
          }
        }
      }
    } catch (err: any) {
      console.warn(`[OSM Fetcher] Endpoint ${endpoint} failed:`, err?.message || err);
    }
  }

  return null;
}
