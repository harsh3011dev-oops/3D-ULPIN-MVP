import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import { FlyToInterpolator, MapViewState } from '@deck.gl/core';
import { fetchOSMBuildingsIn1Km, BuildingProperties } from '../../services/overpassService';
import { FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import { Box, Search, Loader2 } from 'lucide-react';

interface Studio3DULPINMapProps {
  initialLat?: number;
  initialLon?: number;
  targetULPIN?: string;
  accentColor?: 'electric-blue' | 'neon-gold';
  onBuildingSelect?: (props: BuildingProperties) => void;
}

export default function Studio3DULPINMap({
  initialLat = 28.6139,
  initialLon = 77.2090,
  accentColor = 'electric-blue',
  onBuildingSelect,
}: Studio3DULPINMapProps) {
  const [searchCoords, setSearchCoords] = useState<{ lat: number; lon: number }>({
    lat: initialLat,
    lon: initialLon,
  });
  const [inputLat, setInputLat] = useState(initialLat.toString());
  const [inputLon, setInputLon] = useState(initialLon.toString());

  const [geoData, setGeoData] = useState<FeatureCollection<Polygon | MultiPolygon, BuildingProperties> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingProperties | null>(null);

  const [viewState, setViewState] = useState<MapViewState>({
    longitude: initialLon,
    latitude: initialLat,
    zoom: 16.5,
    pitch: 55,
    bearing: -25,
    maxPitch: 85,
    minZoom: 12,
    maxZoom: 20,
  });

  const flyToLocation = useCallback((lat: number, lon: number) => {
    setViewState((prev) => ({
      ...prev,
      longitude: lon,
      latitude: lat,
      zoom: 17.2,
      pitch: 58,
      bearing: ((prev.bearing ?? -25) + 40) % 360,
      transitionDuration: 2200,
      transitionInterpolator: new FlyToInterpolator(),
    }));
  }, []);

  const loadDigitalTwin = useCallback(async (lat: number, lon: number) => {
    setIsLoading(true);
    try {
      const data = await fetchOSMBuildingsIn1Km(lat, lon);
      setGeoData(data);

      const target = data.features.find((f) => f.properties.isTarget);
      if (target) {
        setSelectedBuilding(target.properties);
        if (onBuildingSelect) onBuildingSelect(target.properties);
      }

      flyToLocation(lat, lon);
    } catch (err) {
      console.error('[3D-ULPIN] Overpass Fetch Failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [flyToLocation, onBuildingSelect]);

  useEffect(() => {
    loadDigitalTwin(searchCoords.lat, searchCoords.lon);
  }, [searchCoords.lat, searchCoords.lon, loadDigitalTwin]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(inputLat);
    const lon = parseFloat(inputLon);
    if (!isNaN(lat) && !isNaN(lon)) {
      setSearchCoords({ lat, lon });
    }
  };

  const buildingCadastreLayer = useMemo(() => {
    if (!geoData) return null;

    return new GeoJsonLayer<BuildingProperties>({
      id: '3d-ulpin-cadastre-layer',
      data: geoData,
      pickable: true,
      extruded: true,
      wireframe: true,
      lineWidthMinPixels: 1.2,
      getElevation: (f: any) => f.properties.height,

      getFillColor: (f: any) => {
        if (f.properties.isTarget) {
          return accentColor === 'electric-blue'
            ? [0, 210, 255, 245]
            : [255, 215, 0, 245];
        }
        return [47, 79, 79, 153]; // Dark Slate Grey #2F4F4F @ 60% opacity
      },

      getLineColor: (f: any) => {
        if (f.properties.isTarget) {
          return [125, 249, 255, 255];
        }
        return [74, 107, 107, 180];
      },

      material: {
        ambient: 0.35,
        diffuse: 0.75,
        shininess: 45,
        specularColor: [255, 255, 255],
      },

      onClick: (info: any) => {
        if (info.object) {
          setSelectedBuilding(info.object.properties);
          if (onBuildingSelect) onBuildingSelect(info.object.properties);
        }
      },

      updateTriggers: {
        getFillColor: [accentColor],
        getLineColor: [accentColor],
      },
    });
  }, [geoData, accentColor, onBuildingSelect]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', background: '#090D16', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: 16, left: 16, zIndex: 10,
        display: 'flex', gap: 12, alignItems: 'center',
        background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(12px)',
        padding: '10px 18px', borderRadius: 10, border: '1px solid rgba(56, 189, 248, 0.25)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#38BDF8', fontWeight: 700, fontSize: '0.85rem' }}>
          <Box size={18} />
          <span>3D-ULPIN STUDIO</span>
        </div>

        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="text"
            placeholder="Latitude"
            value={inputLat}
            onChange={(e) => setInputLat(e.target.value)}
            style={{ width: 90, background: '#020617', border: '1px solid #334155', borderRadius: 6, color: '#F8FAFC', padding: '5px 8px', fontSize: '0.8rem', fontFamily: 'monospace' }}
          />
          <input
            type="text"
            placeholder="Longitude"
            value={inputLon}
            onChange={(e) => setInputLon(e.target.value)}
            style={{ width: 90, background: '#020617', border: '1px solid #334155', borderRadius: 6, color: '#F8FAFC', padding: '5px 8px', fontSize: '0.8rem', fontFamily: 'monospace' }}
          />
          <button
            type="submit"
            disabled={isLoading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#0284C7', color: '#FFFFFF', border: 'none',
              borderRadius: 6, padding: '6px 14px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer'
            }}
          >
            {isLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={14} />}
            <span>Inspect 1km</span>
          </button>
        </form>
      </div>

      {selectedBuilding && (
        <div style={{
          position: 'absolute', bottom: 24, left: 24, zIndex: 10,
          background: 'rgba(15, 23, 42, 0.90)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(0, 210, 255, 0.35)', borderRadius: 12,
          padding: '16px 20px', width: 320, color: '#E2E8F0',
          boxShadow: '0 12px 40px rgba(0, 210, 255, 0.15)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#38BDF8', fontWeight: 700 }}>
              3D Cadastral Property
            </span>
            <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: 4, background: 'rgba(13, 148, 136, 0.25)', color: '#2DD4BF', fontWeight: 700 }}>
              {selectedBuilding.isTarget ? 'Target ULPIN' : 'Context Building'}
            </span>
          </div>

          <h3 style={{ margin: '0 0 6px', fontSize: '1.05rem', color: '#F8FAFC', fontWeight: 600 }}>
            {selectedBuilding.name || `Cadastral Parcel #${selectedBuilding.osmId}`}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.78rem', marginTop: 10, borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: 10 }}>
            <div>
              <span style={{ color: '#94A3B8' }}>Verified Height:</span>
              <div style={{ color: '#00D2FF', fontWeight: 700, fontSize: '0.95rem' }}>{selectedBuilding.height.toFixed(1)}m</div>
            </div>
            <div>
              <span style={{ color: '#94A3B8' }}>Vertical Strata:</span>
              <div style={{ color: '#F8FAFC', fontWeight: 700, fontSize: '0.95rem' }}>{selectedBuilding.levels} Floors</div>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <span style={{ color: '#94A3B8' }}>Extrusion Source: </span>
              <span style={{ color: selectedBuilding.source === 'height_tag' ? '#4ADE80' : '#FCD34D', fontWeight: 600 }}>
                {selectedBuilding.source === 'height_tag' ? 'OSM height tag' : selectedBuilding.source === 'levels_tag' ? 'OSM building:levels tag' : 'Deterministic fallback (3 floors / 10.5m)'}
              </span>
            </div>
          </div>
        </div>
      )}

      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: newVs }) => setViewState(newVs as MapViewState)}
        controller={{ doubleClickZoom: false, dragRotate: true }}
        layers={[buildingCadastreLayer].filter(Boolean)}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
      />
    </div>
  );
}
