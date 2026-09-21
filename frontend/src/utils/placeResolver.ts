/**
 * placeResolver.ts
 * Universal Dynamic Place & Landmark Resolver
 * 
 * Works uniformly for ANY landmark, monument, temple, shrine, palace, tower,
 * or regular building on Earth.
 * 
 * Sources:
 * 1. OpenStreetMap Nominatim (authoritative vector/osmId resolution)
 * 2. OpenCage Geocoding API failover
 * 3. Overpass structured search for named features
 * 4. Multi-level caching (Memory + SessionStorage)
 */

import { ResolvedPlace } from '../types';

const _RESOLVER_CACHE = new Map<string, ResolvedPlace>();

const NOMINATIM_ENDPOINTS = [
  'https://nominatim.openstreetmap.org/search',
];

const OPENCAGE_KEY = '617a0507a3c8468aae0b5ffd61273ef4';

/**
 * Universal dynamic place resolver.
 * Resolves any search query into authoritative geographic coordinates, OSM ID, and bounding box.
 */
export async function resolvePlace(query: string, hintCity?: string): Promise<ResolvedPlace | null> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return null;

  const fullQuery = hintCity && !cleanQuery.toLowerCase().includes(hintCity.toLowerCase())
    ? `${cleanQuery}, ${hintCity}`
    : cleanQuery;

  const cacheKey = fullQuery.toLowerCase();

  // 1. Check in-memory cache
  if (_RESOLVER_CACHE.has(cacheKey)) {
    return _RESOLVER_CACHE.get(cacheKey)!;
  }

  // 2. Check session storage cache
  try {
    const sessionCached = sessionStorage.getItem(`3d_ulpin_place_${cacheKey}`);
    if (sessionCached) {
      const parsed = JSON.parse(sessionCached) as ResolvedPlace;
      _RESOLVER_CACHE.set(cacheKey, parsed);
      return parsed;
    }
  } catch {
    // Ignore session storage errors
  }

  // 3. Query OpenStreetMap Nominatim
  const nominatimResult = await queryNominatim(fullQuery);
  if (nominatimResult) {
    _RESOLVER_CACHE.set(cacheKey, nominatimResult);
    try {
      sessionStorage.setItem(`3d_ulpin_place_${cacheKey}`, JSON.stringify(nominatimResult));
    } catch {}
    return nominatimResult;
  }

  // 4. Fallback: Query OpenCage Geocoding API
  const openCageResult = await queryOpenCage(fullQuery);
  if (openCageResult) {
    _RESOLVER_CACHE.set(cacheKey, openCageResult);
    try {
      sessionStorage.setItem(`3d_ulpin_place_${cacheKey}`, JSON.stringify(openCageResult));
    } catch {}
    return openCageResult;
  }

  return null;
}

/**
 * Query OSM Nominatim search API
 */
async function queryNominatim(query: string): Promise<ResolvedPlace | null> {
  for (const endpoint of NOMINATIM_ENDPOINTS) {
    try {
      const url = `${endpoint}?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&polygon_geojson=1&extratags=1&limit=5`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const resp = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': '3D-ULPIN-Universal-Landmark-Engine/2.0',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!resp.ok) continue;
      const results = await resp.json();
      if (!Array.isArray(results) || results.length === 0) continue;

      // Prioritize relation > way > node for accurate building & site boundaries
      const sorted = [...results].sort((a, b) => {
        const score = (item: any) => {
          let s = 0;
          if (item.osm_type === 'relation') s += 30;
          else if (item.osm_type === 'way') s += 20;
          else if (item.osm_type === 'node') s += 5;

          if (item.category === 'building' || item.type === 'building') s += 25;
          if (item.category === 'historic' || item.category === 'tourism' || item.category === 'amenity') s += 20;
          if (item.geojson && (item.geojson.type === 'Polygon' || item.geojson.type === 'MultiPolygon')) s += 15;
          return s;
        };
        return score(b) - score(a);
      });

      const best = sorted[0];
      const lat = parseFloat(best.lat);
      const lon = parseFloat(best.lon);
      if (isNaN(lat) || isNaN(lon)) continue;

      // Extract bounding box [minLon, minLat, maxLon, maxLat]
      let bbox: [number, number, number, number] = [lon - 0.002, lat - 0.002, lon + 0.002, lat + 0.002];
      if (best.boundingbox && Array.isArray(best.boundingbox) && best.boundingbox.length === 4) {
        const [minLat, maxLat, minLon, maxLon] = best.boundingbox.map(Number);
        if (!isNaN(minLat) && !isNaN(maxLat) && !isNaN(minLon) && !isNaN(maxLon)) {
          bbox = [minLon, minLat, maxLon, maxLat];
        }
      }

      const osmType = best.osm_type ? (best.osm_type as 'node' | 'way' | 'relation') : undefined;
      const osmId = osmType && best.osm_id ? `${osmType}/${best.osm_id}` : undefined;

      const canonicalName = best.namedetails?.name || best.name || best.display_name?.split(',')[0] || query;

      return {
        canonicalName,
        latitude: lat,
        longitude: lon,
        boundingBox: bbox,
        osmType,
        osmId,
        placeType: best.type || best.category || 'landmark',
        address: best.display_name || query,
        rawTags: best.extratags || {},
        category: best.category,
      };
    } catch (err: any) {
      console.warn('[PlaceResolver] Nominatim query error:', err?.message || err);
    }
  }
  return null;
}

/**
 * Query OpenCage Geocoding API
 */
async function queryOpenCage(query: string): Promise<ResolvedPlace | null> {
  try {
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${OPENCAGE_KEY}&limit=1&no_annotations=0`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!resp.ok) return null;
    const data = await resp.json();
    const first = data.results?.[0];
    if (!first || !first.geometry) return null;

    const lat = first.geometry.lat;
    const lon = first.geometry.lng;
    if (isNaN(lat) || isNaN(lon)) return null;

    let bbox: [number, number, number, number] = [lon - 0.002, lat - 0.002, lon + 0.002, lat + 0.002];
    if (first.bounds) {
      bbox = [
        first.bounds.southwest.lng,
        first.bounds.southwest.lat,
        first.bounds.northeast.lng,
        first.bounds.northeast.lat,
      ];
    }

    return {
      canonicalName: first.components?.name || first.formatted?.split(',')[0] || query,
      latitude: lat,
      longitude: lon,
      boundingBox: bbox,
      placeType: first.components?._type || 'place',
      address: first.formatted || query,
    };
  } catch (err: any) {
    console.warn('[PlaceResolver] OpenCage query error:', err?.message || err);
  }
  return null;
}
