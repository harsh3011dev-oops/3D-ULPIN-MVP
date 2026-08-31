import React from 'react';
import { PRESET_BUILDINGS } from '../mocks/mockBuildings';
import { PresetBuilding } from '../types';

interface PresetButtonsProps {
  onSelectPreset: (preset: PresetBuilding) => void;
}

export const PresetButtons: React.FC<PresetButtonsProps> = ({ onSelectPreset }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {PRESET_BUILDINGS.map((preset, index) => (
        <button
          key={preset.parcel_id || index}
          onClick={() => onSelectPreset(preset)}
          className="flex flex-col items-start p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-500 hover:shadow-md transition-all text-left"
        >
          <span className="font-semibold text-slate-900 text-sm">{preset.name}</span>
          <span className="text-xs text-slate-500 mt-1">{preset.address}</span>
          <div className="flex gap-3 text-xs text-slate-400 mt-2">
            <span>{preset.height_meters}m</span>
            <span>{preset.floor_count} Floors</span>
          </div>
        </button>
      ))}
    </div>
  );
};

export default PresetButtons;
