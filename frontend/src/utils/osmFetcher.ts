/**
 * osmFetcher.ts
 * Comprehensive OpenStreetMap vector & metadata fetcher for universal landmark reconstruction.
 * Collects building, building:part, multipolygon, roof shapes, heights, materials, and site complexes.
 */

import { BuildingPartData, LandmarkSite } from '../types';

export interface OSMElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  nodes?: number[];
  members?: Array<{ type: string; ref: number; role: string; geometry?: Array<{ lat: number; lon: number }> }>;
  tags?: Record<string, string>;
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  geometry?: Array<{ lat: number; lon: number }>;
}

export interface OSMDataResponse {
  version?: number;
  generator?: string;
  elements: OSMElement[];
}

// Primary and fallback Overpass API mirrors
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
 * relations, multipolygons, and all associated node coordinates.
 */
export async function fetchDetailedOSMData(
  lat: number,
  lng: number,
  radius: number = 220,
  osmId?: string | number,
): Promise<OSMDataResponse | null> {
  const cacheKey = `${lat.toFixed(5)}_${lng.toFixed(5)}_${radius}_${osmId || ''}`;
  if (_OSM_CLIENT_CACHE.has(cacheKey)) {
    return _OSM_CLIENT_CACHE.get(cacheKey)!;
  }

  // Build query
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
  way["amenity"](around:${radius},${lat},${lng});
  relation["amenity"](around:${radius},${lat},${lng});
  way["man_made"](around:${radius},${lat},${lng});
  relation["man_made"](around:${radius},${lat},${lng});
);
(._;>;);
out body geom;
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
  way["amenity"](around:${radius},${lat},${lng});
  relation["amenity"](around:${radius},${lat},${lng});
  way["man_made"](around:${radius},${lat},${lng});
  relation["man_made"](around:${radius},${lat},${lng});
);
(._;>;);
out body geom;
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
        if (!contentType.includes('json') && !contentType.includes('osm') && !contentType.includes('text/plain')) {
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

/**
 * Extracts structured building parts from raw OSM elements
 */
export function extractBuildingPartsFromOSM(
  osmData: OSMDataResponse,
  fallbackHeight: number = 30,
  fallbackLevels: number = 3
): BuildingPartData[] {
  if (!osmData || !Array.isArray(osmData.elements)) return [];

  // Build node coordinate lookup
  const nodeMap = new Map<number, [number, number]>();
  osmData.elements.forEach((el) => {
    if (el.type === 'node' && el.lat != null && el.lon != null) {
      nodeMap.set(el.id, [el.lon, el.lat]);
    }
  });

  const parts: BuildingPartData[] = [];

  osmData.elements.forEach((el) => {
    const tags = el.tags || {};
    const isPart = Boolean(tags['building:part'] || tags['building'] === 'part');
    const isBuilding = Boolean(tags['building'] && tags['building'] !== 'no');

    if (!isPart && !isBuilding) return;

    // Extract geometry coordinates
    let coords: [number, number][] = [];
    if (el.geometry && el.geometry.length >= 3) {
      coords = el.geometry.map((pt) => [pt.lon, pt.lat]);
    } else if (el.nodes && el.nodes.length >= 3) {
      coords = el.nodes.map((nid) => nodeMap.get(nid)).filter(Boolean) as [number, number][];
    }

    if (coords.length < 3) return;

    // Height & level resolution
    const hStr = tags['height'] || tags['building:height'] || tags['height:m'];
    const minHStr = tags['min_height'] || tags['building:min_height'];
    const lvlStr = tags['building:levels'] || tags['levels'];
    const minLvlStr = tags['building:min_level'] || tags['min_level'];

    let height = hStr ? parseFloat(hStr.replace(/[^\d.]/g, '')) : NaN;
    let minHeight = minHStr ? parseFloat(minHStr.replace(/[^\d.]/g, '')) : 0;
    let levels = lvlStr ? parseInt(lvlStr.replace(/[^\d]/g, ''), 10) : NaN;
    let minLevels = minLvlStr ? parseInt(minLvlStr.replace(/[^\d]/g, ''), 10) : 0;

    const floorHeight = 3.5;
    if (isNaN(height)) {
      if (!isNaN(levels)) {
        height = levels * floorHeight;
      } else {
        height = fallbackHeight;
      }
    }

    if (isNaN(levels)) {
      levels = Math.max(1, Math.round((height - minHeight) / floorHeight));
    }

    // Roof tags
    const roofShape = tags['roof:shape'] || tags['roof_shape'];
    const roofHStr = tags['roof:height'] || tags['roof_height'];
    const roofHeight = roofHStr ? parseFloat(roofHStr.replace(/[^\d.]/g, '')) : undefined;
    const roofMaterial = tags['roof:material'];
    const roofColor = tags['roof:colour'] || tags['roof:color'];

    // Body material & color
    const material = tags['building:material'] || tags['material'];
    const color = tags['building:colour'] || tags['building:color'] || tags['colour'];

    const partData: BuildingPartData = {
      id: `${el.type}/${el.id}`,
      footprint: {
        type: 'Polygon',
        coordinates: [coords],
      },
      height,
      min_height: minHeight,
      levels,
      min_levels: minLevels,
      roof_shape: roofShape,
      roof_height: roofHeight,
      material,
      color,
      roof_material: roofMaterial,
      roof_color: roofColor,
      source: isPart ? 'OSM building:part' : 'OSM building footprint',
      tags,
    };

    parts.push(partData);
  });

  return parts;
}

/**
 * Organizes OSM elements into a site-level representation
 */
export function extractLandmarkSiteFromOSM(osmData: OSMDataResponse, targetId?: string): LandmarkSite {
  const site: LandmarkSite = {
    relatedStructures: [],
    courtyards: [],
    accessStructures: [],
    tags: {},
  };

  if (!osmData || !Array.isArray(osmData.elements)) return site;

  osmData.elements.forEach((el) => {
    const tags = el.tags || {};
    const fullId = `${el.type}/${el.id}`;

    if (targetId && fullId === targetId) {
      site.mainStructure = el;
      site.tags = { ...site.tags, ...tags };
    } else if (tags['amenity'] || tags['historic'] || tags['tourism'] || tags['building']) {
      if (tags['barrier'] === 'gate' || tags['entrance'] || tags['historic'] === 'city_gate') {
        site.accessStructures.push(el);
      } else if (tags['leisure'] === 'garden' || tags['amenity'] === 'courtyard' || tags['landuse'] === 'courtyard') {
        site.courtyards.push(el);
      } else {
        site.relatedStructures.push(el);
      }
    }
  });

  return site;
}
