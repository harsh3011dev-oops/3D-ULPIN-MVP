import { FeatureCollection, Feature, Polygon, MultiPolygon } from 'geojson';

export interface BuildingProperties {
  id: string;
  osmId: number;
  name?: string;
  height: number;
  levels: number;
  isTarget: boolean;
  buildingType: string;
  source: 'height_tag' | 'levels_tag' | 'deterministic_fallback';
}

/**
 * Calculates a 1km bounding box around a [latitude, longitude] center point.
 * 1 degree latitude ~= 111.32 km -> 1km ~= 0.008983 deg
 */
export function get1KmBoundingBox(lat: number, lon: number): [number, number, number, number] {
  const deltaLat = 1.0 / 111.32; // ~0.00898°
  const deltaLon = 1.0 / (111.32 * Math.cos((lat * Math.PI) / 180));

  const south = lat - deltaLat / 2;
  const west = lon - deltaLon / 2;
  const north = lat + deltaLat / 2;
  const east = lon + deltaLon / 2;

  return [south, west, north, east];
}

/**
 * Executes a deterministic Overpass QL query to retrieve all 2D/3D building footprints.
 */
export async function fetchOSMBuildingsIn1Km(
  lat: number,
  lon: number,
  targetBuildingId?: string | number
): Promise<FeatureCollection<Polygon | MultiPolygon, BuildingProperties>> {
  const [south, west, north, east] = get1KmBoundingBox(lat, lon);

  // Overpass QL Query (Ways & Multipolygon Relations with geometry output)
  const overpassQuery = `
    [out:json][timeout:25];
    (
      way["building"](${south},${west},${north},${east});
      relation["building"]["type"="multipolygon"](${south},${west},${north},${east});
    );
    out body;
    >;
    out skel qt;
  `;

  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(overpassQuery)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API query failed with status: ${response.statusText}`);
  }

  const data = await response.json();
  return parseOSMToDeterministicGeoJSON(data, lat, lon, targetBuildingId);
}

/**
 * Converts OSM nodes, ways, and relations into GeoJSON polygons with deterministic heights.
 */
function parseOSMToDeterministicGeoJSON(
  osmData: any,
  centerLat: number,
  centerLon: number,
  targetBuildingId?: string | number
): FeatureCollection<Polygon | MultiPolygon, BuildingProperties> {
  const nodes = new Map<number, [number, number]>();
  const features: Feature<Polygon, BuildingProperties>[] = [];

  // 1. Index Nodes
  for (const el of osmData.elements) {
    if (el.type === 'node') {
      nodes.set(el.id, [el.lon, el.lat]);
    }
  }

  // 2. Parse Building Ways
  for (const el of osmData.elements) {
    if (el.type === 'way' && el.tags && el.tags.building && el.nodes && el.nodes.length >= 4) {
      const coordinates: [number, number][] = [];
      for (const nodeId of el.nodes) {
        const pt = nodes.get(nodeId);
        if (pt) coordinates.push(pt);
      }

      if (coordinates.length < 4) continue;

      // Deterministic Height Calculation (No Randomness)
      let height = 10.5; // Default: 3 storeys * 3.5m
      let levels = 3;
      let source: BuildingProperties['source'] = 'deterministic_fallback';

      if (el.tags.height) {
        const parsedH = parseFloat(el.tags.height.replace(/[^\d.]/g, ''));
        if (!isNaN(parsedH) && parsedH > 0) {
          height = parsedH;
          levels = Math.max(1, Math.round(height / 3.5));
          source = 'height_tag';
        }
      } else if (el.tags['building:levels']) {
        const parsedL = parseInt(el.tags['building:levels'], 10);
        if (!isNaN(parsedL) && parsedL > 0) {
          levels = parsedL;
          height = levels * 3.5;
          source = 'levels_tag';
        }
      }

      // Check if this building is the searched Target
      const isTarget = targetBuildingId
        ? String(el.id) === String(targetBuildingId)
        : isCentroidClosest(coordinates, centerLon, centerLat);

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates],
        },
        properties: {
          id: `OSM_WAY_${el.id}`,
          osmId: el.id,
          name: el.tags.name || el.tags['addr:housename'] || undefined,
          height,
          levels,
          isTarget,
          buildingType: el.tags.building,
          source,
        },
      });
    }
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

function isCentroidClosest(coords: [number, number][], targetLon: number, targetLat: number): boolean {
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of coords) {
    sumLon += lon;
    sumLat += lat;
  }
  const cLon = sumLon / coords.length;
  const cLat = sumLat / coords.length;
  const dist = Math.hypot(cLon - targetLon, cLat - targetLat);
  return dist < 0.0003; // ~30m threshold
}
