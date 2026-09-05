import React, { useState } from 'react';
import MapDeckGL from './MapDeckGL';
import MapThreeJS from './MapThreeJS';
import { Building, Unit } from '../../types';
import { Compass, Box } from 'lucide-react';
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

  if (!building) {
    return (
      <div className="map3d-wrapper flex items-center justify-center font-mono text-sm text-slate-400">
        Loading 3D Spatial Building Telemetry...
      </div>
    );
  }

  return (
    <div className="map3d-wrapper">
      {/* 3D Engine Mode Toggle Banner */}
      <div className="mode-switch-banner">
        <button
          type="button"
          className={`mode-switch-btn ${viewMode === 'deck' ? 'active' : ''}`}
          onClick={() => setViewMode('deck')}
        >
          <Compass size={14} />
          <span>deck.gl 3D Geospatial Map</span>
        </button>

        <button
          type="button"
          className={`mode-switch-btn ${viewMode === 'three' ? 'active' : ''}`}
          onClick={() => setViewMode('three')}
        >
          <Box size={14} />
          <span>Three.js Realistic 3D Studio</span>
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
