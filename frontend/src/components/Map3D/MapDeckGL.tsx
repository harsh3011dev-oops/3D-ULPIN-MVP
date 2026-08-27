import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, TextLayer } from '@deck.gl/layers';
import Map from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { Building, Unit } from '../../types';
import { RotateCw, Layers, MapPin, Compass, Maximize2, Map as MapIcon } from 'lucide-react';
import './Map3D.css';

// Map Styles: Free CartoDB GL styles (0 API Key needed!)
const MAP_STYLES = [
  { id: 'dark', name: 'Dark Cadastral', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
  { id: 'voyager', name: 'Street Map', url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' },
  { id: 'positron', name: 'Light Survey', url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' }
];

interface MapDeckGLProps {
  building: Building;
  selectedUnit: Unit | null;
  onUnitClick: (unit: Unit) => void;
  selectedFloor: number | null;
}

const FLOOR_RGB_COLORS: [number, number, number][] = [
  [59, 130, 246],  // Floor 1: Vibrant Blue
  [16, 185, 129],  // Floor 2: Emerald Green
  [245, 158, 11],  // Floor 3: Amber Gold
  [139, 92, 246],  // Floor 4: Violet Purple
  [6, 182, 212],   // Floor 5: Neon Cyan
  [236, 72, 153],  // Floor 6: Hot Pink
];

export default function MapDeckGL({ building, selectedUnit, onUnitClick, selectedFloor }: MapDeckGLProps) {
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; object: any } | null>(null);
  const [selectedStyleUrl, setSelectedStyleUrl] = useState(MAP_STYLES[0].url);

  // Extract center coordinates from the actual building footprint or units with strict numeric fallback
  const firstUnit = building?.units?.[0];
  const rawLng = Number(firstUnit?.centroid?.[1]);
  const rawLat = Number(firstUnit?.centroid?.[0]);
  const centerLng = !isNaN(rawLng) && rawLng !== 0 ? rawLng : 77.0886;
  const centerLat = !isNaN(rawLat) && rawLat !== 0 ? rawLat : 28.4942;

  // Controlled ViewState for deck.gl
  const [viewState, setViewState] = useState({
    longitude: centerLng,
    latitude: centerLat,
    zoom: 17.8,
    pitch: 62,
    bearing: -25,
    maxPitch: 85,
  });

  // Re-center camera whenever building dataset changes
  useEffect(() => {
    const u = building?.units?.[0];
    if (u && Array.isArray(u.centroid) && u.centroid.length >= 2) {
      const lng = Number(u.centroid[1]);
      const lat = Number(u.centroid[0]);
      if (!isNaN(lat) && !isNaN(lng)) {
        setViewState((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          zoom: 17.8,
        }));
      }
    }
  }, [building]);

  const handleRotate = () => {
    setViewState((prev) => ({ ...prev, bearing: prev.bearing + 45 }));
  };

  const handlePitchToggle = () => {
    setViewState((prev) => ({ ...prev, pitch: prev.pitch === 62 ? 0 : 62 }));
  };

  const handleResetCamera = () => {
    setViewState({
      longitude: centerLng,
      latitude: centerLat,
      zoom: 17.8,
      pitch: 62,
      bearing: -25,
      maxPitch: 85,
    });
  };

  // Convert Building Units to deck.gl GeoJSON Feature Collection using REAL GeoJSON polygons
  const unitsGeoJSON = {
    type: "FeatureCollection",
    features: (building?.units || []).map((unit) => {
      const isSelected = selectedUnit?.unit_id === unit.unit_id;
      const isFloorVisible = selectedFloor === null || selectedFloor === unit.floor_number;

      return {
        type: "Feature",
        properties: {
          ...unit,
          isSelected,
          isFloorVisible
        },
        geometry: unit.polygon_2d || {
          type: "Polygon",
          coordinates: [[
            [centerLng - 0.0005, centerLat - 0.0005],
            [centerLng + 0.0005, centerLat - 0.0005],
            [centerLng + 0.0005, centerLat + 0.0005],
            [centerLng - 0.0005, centerLat + 0.0005],
            [centerLng - 0.0005, centerLat - 0.0005]
          ]]
        }
      };
    }).filter((f) => f.properties.isFloorVisible)
  };

  // Generate 3D Text Labels for Floor Elevation Levels
  const floorLabelsData = Array.from({ length: building?.floor_count || 4 }, (_, i) => {
    const floorNum = i + 1;
    const floorUnits = (building?.units || []).filter(u => u.floor_number === floorNum);
    const sampleUnit = floorUnits[0] || firstUnit;
    const zMax = sampleUnit?.z_max || floorNum * 3.5;

    return {
      text: `Level ${floorNum} (+${zMax}m)`,
      coordinates: [sampleUnit?.centroid?.[1] || centerLng, sampleUnit?.centroid?.[0] || centerLat],
      floorNumber: floorNum,
      zMax
    };
  }).filter(label => selectedFloor === null || selectedFloor === label.floorNumber);

  // deck.gl Layers: 3D GeoJSON Extrusions + Floor Labels
  const layers = [
    // Layer 1: Real 3D Extruded Cadastral Unit Polygons
    new GeoJsonLayer({
      id: '3d-ulpin-units-layer',
      data: unitsGeoJSON as any,
      extruded: true,
      wireframe: true,
      getElevation: (f: any) => f.properties.z_max * 3.5, // 3D Elevation Height in meters
      getFillColor: (f: any) => {
        const p = f.properties;
        if (p.isSelected) return [0, 240, 255, 235]; // Glowing Cyan selection
        const rgb = FLOOR_RGB_COLORS[(p.floor_number - 1) % FLOOR_RGB_COLORS.length];
        return [...rgb, 195];
      },
      getLineColor: (f: any) => f.properties.isSelected ? [255, 255, 255, 255] : [255, 255, 255, 140],
      getLineWidth: 2,
      lineWidthUnits: 'pixels',
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 90],
      onClick: (info) => {
        if (info.object?.properties) {
          onUnitClick(info.object.properties as Unit);
        }
      },
      onHover: (info) => {
        setHoverInfo(info.object ? { x: info.x, y: info.y, object: info.object } : null);
      },
      updateTriggers: {
        getFillColor: [selectedUnit, selectedFloor],
        getLineColor: [selectedUnit]
      }
    }),

    // Layer 2: 3D Floor Elevation Text Markers
    new TextLayer({
      id: '3d-floor-labels-layer',
      data: floorLabelsData,
      getPosition: (d: any) => [d.coordinates[0], d.coordinates[1], d.zMax * 3.5 + 2],
      getText: (d: any) => d.text,
      getSize: 16,
      getColor: (d: any) => selectedFloor === d.floorNumber ? [0, 240, 255, 255] : [255, 255, 255, 220],
      getAngle: 0,
      getTextAnchor: 'middle',
      getAlignmentBaseline: 'center',
      fontFamily: 'Inter, sans-serif',
      fontWeight: 'bold',
      background: true,
      getBackgroundColor: [15, 23, 42, 210],
      backgroundPadding: [6, 4],
      updateTriggers: {
        getColor: [selectedFloor]
      }
    })
  ];

  return (
    <div className="map3d-wrapper relative w-full h-full min-h-[520px] bg-[#060a12] rounded-xl overflow-hidden shadow-2xl border border-white/10" id="cesium-globe">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState as any)}
        controller={true}
        layers={layers}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
      >
        <Map
          mapLib={maplibregl}
          mapStyle={selectedStyleUrl}
        />
      </DeckGL>

      {/* Floating Toolbar Controls */}
      <div className="map-toolbar absolute top-4 right-4 flex flex-col gap-2 p-2 z-10 bg-slate-900/90 backdrop-blur border border-white/10 rounded-lg shadow-xl">
        <button
          className="toolbar-btn w-9 h-9 rounded-md flex items-center justify-center text-gray-300 bg-slate-800/80 border border-white/10 hover:text-white hover:bg-blue-600 transition-all shadow-md"
          onClick={handleRotate}
          title="Rotate Camera Bearing (+45°)"
        >
          <RotateCw size={18} />
        </button>

        <button
          className="toolbar-btn w-9 h-9 rounded-md flex items-center justify-center text-gray-300 bg-slate-800/80 border border-white/10 hover:text-white hover:bg-blue-600 transition-all shadow-md"
          onClick={handlePitchToggle}
          title="Toggle 2D / 3D Pitch Angle"
        >
          <Layers size={18} />
        </button>

        <button
          className="toolbar-btn w-9 h-9 rounded-md flex items-center justify-center text-gray-300 bg-slate-800/80 border border-white/10 hover:text-white hover:bg-blue-600 transition-all shadow-md"
          onClick={handleResetCamera}
          title="Reset Camera View"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* Map Basemap Style Switcher Dropdown */}
      <div className="basemap-switcher absolute top-16 left-4 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur border border-white/15 px-3 py-1.5 rounded-lg shadow-xl text-xs font-semibold text-gray-300">
        <MapIcon size={14} className="text-blue-400" />
        <span>Map Style:</span>
        <select
          className="bg-slate-800 text-white text-xs font-bold px-2 py-1 rounded border border-white/10 outline-none cursor-pointer hover:border-blue-400"
          value={selectedStyleUrl}
          onChange={(e) => setSelectedStyleUrl(e.target.value)}
        >
          {MAP_STYLES.map(style => (
            <option key={style.id} value={style.url}>{style.name}</option>
          ))}
        </select>
      </div>

      {/* Geographic Coordinates & Location Banner Header */}
      <div className="location-banner-header absolute top-4 left-4 p-2.5 z-10 flex items-center gap-2.5 bg-slate-900/90 backdrop-blur rounded-lg border border-blue-500/40 shadow-xl">
        <div className="w-7 h-7 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center justify-center">
          <MapPin size={16} />
        </div>
        <div className="flex flex-col">
          <span className="text-[0.78rem] font-bold text-white leading-tight">
            {building?.building_name || 'Cadastral Parcel'}
          </span>
          <span className="text-[0.68rem] font-mono text-cyan-300">
            {centerLat.toFixed(5)}°N, {centerLng.toFixed(5)}°E • Elevation +{building?.height || 14}m
          </span>
        </div>
      </div>

      {/* Hover Unit Tooltip Overlay */}
      {hoverInfo && hoverInfo.object && (
        <div
          className="unit-hover-tooltip fade-in absolute z-20 pointer-events-none p-3 border border-blue-500/40 shadow-xl rounded-lg bg-slate-900/95 backdrop-blur"
          style={{ left: hoverInfo.x + 15, top: hoverInfo.y - 40 }}
        >
          <div className="tooltip-header flex items-center gap-2">
            <span className="tooltip-floor text-[0.7rem] font-bold text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded">
              Level {hoverInfo.object.properties.floor_number}
            </span>
            <span className="tooltip-title text-xs font-bold text-white">
              {hoverInfo.object.properties.unit_name || hoverInfo.object.properties.unit_id}
            </span>
          </div>
          <code className="tooltip-ulpin font-mono text-[0.75rem] text-sky-300 block mt-1">
            {hoverInfo.object.properties.ulpin}
          </code>
          <div className="tooltip-height text-[0.7rem] text-gray-400 mt-1 flex justify-between gap-4">
            <span>Elevation: +{hoverInfo.object.properties.z_min}m to +{hoverInfo.object.properties.z_max}m</span>
            <span className="font-semibold text-emerald-400">{hoverInfo.object.properties.area_sqm} m²</span>
          </div>
        </div>
      )}

      {/* Tech Stack Badge Footer */}
      <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-white/10 px-3 py-1.5 rounded-full text-xs text-gray-300">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="font-semibold text-sky-400">Real GeoJSON Polygon Extrusions</span> + <span className="text-emerald-400">MapLibre GL</span>
      </div>
    </div>
  );
}
