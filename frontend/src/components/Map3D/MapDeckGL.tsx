import React, { useState } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer } from '@deck.gl/layers';
import Map from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import { Building, Unit } from '../../types';
import { RotateCw, Layers } from 'lucide-react';
import './Map3D.css';

// CartoDB Dark Matter MapLibre style (Free OpenStreetMap-based vector/raster tiles, 0 API Key required!)
const CARTO_DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

interface MapDeckGLProps {
  building: Building;
  selectedUnit: Unit | null;
  onUnitClick: (unit: Unit) => void;
  selectedFloor: number | null;
}

const FLOOR_RGB_COLORS: [number, number, number][] = [
  [59, 130, 246],  // Blue
  [16, 185, 129],  // Emerald
  [245, 158, 11],  // Amber
  [139, 92, 246],  // Purple
  [6, 182, 212],   // Cyan
  [236, 72, 153],  // Pink
];

export default function MapDeckGL({ building, selectedUnit, onUnitClick, selectedFloor }: MapDeckGLProps) {
  const [hoverInfo, setHoverInfo] = useState<{ x: number; y: number; object: any } | null>(null);
  const [pitch, setPitch] = useState(60);
  const [bearing, setBearing] = useState(-20);

  // Center coordinates (Delhi default)
  const initialViewState = {
    longitude: 77.0495,
    latitude: 28.5925,
    zoom: 17.5,
    pitch: pitch,
    bearing: bearing,
    maxPitch: 85,
  };

  // Convert Building Units to deck.gl GeoJSON Feature Collection
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
            [77.0490, 28.5920],
            [77.0500, 28.5920],
            [77.0500, 28.5930],
            [77.0490, 28.5930],
            [77.0490, 28.5920]
          ]]
        }
      };
    }).filter(f => f.properties.isFloorVisible)
  };

  // deck.gl GeoJsonLayer with 3D Extrusion
  const layers = [
    new GeoJsonLayer({
      id: '3d-ulpin-units-layer',
      data: unitsGeoJSON as any,
      extruded: true,
      wireframe: true,
      getElevation: (f: any) => f.properties.z_max * 3, // Height scale for visualization
      getFillColor: (f: any) => {
        const p = f.properties;
        if (p.isSelected) return [0, 240, 255, 220]; // Glowing cyan selection
        const rgb = FLOOR_RGB_COLORS[(p.floor_number - 1) % FLOOR_RGB_COLORS.length];
        return [...rgb, 200];
      },
      getLineColor: (f: any) => f.properties.isSelected ? [255, 255, 255, 255] : [255, 255, 255, 120],
      getLineWidth: 2,
      lineWidthUnits: 'pixels',
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 80],
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
    })
  ];

  return (
    <div className="map3d-wrapper relative w-full h-full min-h-[520px] bg-[#0a0f1d] rounded-xl overflow-hidden" id="cesium-globe">
      <DeckGL
        initialViewState={initialViewState}
        controller={true}
        layers={layers}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'grab')}
      >
        <Map
          mapLib={maplibregl}
          mapStyle={CARTO_DARK_STYLE}
        />
      </DeckGL>

      {/* Floating Toolbar Controls */}
      <div className="map-toolbar glass-panel absolute top-4 right-4 flex flex-col gap-2 p-2 z-10">
        <button
          className="toolbar-btn w-9 h-9 rounded-md flex items-center justify-center text-gray-400 bg-white/5 border border-white/10 hover:text-white hover:bg-white/10 transition-all"
          onClick={() => setBearing((prev) => prev + 45)}
          title="Rotate Map Bearing"
        >
          <RotateCw size={18} />
        </button>

        <button
          className="toolbar-btn w-9 h-9 rounded-md flex items-center justify-center text-gray-400 bg-white/5 border border-white/10 hover:text-white hover:bg-white/10 transition-all"
          onClick={() => setPitch((prev) => (prev === 60 ? 0 : 60))}
          title="Toggle 2D / 3D Pitch Angle"
        >
          <Layers size={18} />
        </button>
      </div>

      {/* Hover Unit Tooltip Overlay */}
      {hoverInfo && hoverInfo.object && (
        <div
          className="unit-hover-tooltip glass-panel fade-in absolute z-20 pointer-events-none p-3 border border-blue-500/40 shadow-glow"
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
          <div className="tooltip-height text-[0.7rem] text-gray-400 mt-1">
            Elevation: +{hoverInfo.object.properties.z_min}m to +{hoverInfo.object.properties.z_max}m
          </div>
        </div>
      )}

      {/* Volumetric Height Metric Overlay */}
      <div className="height-ruler-overlay glass-panel absolute top-4 left-4 p-2.5 z-10 flex flex-col gap-0.5">
        <span className="ruler-title text-[0.68rem] uppercase text-gray-400 font-bold">Max Elevation</span>
        <span className="ruler-val font-mono text-base font-extrabold text-cyan-400">+{building?.height || 14.0}m</span>
      </div>

      {/* Tech Stack Badge Footer */}
      <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-white/10 px-3 py-1.5 rounded-full text-xs text-gray-300">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span className="font-semibold text-sky-400">deck.gl 3D</span> + <span className="text-emerald-400">MapLibre GL</span> + <span className="text-indigo-400">OSM</span>
      </div>
    </div>
  );
}
