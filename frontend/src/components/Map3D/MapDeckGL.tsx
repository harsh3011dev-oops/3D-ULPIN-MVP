import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, TextLayer } from '@deck.gl/layers';
import Map from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { Building, Unit } from '../../types';
import { RotateCw, Layers, MapPin, Map as MapIcon, Maximize2 } from 'lucide-react';
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

// Dark mode architectural palette — muted slate glass
const ARCHITECTURAL_FLOOR_COLORS_DARK: [number, number, number][] = [
  [94, 109, 130],   // Floor 1: Slate Blue
  [80, 95, 116],    // Floor 2: Cool Steel
  [68, 83, 104],    // Floor 3: Deep Slate
  [56, 71, 92],     // Floor 4: Midnight Glass
  [45, 60, 80],     // Floor 5: Dark Steel
  [35, 48, 68],     // Floor 6: Dark Charcoal
];

// Light mode architectural palette — crisp porcelain, cobalt & slate glass for Light Architectural basemap
const ARCHITECTURAL_FLOOR_COLORS_LIGHT: [number, number, number][] = [
  [71, 85, 105],    // Floor 1: Deep Slate
  [51, 65, 85],     // Floor 2: Dark Navy Glass
  [30, 41, 59],     // Floor 3: Charcoal Steel
  [15, 23, 42],     // Floor 4: Obsidian Glass
  [51, 65, 85],     // Floor 5: Slate Glass
  [71, 85, 105],    // Floor 6: Porcelain Slate
];

export default function MapDeckGL({ building, selectedUnit, onUnitClick, selectedFloor }: MapDeckGLProps) {
  const [selectedStyleUrl, setSelectedStyleUrl] = useState(MAP_STYLES[0].url);
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);

  const isLightStyle = selectedStyleUrl.includes('positron');

  // Extract center coordinates from building footprint or first unit
  const firstUnit = building?.units?.[0];
  const rawLng = Number(firstUnit?.centroid?.[1]);
  const rawLat = Number(firstUnit?.centroid?.[0]);
  const centerLng = !isNaN(rawLng) && rawLng !== 0 ? rawLng : 77.0886;
  const centerLat = !isNaN(rawLat) && rawLat !== 0 ? rawLat : 28.4942;

  // Controlled ViewState for deck.gl
  const [viewState, setViewState] = useState({
    longitude: centerLng,
    latitude: centerLat,
    zoom: 17.5,
    pitch: 62,
    bearing: -25,
    maxPitch: 85,
  });

  // Re-center camera whenever building dataset changes
  useEffect(() => {
    const u = building?.units?.[0];
    if (u && Array.isArray(u.centroid) && u.centroid.length >= 2) {
      const lat = Number(u.centroid[0]);
      const lng = Number(u.centroid[1]);
      if (!isNaN(lat) && !isNaN(lng)) {
        setViewState({
          longitude: lng,
          latitude: lat,
          zoom: 17.5,
          pitch: 62,
          bearing: -25,
          maxPitch: 85,
        });
      }
    }
  }, [building?.building_id]);

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
      zoom: 17.5,
      pitch: 62,
      bearing: -25,
      maxPitch: 85,
    });
  };

  // 1. Ground Footprint Base Feature Collection (z=0)
  const footprintBaseGeoJSON = building?.footprint ? {
    type: "FeatureCollection",
    features: [{
      type: "Feature",
      properties: { name: building.building_name },
      geometry: building.footprint
    }]
  } : null;

  // Scale factor for 3D map elevation rendering
  const SCALE_ELEVATION = 2.5;

  // 2. 3D Unit Feature Collection with TRUE 3D Altitude Coordinates
  // Keeps ALL building floors visible so the whole 3D skyscraper context is preserved!
  const unitsGeoJSON = {
    type: "FeatureCollection",
    features: (building?.units || []).map((unit) => {
      const isSelected = selectedUnit?.unit_id === unit.unit_id;
      const isHovered = hoveredUnitId === unit.unit_id;
      const isFloorIsolated = selectedFloor === unit.floor_number;

      // Base altitude for this floor level
      const zBase = unit.z_min * SCALE_ELEVATION;
      const floorSliceHeight = (unit.floor_height_m || 3.5) * SCALE_ELEVATION;

      // Original 2D ring coordinates
      const origRing = unit.polygon_2d?.coordinates?.[0] || [
        [centerLng - 0.0005, centerLat - 0.0005],
        [centerLng + 0.0005, centerLat - 0.0005],
        [centerLng + 0.0005, centerLat + 0.0005],
        [centerLng - 0.0005, centerLat + 0.0005],
        [centerLng - 0.0005, centerLat - 0.0005]
      ];

      // Convert 2D coordinates to 3D coordinates [lng, lat, zBase]
      const ring3D = origRing.map((coord: number[]) => [coord[0], coord[1], zBase]);

      return {
        type: "Feature",
        properties: {
          ...unit,
          isSelected,
          isHovered,
          isFloorIsolated,
          floorSliceHeight
        },
        geometry: {
          type: "Polygon",
          coordinates: [ring3D]
        }
      };
    })
  };

  // 3. Floor Level Markers Data
  const floorLabelsData = Array.from({ length: building?.floor_count || 4 }, (_, i) => {
    const floorNum = i + 1;
    const floorUnits = (building?.units || []).filter(u => u.floor_number === floorNum);
    const sampleUnit = floorUnits[0] || firstUnit;
    const zMax = sampleUnit?.z_max || floorNum * 3.5;
    const zMin = sampleUnit?.z_min || (floorNum - 1) * 3.5;
    const zMid = (zMin + zMax) / 2;

    return {
      text: selectedFloor === floorNum
        ? `⭐ LEVEL ${floorNum} (ISOLATED)`
        : `Level ${floorNum} (+${zMax}m)`,
      coordinates: [sampleUnit?.centroid?.[1] || centerLng, sampleUnit?.centroid?.[0] || centerLat],
      floorNumber: floorNum,
      zAltitude: zMid * SCALE_ELEVATION
    };
  });

  // deck.gl Multi-Layer Stack for Architectural 3D Visualization
  const layers = [
    // Ground Footprint Foundation Base Layer
    ...(footprintBaseGeoJSON ? [
      new GeoJsonLayer({
        id: '3d-footprint-base-layer',
        data: footprintBaseGeoJSON as any,
        extruded: false,
        getFillColor: isLightStyle ? [99, 102, 241, 40] : [124, 111, 224, 30],
        getLineColor: isLightStyle ? [79, 70, 229, 240] : [124, 111, 224, 200],
        getLineWidth: 2.5,
        lineWidthUnits: 'pixels',
        pickable: false,
      })
    ] : []),

    // 3D Architectural Volumetric Unit Layer
    new GeoJsonLayer({
      id: '3d-ulpin-units-layer',
      data: unitsGeoJSON as any,
      extruded: true,
      wireframe: true,
      getElevation: (f: any) => f.properties.floorSliceHeight,
      getFillColor: (f: any) => {
        const p = f.properties;
        
        // 1. If Floor Isolator is active and this floor is NOT selected, dim to subtle ghost glass!
        if (selectedFloor !== null && !p.isFloorIsolated) {
          return isLightStyle ? [203, 213, 225, 45] : [30, 41, 59, 35];
        }

        // 2. Selected unit highlight: vibrant cyan glass
        if (p.isSelected) return [56, 189, 248, 240];

        // 3. Isolated floor highlight: glowing lavender glass
        if (p.isFloorIsolated) return [124, 111, 224, 235];

        // 4. Hovered unit highlight: bright cyan accent
        if (p.isHovered) return [56, 189, 248, 220];

        // 5. Default architectural theme colors
        const palette = isLightStyle ? ARCHITECTURAL_FLOOR_COLORS_LIGHT : ARCHITECTURAL_FLOOR_COLORS_DARK;
        const rgb = palette[(p.floor_number - 1) % palette.length];
        return [...rgb, isLightStyle ? 180 : 150];
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
        } else {
          setHoveredUnitId(null);
        }
      },
      updateTriggers: {
        getFillColor: [selectedUnit, hoveredUnitId, selectedFloor, selectedStyleUrl],
        getLineColor: [selectedUnit, hoveredUnitId, selectedFloor, selectedStyleUrl],
        getLineWidth: [selectedUnit, hoveredUnitId, selectedFloor, selectedStyleUrl]
      }
    }),

    // 3D Floor Elevation Text Markers
    new TextLayer({
      id: '3d-floor-labels-layer',
      data: floorLabelsData,
      getPosition: (d: any) => [d.coordinates[0], d.coordinates[1], d.zAltitude],
      getText: (d: any) => d.text,
      getSize: (d: any) => selectedFloor === d.floorNumber ? 15 : 12,
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
        getPosition: [selectedFloor]
      }
    })
  ];

  return (
    <div className="deckgl-map-container">
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
      <div className="floating-toolbar">
        <button
          type="button"
          className="map-control-btn"
          onClick={handleRotate}
          title="Rotate Camera Bearing (+45°)"
        >
          <RotateCw size={17} />
        </button>

        <button
          type="button"
          className="map-control-btn"
          onClick={handlePitchToggle}
          title="Toggle 2D / 3D Pitch Angle"
        >
          <Layers size={17} />
        </button>

        <button
          type="button"
          className="map-control-btn"
          onClick={handleResetCamera}
          title="Reset Camera View"
        >
          <Maximize2 size={15} />
        </button>
      </div>

      {/* Map Style Selector Dropdown */}
      <div className="basemap-selector-box">
        <MapIcon size={14} style={{ color: 'var(--accent-lavender)' }} />
        <span>Style:</span>
        <select
          className="basemap-select-input"
          value={selectedStyleUrl}
          onChange={(e) => setSelectedStyleUrl(e.target.value)}
        >
          {MAP_STYLES.map(style => (
            <option key={style.id} value={style.url}>{style.name}</option>
          ))}
        </select>
      </div>

      {/* Location Banner Header */}
      <div className="location-overlay-banner">
        <div className="location-icon-pin">
          <MapPin size={16} />
        </div>
        <div className="location-text-info">
          <span className="location-bldg-title">
            {building?.building_name || 'Cadastral Parcel'}
          </span>
          <span className="location-coords-sub">
            {selectedFloor !== null ? `Isolated Floor ${selectedFloor} Active` : `All ${building?.floor_count || 4} Floors Active`}
          </span>
        </div>
      </div>

      {/* Tech Stack Badge Footer */}
      <div className="tech-badge-footer">
        <span className="pulse-dot" />
        <span style={{ color: 'var(--accent-lavender)', fontWeight: 600 }}>3D GeoJSON Extrusions</span> + <span>MapLibre GL</span>
      </div>
    </div>
  );
}
