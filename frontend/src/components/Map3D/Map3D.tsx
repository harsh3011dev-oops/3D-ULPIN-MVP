import React, { useState } from 'react';
import MapDeckGL from './MapDeckGL';
import MapThreeJS from './MapThreeJS';
import { Building, Unit } from '../../types';
import { Compass, Box } from 'lucide-react';

interface Map3DProps {
  building: Building | null;
  selectedUnit: Unit | null;
  onUnitClick: (unit: Unit) => void;
  selectedFloor: number | null;
}

export default function Map3D({ building, selectedUnit, onUnitClick, selectedFloor }: Map3DProps) {
  const [viewMode, setViewMode] = useState<'deck' | 'three'>('deck');

  if (!building) {
    return (
      <div className="relative w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-400 font-mono text-sm">
        Loading 3D Spatial Building telemetry...
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* 3D Mode Toggle Switch Banner */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-slate-900/90 backdrop-blur border border-white/15 p-1 rounded-full shadow-2xl">
        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            viewMode === 'deck'
              ? 'bg-blue-600 text-white shadow-glow'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          onClick={() => setViewMode('deck')}
        >
          <Compass size={14} />
          <span>deck.gl 3D Geospatial Map</span>
        </button>

        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
            viewMode === 'three'
              ? 'bg-cyan-600 text-white shadow-glow'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
          onClick={() => setViewMode('three')}
        >
          <Box size={14} />
          <span>Three.js Realistic 3D Studio</span>
        </button>
      </div>

      {/* Render Active View Engine */}
      {viewMode === 'deck' ? (
        <MapDeckGL
          building={building}
          selectedUnit={selectedUnit}
          onUnitClick={onUnitClick}
          selectedFloor={selectedFloor}
        />
      ) : (
        <MapThreeJS
          building={building}
          selectedUnit={selectedUnit}
          onUnitClick={onUnitClick}
          selectedFloor={selectedFloor}
        />
      )}
    </div>
  );
}
