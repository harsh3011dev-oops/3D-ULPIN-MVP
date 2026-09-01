import type maplibregl from 'maplibre-gl';

/** Re:Earth open terrain + buildings tile services (no API key required). */
export const REEARTH = {
  terrainTileJson: 'https://terrain.reearth.land/terrarium/elevation/tilejson.json',
  buildingsTileset: 'https://buildings.reearth.land/tileset.json',
  heightsApi: 'https://terrain.reearth.land/heights.json',
  attribution:
    'Terrain & Buildings © Re:Earth · OSM · Overture (ODbL) · Mapterhorn (CC BY 4.0)',
} as const;

const TERRAIN_SOURCE_ID = 'reearth-terrain';
const HILLSHADE_LAYER_ID = 'reearth-hillshade';

/** Enable Re:Earth raster DEM terrain + hillshade on a MapLibre map instance. */
export function setupReearthTerrain(map: maplibregl.Map, exaggeration = 1.25): void {
  const addLayers = () => {
    if (!map.getSource(TERRAIN_SOURCE_ID)) {
      map.addSource(TERRAIN_SOURCE_ID, {
        type: 'raster-dem',
        url: REEARTH.terrainTileJson,
        tileSize: 256,
      });
    }

    map.setTerrain({ source: TERRAIN_SOURCE_ID, exaggeration });

    if (!map.getLayer(HILLSHADE_LAYER_ID)) {
      map.addLayer({
        id: HILLSHADE_LAYER_ID,
        type: 'hillshade',
        source: TERRAIN_SOURCE_ID,
        paint: {
          'hillshade-exaggeration': 0.4,
          'hillshade-shadow-color': '#0f172a',
          'hillshade-highlight-color': '#e2e8f0',
        },
      });
    }
  };

  if (map.isStyleLoaded()) {
    addLayers();
  } else {
    map.once('style.load', addLayers);
  }
}

export interface TerrainHeightResult {
  elevation: number | null;
  geoid: number | null;
  ellipsoid: number | null;
}

/** Fetch ground elevation (meters MSL) at a lon/lat point from Re:Earth Terrain. */
export async function fetchTerrainHeight(
  longitude: number,
  latitude: number,
): Promise<TerrainHeightResult | null> {
  try {
    const url = `${REEARTH.heightsApi}?points=${longitude},${latitude}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const point = data?.results?.[0];
    if (!point) return null;
    return {
      elevation: point.elevation ?? null,
      geoid: point.geoid ?? null,
      ellipsoid: point.ellipsoid ?? null,
    };
  } catch {
    return null;
  }
}
