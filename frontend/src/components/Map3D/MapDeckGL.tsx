import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, TextLayer } from '@deck.gl/layers';
import { Tile3DLayer } from '@deck.gl/geo-layers';
import { Tiles3DLoader } from '@loaders.gl/3d-tiles';
import Map from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { Building, Unit } from '../../types';
import { getBuildingCenter } from '../../utils/footprintUtils';
import { REEARTH, setupReearthTerrain } from '../../utils/reearth';
import { RotateCw, Layers, MapPin, Map as MapIcon, Maximize2, Building2 } from 'lucide-react';
import './Map3D.css';

interface MapDeckGLProps {
  building: Building;
  selectedUnit: Unit | null;
  onUnitClick: (unit: Unit) => void;
  selectedFloor: number | null;
}

const MAP_STYLES = [
  { id: 'dark', name: 'Dark Cadastral', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
  { id: 'positron', name: 'Light Architectural', url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
  { id: 'voyager', name: 'Voyager Topography', url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' },
];

const ARCHITECTURAL_FLOOR_COLORS_DARK: [number, number, number][] = [
  [94, 109, 130],
  [80, 95, 116],
  [68, 83, 104],
  [56, 71, 92],
  [45, 60, 80],
  [35, 48, 68],
];

const ARCHITECTURAL_FLOOR_COLORS_LIGHT: [number, number, number][] = [
  [71, 85, 105],
  [51, 65, 85],
  [30, 41, 59],
  [15, 23, 42],
  [51, 65, 85],
  [71, 85, 105],
];

export default function MapDeckGL({ building, selectedUnit, onUnitClick, selectedFloor }: MapDeckGLProps) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [selectedStyleUrl, setSelectedStyleUrl] = useState(MAP_STYLES[0].url);
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);
  const [hoveredUnitInfo, setHoveredUnitInfo] = useState<{ unit: Unit; x: number; y: number } | null>(null);
  const [showContextBuildings, setShowContextBuildings] = useState(true);
  const [terrainEnabled, setTerrainEnabled] = useState(true);

  const isLightStyle = selectedStyleUrl.includes('positron');

  const { lat: centerLat, lng: centerLng } = getBuildingCenter(building);
  const firstUnit = building?.units?.[0];
  const mapLng = centerLng !== 0 ? centerLng : Number(firstUnit?.centroid?.[1]) || 77.0886;
  const mapLat = centerLat !== 0 ? centerLat : Number(firstUnit?.centroid?.[0]) || 28.4942;

  const [viewState, setViewState] = useState({
    longitude: mapLng,
    latitude: mapLat,
    zoom: 17.5,
    pitch: 62,
    bearing: -25,
    maxPitch: 85,
  });

  useEffect(() => {
    const { lat, lng } = getBuildingCenter(building);
    const u = building?.units?.[0];
    const lngFinal = lng !== 0 ? lng : Number(u?.centroid?.[1]);
    const latFinal = lat !== 0 ? lat : Number(u?.centroid?.[0]);
    if (!isNaN(latFinal) && !isNaN(lngFinal) && latFinal !== 0 && lngFinal !== 0) {
      setViewState({
        longitude: lngFinal,
        latitude: latFinal,
        zoom: 17.5,
        pitch: 62,
        bearing: -25,
        maxPitch: 85,
      });
    }
  }, [building?.building_id]);

  const handleMapLoad = useCallback((evt: { target: maplibregl.Map }) => {
    mapRef.current = evt.target;
    if (terrainEnabled) {
      setupReearthTerrain(evt.target);
    }
    evt.target.on('style.load', () => {
      if (terrainEnabled && mapRef.current) {
        setupReearthTerrain(mapRef.current);
      }
    });
  }, [terrainEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (terrainEnabled) {
      setupReearthTerrain(map);
    } else {
      map.setTerrain(null);
      if (map.getLayer('reearth-hillshade')) map.removeLayer('reearth-hillshade');
      if (map.getSource('reearth-terrain')) map.removeSource('reearth-terrain');
    }
  }, [terrainEnabled, selectedStyleUrl]);

  const handleRotate = () => {
    setViewState((prev) => ({ ...prev, bearing: prev.bearing + 45 }));
  };

  const handlePitchToggle = () => {
    setViewState((prev) => ({ ...prev, pitch: prev.pitch === 62 ? 0 : 62 }));
  };

  const handleResetCamera = () => {
    setViewState({
      longitude: mapLng,
      latitude: mapLat,
      zoom: 17.5,
      pitch: 62,
      bearing: -25,
      maxPitch: 85,
    });
  };

  const SCALE_ELEVATION = 2.5;

  const footprintBaseGeoJSON = building?.footprint ? {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { name: building.building_name },
      geometry: building.footprint,
    }],
  } : null;

  const unitsGeoJSON = useMemo(() => ({
    type: 'FeatureCollection',
    features: (building?.units || []).flatMap((unit) => {
      const floorNum = unit.floor_number ?? unit.floor ?? 1;
      const floorHtM = unit.floor_height_m ?? 3.5;
      const zMin = unit.z_min ?? (floorNum - 1) * floorHtM;
      const zMax = unit.z_max ?? floorNum * floorHtM;
      const floorSliceH = (zMax - zMin) * SCALE_ELEVATION;
      const zBase = zMin * SCALE_ELEVATION;

      const isSelected = selectedUnit?.unit_id === unit.unit_id;
      const isHovered = hoveredUnitId === unit.unit_id;
      const isFloorIsolated = selectedFloor === floorNum;

      const fallbackRing = [
        [mapLng - 0.0005, mapLat - 0.0005],
        [mapLng + 0.0005, mapLat - 0.0005],
        [mapLng + 0.0005, mapLat + 0.0005],
        [mapLng - 0.0005, mapLat + 0.0005],
        [mapLng - 0.0005, mapLat - 0.0005],
      ];
      const geometry = unit.polygon_2d;
      const polygons = geometry?.type === 'MultiPolygon'
        ? geometry.coordinates
        : [geometry?.coordinates || [fallbackRing]];

      return polygons.map((polygon: number[][][]) => ({
        type: 'Feature',
        properties: {
          ...unit,
          floor_number: floorNum,
          z_min: zMin,
          z_max: zMax,
          isSelected,
          isHovered,
          isFloorIsolated,
          floorSliceHeight: floorSliceH,
        },
        geometry: {
          type: 'Polygon',
          coordinates: polygon.map((ring: number[][]) =>
            ring.map((coord: number[]) => [coord[0], coord[1], zBase])
          ),
        },
      }));
    }),
  }), [building?.units, selectedUnit, hoveredUnitId, selectedFloor, mapLng, mapLat]);

  // Only render a label for the actively selected floor — no clutter for 163 floors
  const floorLabelsData = useMemo(() => {
    if (selectedFloor === null) return [];
    const floorUnits = (building?.units || []).filter(
      (u) => (u.floor_number ?? u.floor ?? 1) === selectedFloor
    );
    const sampleUnit = floorUnits[0] || firstUnit;
    const floorHtM = sampleUnit?.floor_height_m ?? 3.5;
    const zMax = sampleUnit?.z_max ?? selectedFloor * floorHtM;
    const zMin = sampleUnit?.z_min ?? (selectedFloor - 1) * floorHtM;
    const zMid = (zMin + zMax) / 2;
    return [{
      text: `▶ Floor ${selectedFloor}  +${Number(zMax).toFixed(1)}m`,
      coordinates: [sampleUnit?.centroid?.[1] || mapLng, sampleUnit?.centroid?.[0] || mapLat],
      floorNumber: selectedFloor,
      zAltitude: zMid * SCALE_ELEVATION,
    }];
  }, [selectedFloor, building?.units, firstUnit, mapLng, mapLat]);

  const layers = useMemo(() => [
    ...(showContextBuildings ? [
      new Tile3DLayer({
        id: 'reearth-osm-buildings',
        data: REEARTH.buildingsTileset,
        loader: Tiles3DLoader,
        opacity: 0.82,
        pickable: false,
        loadOptions: {
          '3d-tiles': { loadGLTF: true },
        },
      }),
    ] : []),

    ...(footprintBaseGeoJSON ? [
      new GeoJsonLayer({
        id: '3d-footprint-base-layer',
        data: footprintBaseGeoJSON as any,
        extruded: false,
        getFillColor: isLightStyle ? [99, 102, 241, 50] : [124, 111, 224, 40],
        getLineColor: isLightStyle ? [79, 70, 229, 255] : [124, 111, 224, 220],
        getLineWidth: 3,
        lineWidthUnits: 'pixels',
        pickable: false,
      }),
    ] : []),

    new GeoJsonLayer({
      id: '3d-ulpin-units-layer',
      data: unitsGeoJSON as any,
      extruded: true,
      wireframe: true,
      getElevation: (f: any) => f.properties.floorSliceHeight,
      getFillColor: (f: any) => {
        const p = f.properties;
        if (selectedFloor !== null && !p.isFloorIsolated) {
          return isLightStyle ? [203, 213, 225, 55] : [30, 41, 59, 45];
        }
        if (p.isSelected) return [56, 189, 248, 245];
        if (p.isFloorIsolated) return [124, 111, 224, 240];
        if (p.isHovered) return [56, 189, 248, 225];
        const palette = isLightStyle ? ARCHITECTURAL_FLOOR_COLORS_LIGHT : ARCHITECTURAL_FLOOR_COLORS_DARK;
        const rgb = palette[(p.floor_number - 1) % palette.length];
        return [...rgb, isLightStyle ? 190 : 165];
      },
      getLineColor: (f: any) => {
        const p = f.properties;
        if (p.isSelected || p.isFloorIsolated) return [255, 255, 255, 255];
        if (p.isHovered) return [255, 255, 255, 240];
        if (selectedFloor !== null && !p.isFloorIsolated) {
          return isLightStyle ? [148, 163, 184, 60] : [71, 85, 105, 50];
        }
        return isLightStyle ? [15, 23, 42, 220] : [148, 163, 184, 160];
      },
      getLineWidth: (f: any) => {
        const p = f.properties;
        if (p.isSelected || p.isFloorIsolated) return 3.5;
        if (p.isHovered) return 2.5;
        return isLightStyle ? 1.8 : 1.2;
      },
      lineWidthUnits: 'pixels',
      material: {
        ambient: isLightStyle ? 0.7 : 0.55,
        diffuse: isLightStyle ? 0.75 : 0.65,
        shininess: isLightStyle ? 45 : 28,
      },
      pickable: true,
      autoHighlight: true,
      highlightColor: isLightStyle ? [59, 130, 246, 70] : [255, 255, 255, 60],
      onClick: (info) => {
        if (info.object?.properties) {
          onUnitClick(info.object.properties as Unit);
        }
      },
      onHover: (info) => {
        if (info.object?.properties?.unit_id) {
          setHoveredUnitId(info.object.properties.unit_id);
          setHoveredUnitInfo({ unit: info.object.properties as Unit, x: info.x, y: info.y });
        } else {
          setHoveredUnitId(null);
          setHoveredUnitInfo(null);
        }
      },
      updateTriggers: {
        getFillColor: [selectedUnit, hoveredUnitId, selectedFloor, selectedStyleUrl],
        getLineColor: [selectedUnit, hoveredUnitId, selectedFloor, selectedStyleUrl],
        getLineWidth: [selectedUnit, hoveredUnitId, selectedFloor, selectedStyleUrl],
      },
    }),

    new TextLayer({
      id: '3d-floor-labels-layer',
      data: floorLabelsData,
      getPosition: (d: any) => [d.coordinates[0], d.coordinates[1], d.zAltitude],
      getText: (d: any) => d.text,
      getSize: (d: any) => (selectedFloor === d.floorNumber ? 15 : 12),
      getColor: (d: any) => {
        if (selectedFloor === d.floorNumber) return [255, 255, 255, 255];
        return isLightStyle ? [15, 23, 42, 230] : [203, 213, 225, 220];
      },
      getAngle: 0,
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'center',
      fontFamily: 'Inter, sans-serif',
      fontWeight: 'bold',
      background: true,
      getBackgroundColor: (d: any) => {
        if (selectedFloor === d.floorNumber) return [124, 111, 224, 240];
        return isLightStyle ? [255, 255, 255, 240] : [15, 23, 42, 210];
      },
      backgroundPadding: [7, 4],
      updateTriggers: {
        getColor: [selectedFloor, selectedStyleUrl],
        getBackgroundColor: [selectedFloor, selectedStyleUrl],
        getPosition: [selectedFloor],
      },
    }),
  ], [
    showContextBuildings,
    footprintBaseGeoJSON,
    unitsGeoJSON,
    floorLabelsData,
    isLightStyle,
    selectedUnit,
    hoveredUnitId,
    selectedFloor,
    selectedStyleUrl,
    onUnitClick,
  ]);

  return (
    <div className="deckgl-map-container">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs as any)}
        controller={true}
        layers={layers}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
      >
        <Map
          mapLib={maplibregl}
          mapStyle={selectedStyleUrl}
          onLoad={handleMapLoad}
        />
      </DeckGL>

      <div className="floating-toolbar">
        <button type="button" className="map-control-btn" onClick={handleRotate} title="Rotate Camera Bearing (+45°)">
          <RotateCw size={17} />
        </button>
        <button type="button" className="map-control-btn" onClick={handlePitchToggle} title="Toggle 2D / 3D Pitch Angle">
          <Layers size={17} />
        </button>
        <button type="button" className="map-control-btn" onClick={handleResetCamera} title="Reset Camera View">
          <Maximize2 size={15} />
        </button>
        <button
          type="button"
          className={`map-control-btn ${showContextBuildings ? 'active' : ''}`}
          onClick={() => setShowContextBuildings((v) => !v)}
          title="Toggle Re:Earth OSM 3D Buildings"
        >
          <Building2 size={17} />
        </button>
      </div>

      <div className="basemap-selector-box">
        <MapIcon size={14} style={{ color: 'var(--accent-lavender)' }} />
        <span>Style:</span>
        <select
          className="basemap-select-input"
          value={selectedStyleUrl}
          onChange={(e) => setSelectedStyleUrl(e.target.value)}
        >
          {MAP_STYLES.map((style) => (
            <option key={style.id} value={style.url}>{style.name}</option>
          ))}
        </select>
        <label className="terrain-toggle-label" title="Re:Earth Terrain hillshade">
          <input
            type="checkbox"
            checked={terrainEnabled}
            onChange={(e) => setTerrainEnabled(e.target.checked)}
          />
          Terrain
        </label>
      </div>

      <div className="location-overlay-banner">
        <div className="location-icon-pin">
          <MapPin size={16} />
        </div>
        <div className="location-text-info">
          <span className="location-bldg-title">
            {building?.building_name || building?.address || 'Cadastral Parcel'}
          </span>
          <span className="location-coords-sub">
            {selectedFloor !== null
              ? `Isolated Floor ${selectedFloor} Active`
              : `All ${building?.floor_count || 4} Floors · ULPIN Overlay`}
          </span>
        </div>
      </div>

      {/* Hover Tooltip */}
      {hoveredUnitInfo && (
        <div
          style={{
            position: 'absolute',
            left: hoveredUnitInfo.x + 14,
            top: hoveredUnitInfo.y - 10,
            zIndex: 100,
            pointerEvents: 'none',
            background: 'rgba(10,15,30,0.92)',
            border: '1px solid rgba(124,111,224,0.5)',
            borderRadius: 8,
            padding: '8px 12px',
            color: '#e2e8f0',
            fontFamily: 'Inter, sans-serif',
            fontSize: 12,
            lineHeight: 1.6,
            backdropFilter: 'blur(8px)',
            minWidth: 180,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ fontWeight: 700, color: '#a5b4fc', marginBottom: 4 }}>
            {hoveredUnitInfo.unit.unit_id || 'Unit'}
          </div>
          <div>Floor: <strong style={{color:'#fff'}}>{hoveredUnitInfo.unit.floor_number ?? hoveredUnitInfo.unit.floor ?? '—'}</strong></div>
          <div>Z: <strong style={{color:'#fff'}}>{Number(hoveredUnitInfo.unit.z_min ?? 0).toFixed(1)}m → {Number(hoveredUnitInfo.unit.z_max ?? 0).toFixed(1)}m</strong></div>
          {hoveredUnitInfo.unit.ulpin && (
            <div style={{ marginTop: 4, fontSize: 10, color: '#7c6fe0', wordBreak: 'break-all' }}>
              {hoveredUnitInfo.unit.ulpin}
            </div>
          )}
        </div>
      )}

      <div className="tech-badge-footer">
        <span className="pulse-dot" />
        <span style={{ color: 'var(--accent-lavender)', fontWeight: 600 }}>Re:Earth 3D Buildings + Terrain</span>
        {' · '}
        <span>deck.gl + MapLibre</span>
      </div>

      <div className="map-attribution-footer" title={REEARTH.attribution}>
        {REEARTH.attribution}
      </div>
    </div>
  );
}
