import React, { useState } from 'react';
import MapDeckGL from './MapDeckGL';
import MapThreeJS from './MapThreeJS';
import { Building, Unit } from '../../types';
import { Compass, Box, Camera, Download, Check } from 'lucide-react';
import './Map3D.css';

interface Map3DProps {
  building: Building | null;
  selectedUnit: Unit | null;
  onUnitClick: (unit: Unit) => void;
  selectedFloor: number | null;
  isLeftOpen?: boolean;
  isRightOpen?: boolean;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
}

export default function Map3D({
  building,
  selectedUnit,
  onUnitClick,
  selectedFloor,
  isLeftOpen,
  isRightOpen,
  onToggleLeft,
  onToggleRight,
}: Map3DProps) {
  const [viewMode, setViewMode] = useState<'deck' | 'three'>('deck');
  const [copiedShot, setCopiedShot] = useState(false);
  const [exportedObj, setExportedObj] = useState(false);

  if (!building) {
    return (
      <div className="map3d-wrapper flex items-center justify-center font-mono text-sm text-slate-400">
        Loading 3D Spatial Building Telemetry...
      </div>
    );
  }

  // 1. High-Resolution 3D Canvas Snapshot with Official Telemetry Watermark
  const handleCaptureSnapshot = () => {
    const canvas = document.querySelector('.map3d-wrapper canvas') as HTMLCanvasElement;
    if (!canvas) return;

    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;
      const ctx = exportCanvas.getContext('2d');
      if (!ctx) return;

      // Draw active WebGL framebuffer
      ctx.drawImage(canvas, 0, 0);

      // Draw bottom telemetry banner
      const barHeight = Math.max(40, Math.round(canvas.height * 0.045));
      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

      // Left branding
      ctx.fillStyle = '#0D9488';
      ctx.font = `bold ${Math.round(barHeight * 0.42)}px sans-serif`;
      ctx.fillText('3D-ULPIN VOLUMETRIC CADASTRE', 24, canvas.height - barHeight * 0.35);

      // Right metadata
      ctx.fillStyle = '#94a3b8';
      ctx.font = `${Math.round(barHeight * 0.36)}px monospace`;
      const meta = `${building.building_name || 'Cadastral Parcel'} • Lat: ${(building.latitude || 0).toFixed(5)}°, Lon: ${(building.longitude || 0).toFixed(5)}° • ${new Date().toLocaleDateString('en-GB')}`;
      const textWidth = ctx.measureText(meta).width;
      ctx.fillText(meta, canvas.width - textWidth - 24, canvas.height - barHeight * 0.36);

      const a = document.createElement('a');
      a.href = exportCanvas.toDataURL('image/png');
      a.download = `3D-ULPIN-SNAPSHOT-${(building.building_name || 'MODEL').replace(/[^a-zA-Z0-9]/g, '_')}.png`;
      a.click();

      setCopiedShot(true);
      setTimeout(() => setCopiedShot(false), 2000);
    } catch (err) {
      console.warn('Snapshot capture fallback:', err);
    }
  };

  // 2. Wavefront OBJ 3D Model Exporter (Interoperable with AutoCAD / Blender / ArcGIS)
  const handleExportOBJ = () => {
    let obj = `# 3D ULPIN Cadastral Framework - Wavefront OBJ Exporter\n`;
    obj += `# Building: ${building.building_name || 'Cadastral Parcel'}\n`;
    obj += `# ULPIN: ${building.building_id || 'PARCEL-001'}\n`;
    obj += `# Height: ${building.height || 30}m, Floors: ${building.floor_count || 4}\n\n`;
    obj += `o Building_${(building.building_id || 'Cadastre').replace(/[^a-zA-Z0-9]/g, '_')}\n`;

    const h = building.height || (building.floor_count ? building.floor_count * 3.5 : 25);
    
    // Extract coordinates from GeoJSON footprint (Polygon or MultiPolygon)
    let coords: [number, number][] = [];
    if (building.footprint) {
      const fp = building.footprint as any;
      if (fp.type === 'Polygon' && fp.coordinates?.[0]) {
        coords = fp.coordinates[0] as [number, number][];
      } else if (fp.type === 'MultiPolygon' && fp.coordinates?.[0]?.[0]) {
        coords = fp.coordinates[0][0] as [number, number][];
      }
    }
    // Fallback to small default square around building centroid
    if (!coords.length) {
      coords = [
        [-0.00015, -0.00015],
        [0.00015, -0.00015],
        [0.00015, 0.00015],
        [-0.00015, 0.00015],
      ];
    }

    // Scale footprint points into local metric coordinates
    const pts: [number, number][] = coords.map(([lon, lat]: [number, number]) => [
      (lon - (building.longitude || 0)) * 111000 * Math.cos(((building.latitude || 28.6) * Math.PI) / 180),
      (lat - (building.latitude || 0)) * 111000,
    ]);

    // Base vertices (Ground level Y=0)
    pts.forEach(([x, z]: [number, number]) => {
      obj += `v ${x.toFixed(3)} 0.000 ${(-z).toFixed(3)}\n`;
    });

    // Top vertices (Roof level Y=h)
    pts.forEach(([x, z]: [number, number]) => {
      obj += `v ${x.toFixed(3)} ${h.toFixed(3)} ${(-z).toFixed(3)}\n`;
    });

    const n = pts.length;
    // Bottom polygon
    obj += `f ${Array.from({ length: n }, (_, i) => n - i).join(' ')}\n`;
    // Top polygon
    obj += `f ${Array.from({ length: n }, (_, i) => n + 1 + i).join(' ')}\n`;

    // Wall quad faces
    for (let i = 1; i <= n; i++) {
      const next = (i % n) + 1;
      obj += `f ${i} ${next} ${next + n} ${i + n}\n`;
    }

    const blob = new Blob([obj], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `3D-ULPIN-MODEL-${(building.building_name || 'CADASTRE').replace(/[^a-zA-Z0-9]/g, '_')}.obj`;
    a.click();
    URL.revokeObjectURL(url);

    setExportedObj(true);
    setTimeout(() => setExportedObj(false), 2000);
  };

  return (
    <div className="map3d-wrapper">
      {/* 3D Engine Mode Toggle & Export Toolbar */}
      <div className="mode-switch-banner">
        <button
          type="button"
          className={`mode-switch-btn ${viewMode === 'deck' ? 'active' : ''}`}
          onClick={() => setViewMode('deck')}
        >
          <Compass size={14} />
          <span>deck.gl Geospatial</span>
        </button>

        <button
          type="button"
          className={`mode-switch-btn ${viewMode === 'three' ? 'active' : ''}`}
          onClick={() => setViewMode('three')}
        >
          <Box size={14} />
          <span>Three.js 3D Studio</span>
        </button>

        {/* Separator */}
        <div style={{ width: 1, height: 18, background: 'rgba(255, 255, 255, 0.2)', margin: '0 2px' }} />

        {/* Snapshot Capture Button */}
        <button
          type="button"
          className="mode-switch-btn"
          onClick={handleCaptureSnapshot}
          title="Capture High-Resolution 3D Snapshot with ULPIN Watermark"
        >
          {copiedShot ? <Check size={14} className="text-emerald-400" /> : <Camera size={14} />}
          <span>{copiedShot ? 'Saved PNG' : 'Snapshot'}</span>
        </button>

        {/* 3D OBJ Export Button */}
        <button
          type="button"
          className="mode-switch-btn"
          onClick={handleExportOBJ}
          title="Export 3D Model as Wavefront OBJ file for CAD/GIS"
        >
          {exportedObj ? <Check size={14} className="text-emerald-400" /> : <Download size={14} />}
          <span>{exportedObj ? 'Exported OBJ' : 'Export 3D'}</span>
        </button>
      </div>

      {/* Render Active 3D Engine View */}
      {viewMode === 'deck' ? (
        <MapDeckGL
          building={building}
          selectedUnit={selectedUnit}
          onUnitClick={onUnitClick}
          selectedFloor={selectedFloor}
          isLeftOpen={isLeftOpen}
          isRightOpen={isRightOpen}
          onToggleLeft={onToggleLeft}
          onToggleRight={onToggleRight}
        />
      ) : (
        <MapThreeJS
          building={building}
          selectedUnit={selectedUnit}
          onUnitClick={onUnitClick}
          selectedFloor={selectedFloor}
          isLeftOpen={isLeftOpen}
          isRightOpen={isRightOpen}
          onToggleLeft={onToggleLeft}
          onToggleRight={onToggleRight}
        />
      )}
    </div>
  );
}
