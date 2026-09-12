import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, TextLayer, ColumnLayer, PathLayer } from '@deck.gl/layers';
import { Tile3DLayer } from '@deck.gl/geo-layers';
import { Tiles3DLoader } from '@loaders.gl/3d-tiles';
import Map from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { Building, Unit } from '../../types';
import { getBuildingCenter, getBuildingHeight, getFloorCountInfo } from '../../utils/footprintUtils';
import { getBuildingUtilityPipelines } from '../../utils/utilityNetworkHelper';
import { REEARTH, setupReearthTerrain } from '../../utils/reearth';
import { buildCadastralVolumes, CadastralVolumesResult } from '../../utils/cadastralVolumeBuilder';
import {
  getGoogle3DTilesUrl,
  hasGoogle3DTilesKey,
  Photorealistic3DStatus,
} from '../../utils/google3DTilesProvider';
import {
  RotateCw,
  Layers,
  MapPin,
  Map as MapIcon,
  Maximize2,
  Building2,
  PanelLeft,
  PanelRight,
  ArrowDownToLine,
  Activity,
  ShieldCheck,
  X,
  Zap,
  Droplets,
  Flame,
  Radio,
  Wrench,
  Landmark,
  Globe2,
  Info,
} from 'lucide-react';
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

const CADASTRAL_FLOOR_COLORS_DARK: [number, number, number][] = [
  [56, 189, 248],   // Cyan
  [14, 165, 233],   // Sky Blue
  [99, 102, 241],   // Indigo
  [59, 130, 246],   // Royal Blue
  [124, 111, 224],  // Purple / Cadastral
  [34, 211, 238],   // Bright Aqua
];

const CADASTRAL_FLOOR_COLORS_LIGHT: [number, number, number][] = [
  [14, 165, 233],
  [59, 130, 246],
  [99, 102, 241],
  [79, 70, 229],
  [124, 111, 224],
  [30, 41, 59],
];

export default function MapDeckGL({
  building,
  selectedUnit,
  onUnitClick,
  selectedFloor,
  isLeftOpen,
  isRightOpen,
  onToggleLeft,
  onToggleRight,
}: MapDeckGLProps) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [selectedStyleUrl, setSelectedStyleUrl] = useState(MAP_STYLES[0].url);
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);
  const [hoveredFloorNumber, setHoveredFloorNumber] = useState<number | null>(null);
  const [hoveredUnitInfo, setHoveredUnitInfo] = useState<{ unit: Unit; x: number; y: number } | null>(null);
  const [showContextBuildings, setShowContextBuildings] = useState(true);
  const [terrainEnabled, setTerrainEnabled] = useState(true);
  const [showUnderground, setShowUnderground] = useState(true);
  const [selectedUnderground, setSelectedUnderground] = useState<any | null>(null);
  const [showDebugTelemetry, setShowDebugTelemetry] = useState(false);

  // ── Google Photorealistic 3D Tiles State for City Context ──
  const [google3DStatus, setGoogle3DStatus] = useState<Photorealistic3DStatus>(() => {
    return hasGoogle3DTilesKey() ? 'loading' : 'unavailable';
  });
  const [useGoogle3D, setUseGoogle3D] = useState<boolean>(() => hasGoogle3DTilesKey());

  const isLightStyle = selectedStyleUrl.includes('positron');

  // ─────────────────────────────────────────────────────────────
  // CADASTRAL MODEL VOLUMES (Strictly Separated from Architectural GLB)
  // Generates transparent stacked floor strata blocks and unit volumes.
  // ─────────────────────────────────────────────────────────────
  const cadastralVolumes: CadastralVolumesResult = useMemo(() => {
    return buildCadastralVolumes(building);
  }, [building]);

  const mapLng = cadastralVolumes.centerLng;
  const mapLat = cadastralVolumes.centerLat;
  const buildingHeight = cadastralVolumes.totalHeightM;
  const floorInfo = getFloorCountInfo(building);

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
      let initialZoom = 17.5;
      const fCount = cadastralVolumes.totalFloors;
      if (fCount > 100) initialZoom = 15.2;
      else if (fCount > 50) initialZoom = 15.8;
      else if (fCount > 25) initialZoom = 16.5;

      setViewState({
        longitude: lngFinal,
        latitude: latFinal,
        zoom: initialZoom,
        pitch: 62,
        bearing: -25,
        maxPitch: 85,
      });
    }
  }, [building?.building_id, cadastralVolumes.totalFloors]);

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

  const SCALE_ELEVATION = 1.0; // 1:1 True metric volumetric elevation

  // ── 1. Parcel Ground Boundary GeoJSON ──
  const parcelBoundaryGeoJSON = useMemo(() => {
    if (!cadastralVolumes.parcelBoundary) return null;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: building?.building_name || 'Cadastral Parcel' },
          geometry: cadastralVolumes.parcelBoundary,
        },
      ],
    };
  }, [cadastralVolumes.parcelBoundary, building?.building_name]);

  // ── 2. Stacked Volumetric Transparent Floors GeoJSON ──
  const floorsGeoJSON = useMemo(() => {
    const features = cadastralVolumes.floorVolumes.map((fv) => {
      const isFloorIsolated = selectedFloor === fv.floorIndex;
      const isHovered = hoveredFloorNumber === fv.floorIndex;
      const poly = fv.polygon;

      const polygons =
        poly?.type === 'MultiPolygon'
          ? poly.coordinates
          : [poly?.coordinates || []];

      return {
        type: 'Feature',
        properties: {
          floor_number: fv.floorIndex,
          floorLabel: fv.floorLabel,
          z_min: fv.zMin,
          z_max: fv.zMax,
          sliceHeight: fv.sliceHeight,
          zBase: fv.zBase,
          zCenter: fv.zCenter,
          isFloorIsolated,
          isHovered,
        },
        geometry: {
          type: poly.type || 'Polygon',
          coordinates: polygons[0] ? polygons[0].map((ring: number[][]) =>
            ring.map((coord: number[]) => [coord[0], coord[1], fv.zBase])
          ) : [],
        },
      };
    });

    return { type: 'FeatureCollection', features };
  }, [cadastralVolumes.floorVolumes, selectedFloor, hoveredFloorNumber]);

  // ── 3. Cadastral Units Subdivision GeoJSON ──
  const unitsGeoJSON = useMemo(() => {
    const rawUnits = cadastralVolumes.unitVolumes;
    const filteredUnits = selectedFloor !== null
      ? rawUnits.filter((u) => u.floorNumber === selectedFloor)
      : rawUnits;

    const features = filteredUnits.flatMap((u) => {
      const isSelected = selectedUnit?.unit_id === u.unitId;
      const isHovered = hoveredUnitId === u.unitId;
      const isFloorIsolated = selectedFloor === u.floorNumber;

      const poly = u.polygon;
      const polygons =
        poly?.type === 'MultiPolygon'
          ? poly.coordinates
          : [poly?.coordinates || []];

      return polygons.map((polygon: number[][][]) => ({
        type: 'Feature',
        properties: {
          unit_id: u.unitId,
          unit_number: u.unitNumber,
          floor_number: u.floorNumber,
          use_type: u.useType,
          ulpin: u.ulpin,
          area_sqm: u.areaSqm,
          z_min: u.zMin,
          z_max: u.zMax,
          sliceHeight: u.sliceHeight,
          zBase: u.zBase,
          zCenter: u.zCenter,
          isSelected,
          isHovered,
          isFloorIsolated,
        },
        geometry: {
          type: 'Polygon',
          coordinates: polygon.map((ring: number[][]) =>
            ring.map((coord: number[]) => [coord[0], coord[1], u.zBase])
          ),
        },
      }));
    });

    return { type: 'FeatureCollection', features };
  }, [cadastralVolumes.unitVolumes, selectedUnit, hoveredUnitId, selectedFloor]);

  // ── 4. Subsurface Infrastructure GeoJSON & Pipelines ──
  const undergroundUnitsGeoJSON = useMemo(() => {
    const ulpinDetails: any[] = building?.underground?.ulpin_details || [];
    const structuralUnits = ulpinDetails.filter((u: any) => u.type !== 'utility');
    if (structuralUnits.length === 0) return null;

    const TYPE_COLORS: Record<string, [number, number, number, number]> = {
      basement: [147, 51, 234, 190],
      parking: [14, 165, 233, 205],
      metro: [236, 72, 153, 220],
      museum: [245, 158, 11, 220],
    };

    const features = structuralUnits.map((u: any) => {
      const depthRange = u.depth_range || [Math.abs(u.level) * 3.5, (Math.abs(u.level) + 1) * 3.5];
      const zTop = -depthRange[0];
      const zBottom = -depthRange[1];
      const sliceH = depthRange[1] - depthRange[0];
      const zMid = (zTop + zBottom) / 2;

      const cLat = u.coordinates?.[0] || mapLat;
      const cLon = u.coordinates?.[1] || mapLng;
      const spread = 0.00035;

      const ring = [
        [cLon - spread, cLat - spread, zBottom],
        [cLon + spread, cLat - spread, zBottom],
        [cLon + spread, cLat + spread, zBottom],
        [cLon - spread, cLat + spread, zBottom],
        [cLon - spread, cLat - spread, zBottom],
      ];

      const color = TYPE_COLORS[u.type] || [124, 111, 224, 190];

      return {
        type: 'Feature',
        properties: {
          ...u,
          title: u.title || (u.type === 'parking' ? 'Basement Parking' : u.type === 'metro' ? 'Metro Substation' : 'Underground Vault'),
          zTop,
          zBottom,
          sliceH,
          zMid,
          cLat,
          cLon,
          color,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [ring],
        },
      };
    });

    return { type: 'FeatureCollection', features };
  }, [building?.underground?.ulpin_details, mapLat, mapLng]);

  const utilityPipelines = useMemo(() => {
    return getBuildingUtilityPipelines(building);
  }, [building]);

  const undergroundPipesData = useMemo(() => {
    const columns: any[] = [];
    utilityPipelines.forEach((util) => {
      const r = Math.max((util.diameter_mm / 1000) * 4.5, 2.0);
      const path = util.pathGeodetic;
      for (let i = 0; i < path.length; i++) {
        const [lon, lat, depth] = path[i];
        columns.push({
          position: [lon, lat, -depth],
          radius: r,
          color: util.color,
          ulpin: util.ulpin,
          title: util.title,
          type: util.type,
          depth_m: depth,
          diameter_mm: util.diameter_mm,
          capacity: util.capacity,
        });
      }
    });
    return columns;
  }, [utilityPipelines]);

  const undergroundPathsData = useMemo(() => {
    return utilityPipelines.map((u) => ({
      path: u.pathGeodetic.map(([lng, lat, depth]) => [lng, lat, -depth]),
      color: u.color,
      width: Math.max(u.diameter_mm / 35, 3.5),
      util: u,
    }));
  }, [utilityPipelines]);

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

  // ── 5. Isolated Floor Label ──
  const floorLabelsData = useMemo(() => {
    if (selectedFloor === null) return [];
    const targetFloor = cadastralVolumes.floorVolumes.find((fv) => fv.floorIndex === selectedFloor);
    const zMax = targetFloor ? targetFloor.zMax : selectedFloor * cadastralVolumes.floorHeightM;
    const zAltitude = targetFloor ? targetFloor.zCenter : zMax - 1.5;

    return [
      {
        text: `▶ Floor ${selectedFloor}  +${Number(zMax).toFixed(1)}m`,
        coordinates: [mapLng, mapLat],
        floorNumber: selectedFloor,
        zAltitude,
      },
    ];
  }, [selectedFloor, cadastralVolumes.floorVolumes, cadastralVolumes.floorHeightM, mapLng, mapLat]);

  const googleTilesUrl = useMemo(() => getGoogle3DTilesUrl(), []);

  // ─────────────────────────────────────────────────────────────
  // DECK.GL LAYER STACK:
  // Strictly Cadastral Volumes + Strata Slices + Subsurface Assets.
  // Never renders heavy architectural GLB meshes.
  // ─────────────────────────────────────────────────────────────
  const layers = useMemo(() => {
    const cadastralLayers: any[] = [];
    const undergroundLayers: any[] = [];
    const contextLayers: any[] = [];

    // ── Layer 1: Flat Ground Parcel Boundary Outline ──
    if (parcelBoundaryGeoJSON) {
      cadastralLayers.push(
        new GeoJsonLayer({
          id: 'cadastral-parcel-boundary',
          data: parcelBoundaryGeoJSON as any,
          extruded: false,
          getFillColor: isLightStyle ? [99, 102, 241, 35] : [56, 189, 248, 25],
          getLineColor: isLightStyle ? [79, 70, 229, 240] : [56, 189, 248, 220],
          getLineWidth: 2.5,
          lineWidthUnits: 'pixels',
          pickable: false,
        })
      );
    }

    // ── Layer 2: Stacked Transparent Volumetric Cadastral Floors ──
    if (floorsGeoJSON.features.length > 0) {
      cadastralLayers.push(
        new GeoJsonLayer({
          id: 'cadastral-floors-volumetric-layer',
          data: floorsGeoJSON as any,
          extruded: true,
          wireframe: true,
          getElevation: (f: any) => f.properties.sliceHeight,
          getFillColor: (f: any) => {
            const p = f.properties;
            // Floor Isolated Mode
            if (p.isFloorIsolated) {
              return [56, 189, 248, 225]; // Prominent active cyan highlight
            }
            if (selectedFloor !== null && !p.isFloorIsolated) {
              return isLightStyle ? [203, 213, 225, 25] : [15, 23, 42, 30]; // Ghosted inactive floors
            }
            if (p.isHovered) {
              return [56, 189, 248, 190];
            }
            // All Floors Mode: Elegant stacked translucent strata
            const palette = isLightStyle ? CADASTRAL_FLOOR_COLORS_LIGHT : CADASTRAL_FLOOR_COLORS_DARK;
            const rgb = palette[(p.floor_number - 1) % palette.length];
            return [...rgb, isLightStyle ? 140 : 120];
          },
          getLineColor: (f: any) => {
            const p = f.properties;
            if (p.isFloorIsolated) return [255, 255, 255, 255];
            if (selectedFloor !== null && !p.isFloorIsolated) {
              return isLightStyle ? [148, 163, 184, 40] : [71, 85, 105, 35];
            }
            if (p.isHovered) return [255, 255, 255, 240];
            return isLightStyle ? [15, 23, 42, 200] : [255, 255, 255, 160];
          },
          getLineWidth: (f: any) => {
            const p = f.properties;
            if (p.isFloorIsolated) return 3.2;
            if (p.isHovered) return 2.2;
            return isLightStyle ? 1.5 : 1.2;
          },
          lineWidthUnits: 'pixels',
          material: {
            ambient: isLightStyle ? 0.75 : 0.6,
            diffuse: isLightStyle ? 0.8 : 0.7,
            shininess: isLightStyle ? 45 : 32,
          },
          pickable: true,
          autoHighlight: true,
          highlightColor: isLightStyle ? [59, 130, 246, 60] : [56, 189, 248, 70],
          onClick: (info: any) => {
            if (info.object?.properties) {
              const fNum = info.object.properties.floor_number;
              const unit = building?.units?.find((u) => (u.floor_number ?? u.floor ?? 1) === fNum);
              if (unit) onUnitClick(unit);
            }
          },
          onHover: (info: any) => {
            if (info.object?.properties?.floor_number) {
              setHoveredFloorNumber(info.object.properties.floor_number);
            } else {
              setHoveredFloorNumber(null);
            }
          },
          updateTriggers: {
            getFillColor: [selectedFloor, hoveredFloorNumber, selectedStyleUrl],
            getLineColor: [selectedFloor, hoveredFloorNumber, selectedStyleUrl],
            getLineWidth: [selectedFloor, hoveredFloorNumber, selectedStyleUrl],
          },
        })
      );
    }

    // ── Layer 3: Cadastral Units Subdivision / Unit Selection Highlight ──
    if (unitsGeoJSON.features.length > 0 && selectedUnit) {
      cadastralLayers.push(
        new GeoJsonLayer({
          id: 'cadastral-selected-unit-highlight',
          data: unitsGeoJSON.features.filter((f) => f.properties.isSelected) as any,
          extruded: true,
          wireframe: true,
          getElevation: (f: any) => f.properties.sliceHeight,
          getFillColor: [56, 189, 248, 250],
          getLineColor: [255, 255, 255, 255],
          getLineWidth: 4.0,
          lineWidthUnits: 'pixels',
          pickable: true,
        })
      );
    }

    // ── Layer 4: Isolated Floor Label ──
    if (floorLabelsData.length > 0) {
      cadastralLayers.push(
        new TextLayer({
          id: 'cadastral-floor-labels-layer',
          data: floorLabelsData,
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
          getBackgroundColor: [14, 165, 233, 240],
          backgroundPadding: [8, 4],
          updateTriggers: {
            getPosition: [selectedFloor],
          },
        })
      );
    }

    // ── Layer 5: Cadastral Apex Badge Label ──
    cadastralLayers.push(
      new TextLayer({
        id: 'cadastral-apex-badge-layer',
        data: [
          {
            text: `${building?.building_name || 'Cadastral Structure'}\n${cadastralVolumes.totalFloors} Floors · ${cadastralVolumes.totalHeightM.toFixed(1)}m · Volumetric Cadastre`,
            coordinates: [mapLng, mapLat],
            zAltitude: cadastralVolumes.totalHeightM + 2.5,
          },
        ],
        getPosition: (d: any) => [d.coordinates[0], d.coordinates[1], d.zAltitude],
        getText: (d: any) => d.text,
        getSize: 12,
        getColor: [255, 255, 255, 255],
        getAngle: 0,
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'bottom',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 'bold',
        lineHeight: 1.4,
        background: true,
        getBackgroundColor: isLightStyle ? [15, 23, 42, 220] : [10, 15, 29, 230],
        getBorderColor: [56, 189, 248, 240],
        getBorderWidth: 1.5,
        backgroundPadding: [8, 6],
      })
    );

    // ── Layer 6: Underground Subsurface Infrastructure (Below Ground Level) ──
    if (showUnderground) {
      if (undergroundUnitsGeoJSON) {
        undergroundLayers.push(
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
          })
        );
      }

      if (undergroundPathsData.length > 0) {
        undergroundLayers.push(
          new PathLayer({
            id: 'underground-pipes-tubes-layer',
            data: undergroundPathsData,
            getPath: (d: any) => d.path,
            getColor: (d: any) => d.color,
            getWidth: (d: any) => d.width,
            widthUnits: 'pixels',
            capRounded: true,
            jointRounded: true,
            opacity: 0.95,
            pickable: true,
            autoHighlight: true,
            highlightColor: [255, 255, 255, 200],
            onClick: (info: any) => {
              if (info.object?.util) {
                setSelectedUnderground(info.object.util);
              }
            },
          })
        );
      }

      if (undergroundPipesData.length > 0) {
        undergroundLayers.push(
          new ColumnLayer({
            id: 'underground-pipes-columns-layer',
            data: undergroundPipesData,
            getPosition: (d: any) => d.position,
            getFillColor: (d: any) => d.color,
            getLineColor: [255, 255, 255, 180],
            getLineWidth: 1.2,
            lineWidthUnits: 'pixels',
            radius: 1.2,
            diskResolution: 12,
            elevationScale: 1.0,
            getElevation: 0.6,
            opacity: 0.92,
            pickable: true,
            autoHighlight: true,
            highlightColor: [255, 255, 255, 180],
            onClick: (info: any) => {
              if (info.object) {
                setSelectedUnderground(info.object);
              }
            },
          })
        );
      }

      if (undergroundLabelsData.length > 0) {
        undergroundLayers.push(
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
          })
        );
      }
    }

    // ── Layer 7: Surrounding Context City Tiles (Only for background context) ──
    if (showContextBuildings) {
      if (useGoogle3D && googleTilesUrl && google3DStatus !== 'unavailable') {
        contextLayers.push(
          new Tile3DLayer({
            id: 'google-photorealistic-3d-tiles-context',
            data: googleTilesUrl,
            loader: Tiles3DLoader,
            loadOptions: {
              '3d-tiles': {
                loadGLTF: true,
                decodeQuantizedPositions: true,
                isGoogleTileset: true,
              },
              tileset: {
                maximumScreenSpaceError: 16,
              },
            },
            opacity: 0.65,
            pickable: false,
            onTilesetLoad: () => {
              setGoogle3DStatus('available');
            },
            onTileError: (tileHeader: any, message: string) => {
              console.warn('[Google 3D Tiles] Failed loading tile:', message);
              setGoogle3DStatus('unavailable');
            },
          })
        );
      } else {
        contextLayers.push(
          new Tile3DLayer({
            id: 'reearth-osm-buildings-context',
            data: REEARTH.buildingsTileset,
            loader: Tiles3DLoader,
            opacity: 0.55,
            pickable: false,
            loadOptions: {
              '3d-tiles': { loadGLTF: true },
            },
          })
        );
      }
    }

    return [...contextLayers, ...cadastralLayers, ...undergroundLayers];
  }, [
    parcelBoundaryGeoJSON,
    floorsGeoJSON,
    unitsGeoJSON,
    selectedFloor,
    hoveredFloorNumber,
    selectedUnit,
    floorLabelsData,
    cadastralVolumes.totalFloors,
    cadastralVolumes.totalHeightM,
    mapLng,
    mapLat,
    isLightStyle,
    showUnderground,
    undergroundUnitsGeoJSON,
    undergroundPathsData,
    undergroundPipesData,
    undergroundLabelsData,
    showContextBuildings,
    useGoogle3D,
    googleTilesUrl,
    google3DStatus,
    selectedStyleUrl,
    building?.units,
    building?.building_name,
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
        <Map mapLib={maplibregl} mapStyle={selectedStyleUrl} onLoad={handleMapLoad} />
      </DeckGL>

      {/* Floating Toolbar Controls */}
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
          title="Toggle Context 3D Buildings"
        >
          <Building2 size={17} />
        </button>
        {hasGoogle3DTilesKey() && (
          <button
            type="button"
            className={`map-control-btn ${useGoogle3D ? 'active' : ''}`}
            onClick={() => setUseGoogle3D((v) => !v)}
            title="Toggle Google Photorealistic 3D Tiles vs OSM Tiles"
            style={{ color: useGoogle3D ? '#38bdf8' : undefined }}
          >
            <Globe2 size={17} />
          </button>
        )}
        <button
          type="button"
          className={`map-control-btn ${showUnderground ? 'active' : ''}`}
          onClick={() => setShowUnderground((v) => !v)}
          title="Toggle Underground Infrastructure"
          style={{ color: showUnderground ? '#a78bfa' : undefined }}
        >
          <ArrowDownToLine size={17} />
        </button>
        <button
          type="button"
          className={`map-control-btn ${showDebugTelemetry ? 'active' : ''}`}
          onClick={() => setShowDebugTelemetry((v) => !v)}
          title="Toggle Pipeline Diagnostics HUD"
          style={{ color: showDebugTelemetry ? '#38bdf8' : undefined }}
        >
          <Info size={16} />
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

      {/* Basemap & Terrain Controls */}
      <div className="basemap-selector-box">
        <MapIcon size={14} style={{ color: 'var(--accent-teal)' }} />
        <span>Style:</span>
        <select
          className="basemap-select-input"
          value={selectedStyleUrl}
          onChange={(e) => setSelectedStyleUrl(e.target.value)}
        >
          {MAP_STYLES.map((style) => (
            <option key={style.id} value={style.url}>
              {style.name}
            </option>
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

      {/* Location Banner with Cadastral Volume Status */}
      <div className="location-overlay-banner">
        <div className="location-icon-pin">
          <MapPin size={16} />
        </div>
        <div className="location-text-info">
          <div className="flex items-center gap-2">
            <span className="location-bldg-title">
              {building?.building_name || building?.address || 'Cadastral Parcel'}
            </span>
            <span className="text-[0.62rem] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono">
              Volumetric Cadastre
            </span>
          </div>
          <span className="location-coords-sub">
            {selectedFloor !== null
              ? `Isolated Floor ${selectedFloor} Active · ${cadastralVolumes.floorHeightM.toFixed(1)}m Slice`
              : `${cadastralVolumes.totalFloors} Transparent Strata Floors · ${cadastralVolumes.totalHeightM.toFixed(1)}m Total`}
          </span>
        </div>
      </div>

      {/* Diagnostics / Telemetry HUD */}
      {showDebugTelemetry && (
        <div
          style={{
            position: 'absolute',
            top: 70,
            left: 14,
            zIndex: 90,
            background: 'rgba(10, 15, 30, 0.94)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: 8,
            padding: '12px 16px',
            color: '#e2e8f0',
            fontFamily: 'monospace',
            fontSize: 11,
            lineHeight: 1.6,
            backdropFilter: 'blur(8px)',
            minWidth: 260,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
            ⚡ DECK.GL CADASTRAL TELEMETRY
          </div>
          <div>Cadastral Provider: <strong style={{ color: '#38bdf8' }}>UnifiedBuildingData (Volumetric)</strong></div>
          <div>Visual Mode: <strong style={{ color: '#10b981' }}>Volumetric Cadastre</strong></div>
          <div>Floor Volumes: <strong style={{ color: '#38bdf8' }}>{cadastralVolumes.totalFloors}</strong></div>
          <div>Units Subdivision: <strong style={{ color: '#a5b4fc' }}>{cadastralVolumes.unitVolumes.length}</strong></div>
          <div>Underground Layers: <strong style={{ color: '#a78bfa' }}>{(undergroundUnitsGeoJSON?.features?.length || 0) + utilityPipelines.length}</strong></div>
          <div>Selected Floor: <strong style={{ color: selectedFloor !== null ? '#fde047' : '#94a3b8' }}>{selectedFloor !== null ? `Floor ${selectedFloor}` : 'ALL'}</strong></div>
          <div>Selected Unit: <strong style={{ color: selectedUnit ? '#38bdf8' : '#94a3b8' }}>{selectedUnit?.unit_id || 'None'}</strong></div>
        </div>
      )}

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
          <div>
            Floor:{' '}
            <strong style={{ color: '#fff' }}>
              {hoveredUnitInfo.unit.floor_number ?? hoveredUnitInfo.unit.floor ?? '—'}
            </strong>
          </div>
          <div>
            Z:{' '}
            <strong style={{ color: '#fff' }}>
              {Number(hoveredUnitInfo.unit.z_min ?? 0).toFixed(1)}m →{' '}
              {Number(hoveredUnitInfo.unit.z_max ?? 0).toFixed(1)}m
            </strong>
          </div>
          {hoveredUnitInfo.unit.ulpin && (
            <div style={{ marginTop: 4, fontSize: 10, color: '#22D3EE', wordBreak: 'break-all', fontFamily: 'monospace' }}>
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
              {!['water', 'sewage', 'power', 'telecom', 'gas', 'parking', 'metro', 'museum'].includes(selectedUnderground.type) && (
                <Layers className="ug-icon" style={{ color: '#c084fc' }} size={18} />
              )}
              <div>
                <div className="ug-title-text">
                  {selectedUnderground.title || selectedUnderground.name || 'Subsurface Spatial Asset'}
                </div>
                <div className="ug-subtitle-text">
                  Type:{' '}
                  <span className="ug-badge">
                    {selectedUnderground.subsurface_zone || selectedUnderground.type?.toUpperCase()}
                  </span>
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
                  <span className="ug-stat-val">
                    -{selectedUnderground.depth_range[0]}m → -{selectedUnderground.depth_range[1]}m
                  </span>
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
              <span>
                Subsurface Cadastral Spatial Record: <strong>VERIFIED</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tech Footer Badge */}
      <div className="tech-badge-footer">
        <span className="pulse-dot" />
        <span style={{ color: 'var(--accent-teal)', fontWeight: 600 }}>
          Volumetric Cadastre
        </span>
        <span style={{ color: '#38bdf8', fontWeight: 500, marginLeft: 6 }}>
          · deck.gl Geospatial
        </span>
      </div>

      <div className="map-attribution-footer" title={REEARTH.attribution}>
        {REEARTH.attribution}
      </div>
    </div>
  );
}
