import React from 'react';
import { Layers } from 'lucide-react';
import './FloorSelector.css';

interface FloorSelectorProps {
  totalFloors: number;
  selectedFloor: number | null;
  onSelectFloor: (floor: number | null) => void;
}

export default function FloorSelector({ totalFloors, selectedFloor, onSelectFloor }: FloorSelectorProps) {
  const floors = Array.from({ length: totalFloors }, (_, i) => i + 1);

  return (
    <div className="floor-selector-panel glass-panel">
      <div className="floor-selector-header">
        <div className="header-title-group">
          <Layers size={18} className="icon-blue" />
          <span className="floor-panel-title">Floor Isolator</span>
        </div>
        
        {selectedFloor !== null && (
          <button
            className="reset-floor-btn"
            onClick={() => onSelectFloor(null)}
            title="Show All Building Floors"
          >
            Show All ({totalFloors})
          </button>
        )}
      </div>

      {/* Slider Control */}
      <div className="slider-wrapper">
        <div className="slider-label-row">
          <span>Level Elevation</span>
          <span className="current-level-tag">
            {selectedFloor ? `Floor ${selectedFloor}` : 'All Floors'}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max={totalFloors}
          value={selectedFloor || 0}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            onSelectFloor(val === 0 ? null : val);
          }}
          className="floor-range-slider"
        />
      </div>

      {/* Quick Floor Grid Pills */}
      <div className="floor-buttons-grid">
        <button
          className={`floor-pill ${selectedFloor === null ? 'active' : ''}`}
          onClick={() => onSelectFloor(null)}
        >
          All
        </button>
        {floors.map((floorNum) => (
          <button
            key={floorNum}
            className={`floor-pill ${selectedFloor === floorNum ? 'active' : ''}`}
            onClick={() => onSelectFloor(floorNum)}
          >
            F{floorNum}
          </button>
        ))}
      </div>
    </div>
  );
}
