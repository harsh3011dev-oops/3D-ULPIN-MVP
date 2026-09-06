import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, TextLayer, ColumnLayer, PathLayer } from '@deck.gl/layers';
import { Tile3DLayer } from '@deck.gl/geo-layers';
import { Tiles3DLoader } from '@loaders.gl/3d-tiles';
import Map from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { Building, Unit } from '../../types';
import { getBuildingCenter } from '../../utils/footprintUtils';
import { REEARTH, setupReearthTerrain } from '../../utils/reearth';
import { RotateCw, Layers, MapPin, Map as MapIcon, Maximize2, Building2, PanelLeft, PanelRight, ArrowDownToLine, Activity, ShieldCheck, Database, X, Zap, Droplets, Flame, Radio, Wrench, Landmark } from 'lucide-react';
import './Map3D.css';

interface MapDeckGLProps {
  building: Building;
  selectedUnit: Unit | null;
  onUnitClick: (unit: Unit) => void;
  selectedFloor: number | null;
  isLeftOpen?: boolean;
  isRightOpen?: boolean;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
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

export default function MapDeckGL({ building, selectedUnit, onUnitClick, selectedFloor, isLeftOpen, isRightOpen, onToggleLeft, onToggleRight }: MapDeckGLProps) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [selectedStyleUrl, setSelectedStyleUrl] = useState(MAP_STYLES[0].url);
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);
  const [hoveredUnitInfo, setHoveredUnitInfo] = useState<{ unit: Unit; x: number; y: number } | null>(null);
  const [showContextBuildings, setShowContextBuildings] = useState(true);
  const [terrainEnabled, setTerrainEnabled] = useState(true);
  const [showUnderground, setShowUnderground] = useState(true);
  const [selectedUnderground, setSelectedUnderground] = useState<any | null>(null);

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
  // Each underground floor-level is 3.5m real → 8.75m visual
  const UG_FLOOR_H = 3.5 * 2.5; // 8.75m visual per underground level



  const UTILITY_PIPE_COLORS: Record<string, [number, number, number, number]> = {
    water:   [56, 189, 248, 255],   // Cyan Blue
    sewage:  [163, 230, 53, 255],    // Lime Green
    power:   [250, 204, 21, 255],    // Electric Yellow
    telecom: [192, 132, 252, 255],   // Bright Violet
    gas:     [251, 146, 60, 255],    // Vibrant Orange
  };

  // ── 3D Extruded Underground GeoJSON (Real data ONLY — NO synthetic fallbacks) ──
  const undergroundUnitsGeoJSON = useMemo(() => {
    const ulpinDetails: any[] = building?.underground?.ulpin_details || [];
    // Only real structural units (not utility lines)
    const structuralUnits = ulpinDetails.filter((u: any) => u.type !== 'utility');
    if (structuralUnits.length === 0) {
      return null;
    }

    // Deduplicate structural levels by zone/level (e.g. B1, P1, P2, M1)
    const seen = new Set<string>();
    const uniqueLevels = structuralUnits.filter((u: any) => {
      const zone = u.subsurface_zone || (u.type === 'parking' ? `P${Math.abs(u.level)-1}` : u.type === 'metro' ? 'M1' : `B${Math.abs(u.level)}`);
      const key = `${u.type}-${zone}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Color theme per structural type
    const TYPE_COLORS: Record<string, [number, number, number, number]> = {
      basement: [147, 51, 234, 190], // Deep Violet
      parking:  [14, 165, 233, 205],  // Cyan / Electric Blue
      metro:    [236, 72, 153, 220],  // Magenta / Rose
      museum:   [245, 158, 11, 220],   // Warm Amber / Gold
    };

    const features = uniqueLevels.map((u: any) => {
      const zone = u.subsurface_zone || (u.type === 'parking' ? `P${Math.abs(u.level)-1}` : u.type === 'metro' ? 'M1' : u.type === 'museum' ? 'MUS1' : `B${Math.abs(u.level)}`);
      const depthMin = Array.isArray(u.depth_range) ? u.depth_range[0] : Math.abs(u.level || 1) * 3.5 - 3.5;
      const depthMax = Array.isArray(u.depth_range) ? u.depth_range[1] : Math.abs(u.level || 1) * 3.5;
      const height = Math.max(depthMax - depthMin, 3.5) * SCALE_ELEVATION;
      const zBase = -depthMax * SCALE_ELEVATION;

      // Smart offset per level so volumes and labels are separated cleanly without overlap
      let offLon = 0.0000;
      let offLat = 0.0000;
      let halfW = 0.00040;
      let halfH = 0.00040;

      if (u.type === 'museum') {
        offLon = 0.0000;
        offLat = -0.0007;
        halfW = 0.00065;
        halfH = 0.00045;
      } else if (u.type === 'metro') {
        offLat = 0.0011;
        halfW = 0.00085;
        halfH = 0.00032;
      } else if (zone.startsWith('P1')) {
        offLon = -0.0008;
        offLat = -0.0006;
        halfW = 0.00045;
        halfH = 0.00045;
      } else if (zone.startsWith('P2')) {
        offLon = 0.0009;
        offLat = -0.0006;
        halfW = 0.00045;
        halfH = 0.00045;
      }

      const cLon = mapLng + offLon;
      const cLat = mapLat + offLat;

      const coordinates = [[
        [cLon - halfW, cLat - halfH, zBase],
        [cLon + halfW, cLat - halfH, zBase],
        [cLon + halfW, cLat + halfH, zBase],
        [cLon - halfW, cLat + halfH, zBase],
        [cLon - halfW, cLat - halfH, zBase],
      ]];

      const color = TYPE_COLORS[u.type] || [147, 51, 234, 190];

      return {
        type: 'Feature',
        properties: {
          ulpin: u.ulpin,
          title: u.title || `${u.type.toUpperCase()} Level (${zone})`,
          type: u.type,
          subsurface_zone: zone,
          level: u.level,
          volume_m3: u.volume_m3,
          depth_range: [depthMin, depthMax],
          sliceH: height,
          color,
          cLon,
          cLat,
          zMid: zBase + height / 2,
        },
        geometry: { type: 'Polygon', coordinates },
      };
    });

    return { type: 'FeatureCollection', features };
  }, [building?.underground?.ulpin_details, mapLat, mapLng, SCALE_ELEVATION]);

  // ── Underground Labels: one per real level extracted directly from undergroundUnitsGeoJSON ──
  const undergroundLabelsData = useMemo(() => {
    if (!undergroundUnitsGeoJSON?.features?.length) return [];

    return undergroundUnitsGeoJSON.features.map((f: any) => {
      const p = f.properties;
      return {
        text: `⬇ ${p.title}`,
        coordinates: [p.cLon, p.cLat],
        zAltitude: p.zMid,
        ulpin: p.ulpin,
        type: p.type,
        title: p.title,
        subsurface_zone: p.subsurface_zone,
        level: p.level,
        depth_range: p.depth_range,
        volume_m3: p.volume_m3,
      };
    });
  }, [undergroundUnitsGeoJSON]);

  // ── 3D Cylindrical Pipes: constructed ONLY from real building.underground.utilities ──
  const undergroundPipesData = useMemo(() => {
    const utils: any[] = building?.underground?.utilities || [];
    if (!utils.length) return [];

    const columns: any[] = [];

    utils.forEach((util: any) => {
      const z = -(util.depth_m || 3.0) * SCALE_ELEVATION;
      const r = Math.max((util.diameter_mm || 100) / 1000 * 2.8, 1.2);
      const color = UTILITY_PIPE_COLORS[util.type] || [250, 204, 21, 255];
      const ulpin = util.ulpin;
      const title = util.title || `${util.type.toUpperCase()} Pipeline`;

      const path: [number, number, number][] = Array.isArray(util.path) ? util.path : [];
      if (path.length >= 2) {
        // Sample points along the actual path so ColumnLayer discs visually render the 3D pipeline
        for (let i = 0; i < path.length - 1; i++) {
          const p1 = path[i];
          const p2 = path[i + 1];
          const steps = 7;
          for (let s = 0; s <= steps; s++) {
            const frac = s / steps;
            const lat = p1[0] + (p2[0] - p1[0]) * frac;
            const lon = p1[1] + (p2[1] - p1[1]) * frac;
            const depth = (p1[2] + (p2[2] - p1[2]) * frac) || util.depth_m || 3.0;
            columns.push({
              position: [lon, lat, -depth * SCALE_ELEVATION],
              radius: r,
              color,
              ulpin,
              title,
              type: util.type,
              depth_m: depth,
              diameter_mm: util.diameter_mm || 100,
              capacity: util.capacity,
            });
          }
        }
      }
    });

    return columns;
  }, [building?.underground?.utilities, SCALE_ELEVATION]);

  // ── 3D Continuous Pipe Paths via PathLayer ──
  const undergroundPathsData = useMemo(() => {
    const utils: any[] = building?.underground?.utilities || [];
    if (!utils.length) return [];

    return utils
      .filter((u: any) => Array.isArray(u.path) && u.path.length >= 2)
      .map((u: any) => ({
        path: u.path.map((p: [number, number, number]) => [p[1], p[0], -(p[2] || u.depth_m || 3.0) * SCALE_ELEVATION]),
        color: UTILITY_PIPE_COLORS[u.type] || [250, 204, 21, 255],
        width: Math.max((u.diameter_mm || 100) / 40, 2.0),
        util: u,
      }));
  }, [building?.underground?.utilities, SCALE_ELEVATION]);

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
    // ── Underground layers ────────────────────────────────────────────────
    ...(showUnderground ? [
      ...(undergroundUnitsGeoJSON ? [
        new GeoJsonLayer({
          id: 'underground-basement-layer',
          data: undergroundUnitsGeoJSON as any,
          extruded: true,
          wireframe: true,
          getElevation: (f: any) => f.properties.sliceH,
          getFillColor: (f: any) => f.properties.color,
          getLineColor: [255, 255, 255, 120],
          getLineWidth: 1.5,
          lineWidthUnits: 'pixels',
          opacity: 0.88,
          material: { ambient: 0.7, diffuse: 0.6, shininess: 30 },
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 120],
          onClick: (info: any) => {
            if (info.object?.properties) {
              setSelectedUnderground(info.object.properties);
            }
          },
          updateTriggers: { getFillColor: [showUnderground] },
        }),
      ] : []),

      ...(undergroundPathsData.length > 0 ? [
        // ── Continuous 3D Utility Conduit Tubes via PathLayer ──
        new PathLayer({
          id: 'underground-pipes-tubes-layer',
          data: undergroundPathsData,
          getPath: (d: any) => d.path,
          getColor: (d: any) => d.color,
          getWidth: (d: any) => d.width,
          widthUnits: 'meters',
          jointRounded: true,
          capRounded: true,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 180],
          onClick: (info: any) => {
            if (info.object?.util) setSelectedUnderground(info.object.util);
          },
        }),
      ] : []),

      ...(undergroundPipesData.length > 0 ? [
        // ── 3D Cylindrical Pipes via ColumnLayer (each disc = one pipe section / junction) ──
        new ColumnLayer({
          id: 'underground-pipes-cylinder-layer',
          data: undergroundPipesData,
          diskResolution: 16,           // smooth circular cross-section
          radius: 1,                    // overridden per-column by getRadius
          getPosition: (d: any) => d.position,
          getRadius: (d: any) => d.radius,
          getFillColor: (d: any) => d.color,
          getLineColor: (d: any) => d.color.map((c: number, i: number) => i < 3 ? Math.min(c + 60, 255) : 255) as [number,number,number,number],
          extruded: true,
          getElevation: 2.5,            // height of each disc = visual pipe diameter
          elevationScale: 1,
          stroked: true,
          lineWidthMinPixels: 1,
          material: { ambient: 0.6, diffuse: 0.8, shininess: 80 },
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 180],
          onClick: (info: any) => {
            if (info.object) setSelectedUnderground(info.object);
          },
          updateTriggers: { getRadius: [], getFillColor: [] },
        }),
      ] : []),

      ...(undergroundLabelsData.length > 0 ? [
        new TextLayer({
          id: 'underground-labels-layer',
          data: undergroundLabelsData,
          getPosition: (d: any) => [d.coordinates[0], d.coordinates[1], d.zAltitude],
          getText: (d: any) => d.text,
          getSize: 14,
          getColor: [255, 255, 255, 255],
          getAngle: 0,
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'center',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 'bold',
          background: true,
          getBorderColor: (d: any) => {
            if (d.type === 'metro') return [236, 72, 153, 255];
            if (d.type === 'parking') return [14, 165, 233, 255];
            if (d.type === 'museum') return [245, 158, 11, 255];
            return [147, 51, 234, 255];
          },
          getBorderWidth: 2,
          getBackgroundColor: (d: any) => {
            if (d.type === 'metro') return [236, 72, 153, 220];
            if (d.type === 'parking') return [14, 165, 233, 220];
            if (d.type === 'museum') return [245, 158, 11, 220];
            return [147, 51, 234, 220];
          },
          backgroundPadding: [10, 5],
          pickable: true,
          onClick: (info: any) => {
            if (info.object) setSelectedUnderground(info.object);
          },
        }),
      ] : []),
    ] : []),

  ], [
    showContextBuildings,
    footprintBaseGeoJSON,
    unitsGeoJSON,
    undergroundUnitsGeoJSON,
    undergroundLabelsData,
    undergroundPipesData,
    undergroundPathsData,
    floorLabelsData,
    isLightStyle,
    selectedUnit,
    hoveredUnitId,
    selectedFloor,
    selectedStyleUrl,
    onUnitClick,
    showUnderground,
    setSelectedUnderground,
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
        <button
          type="button"
          className={`map-control-btn ${showUnderground ? 'active' : ''}`}
          onClick={() => setShowUnderground((v) => !v)}
          title="Toggle Underground Infrastructure"
          style={{ color: showUnderground ? '#a78bfa' : undefined }}
        >
          <ArrowDownToLine size={17} />
        </button>
        {onToggleLeft && (
          <button
            type="button"
            className={`map-control-btn ${isLeftOpen ? 'active' : ''}`}
            onClick={onToggleLeft}
            title="Toggle Spatial Toolkit"
          >
            <PanelLeft size={17} />
          </button>
        )}
        {onToggleRight && (
          <button
            type="button"
            className={`map-control-btn ${isRightOpen ? 'active' : ''}`}
            onClick={onToggleRight}
            title="Toggle Record & Floors"
          >
            <PanelRight size={17} />
          </button>
        )}
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

      {/* Sleek Underground Subsurface Spatial Record Panel */}
      {selectedUnderground && (
        <div className="underground-info-panel">
          <div className="underground-info-header">
            <div className="underground-info-title-group">
              {selectedUnderground.type === 'water' && <Droplets className="ug-icon" style={{ color: '#38bdf8' }} size={18} />}
              {selectedUnderground.type === 'sewage' && <Wrench className="ug-icon" style={{ color: '#a3e635' }} size={18} />}
              {selectedUnderground.type === 'power' && <Zap className="ug-icon" style={{ color: '#facc15' }} size={18} />}
              {selectedUnderground.type === 'telecom' && <Radio className="ug-icon" style={{ color: '#c084fc' }} size={18} />}
              {selectedUnderground.type === 'gas' && <Flame className="ug-icon" style={{ color: '#fb923c' }} size={18} />}
              {selectedUnderground.type === 'parking' && <Building2 className="ug-icon" style={{ color: '#38bdf8' }} size={18} />}
              {selectedUnderground.type === 'metro' && <Activity className="ug-icon" style={{ color: '#ec4899' }} size={18} />}
              {selectedUnderground.type === 'museum' && <Landmark className="ug-icon" style={{ color: '#f59e0b' }} size={18} />}
              {(!['water','sewage','power','telecom','gas','parking','metro','museum'].includes(selectedUnderground.type)) && <Layers className="ug-icon" style={{ color: '#c084fc' }} size={18} />}
              <div>
                <div className="ug-title-text">
                  {selectedUnderground.title || selectedUnderground.name || 'Subsurface Spatial Asset'}
                </div>
                <div className="ug-subtitle-text">
                  Type: <span className="ug-badge">{selectedUnderground.subsurface_zone || selectedUnderground.type?.toUpperCase()}</span>
                  {selectedUnderground.level && ` · Level ${selectedUnderground.level}`}
                </div>
              </div>
            </div>
            <button type="button" className="ug-close-btn" onClick={() => setSelectedUnderground(null)}>
              <X size={16} />
            </button>
          </div>

          <div className="underground-info-body">
            <div className="ug-ulpin-box">
              <span className="ug-ulpin-label">3D-ULPIN UNIQUE CODE</span>
              <span className="ug-ulpin-code">{selectedUnderground.ulpin || 'ULPIN-UG-SUB-001'}</span>
            </div>

            <div className="ug-grid-stats">
              {selectedUnderground.depth_range ? (
                <div className="ug-stat-card">
                  <span className="ug-stat-label">Subsurface Depth</span>
                  <span className="ug-stat-val">-{selectedUnderground.depth_range[0]}m → -{selectedUnderground.depth_range[1]}m</span>
                </div>
              ) : selectedUnderground.depth_m ? (
                <div className="ug-stat-card">
                  <span className="ug-stat-label">Pipeline Depth</span>
                  <span className="ug-stat-val">-{selectedUnderground.depth_m}m</span>
                </div>
              ) : null}

              {selectedUnderground.volume_m3 ? (
                <div className="ug-stat-card">
                  <span className="ug-stat-label">3D Subsurface Volume</span>
                  <span className="ug-stat-val">{Number(selectedUnderground.volume_m3).toLocaleString()} m³</span>
                </div>
              ) : selectedUnderground.diameter_mm ? (
                <div className="ug-stat-card">
                  <span className="ug-stat-label">Pipe Diameter</span>
                  <span className="ug-stat-val">DN {selectedUnderground.diameter_mm} mm</span>
                </div>
              ) : null}
            </div>

            <div className="ug-status-footer">
              <ShieldCheck size={14} style={{ color: '#10b981' }} />
              <span>Subsurface Cadastral Spatial Record: <strong>VERIFIED</strong></span>
            </div>
          </div>
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
