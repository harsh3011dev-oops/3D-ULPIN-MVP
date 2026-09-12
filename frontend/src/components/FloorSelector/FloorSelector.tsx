import React from 'react';
import { Layers } from 'lucide-react';
import './FloorSelector.css';

interface FloorSelectorProps {
  totalFloors: number;
  basementFloors?: number;
  basementUse?: string;
  floorLabels?: string[];
  selectedFloor: number | null;
  onSelectFloor: (floor: number | null) => void;
}

export default function FloorSelector({
  totalFloors,
  basementFloors = 0,
  basementUse = 'Library',
  floorLabels,
  selectedFloor,
  onSelectFloor,
}: FloorSelectorProps) {
  const aboveGroundFloors = Array.from({ length: totalFloors }, (_, i) => i + 1);
  const basementFloorList = basementFloors > 0 ? Array.from({ length: basementFloors }, (_, i) => -(i + 1)) : [];
  const totalStrataCount = totalFloors + basementFloors;

  const isGBlockStyle = floorLabels && floorLabels[0] === 'G';

  const getFloorDisplayLabel = (floor: number | null): string => {
    if (floor === null) {
      return basementFloors > 0
        ? `All ${totalStrataCount} Strata (${basementFloors}B + ${totalFloors}F)`
        : `All ${totalFloors} Floors`;
    }
    if (floor === -1) return `B1 — ${basementUse} (-3.5m to 0.0m)`;
    if (floor < 0) return `Basement B${Math.abs(floor)}`;
    if (isGBlockStyle) {
      if (floor === 1) return 'G Ground Floor (+0.0m to +3.5m)';
      if (floor === 2) return 'F1 First Floor (+3.5m to +7.0m)';
      if (floor === 3) return 'F2 Second Floor (+7.0m to +10.5m)';
      if (floor === 4) return 'F3 Third Floor (+10.5m to +14.0m)';
      if (floor === 5) return 'F4 Fourth Floor (+14.0m to +17.5m)';
      return `Floor ${floorLabels?.[floor - 1] || floor}`;
    }
    if (floor === 1) return 'F1 Ground Floor (+0.0m to +3.5m)';
    if (floor === 2) return 'F2 First Floor (+3.5m to +7.0m)';
    if (floor === 3) return 'F3 Second Floor (+7.0m to +10.5m)';
    return `Floor F${floor}`;
  };

  return (
    <div className="floor-selector-panel">
      <div className="floor-selector-header">
        <div className="header-title-group">
          <Layers size={15} />
          <span>Floor Isolator</span>
        </div>
        
        {selectedFloor !== null && (
          <button
            type="button"
            className="reset-floor-btn"
            onClick={() => onSelectFloor(null)}
            title="Show All Building Strata (Basement + Above Ground)"
          >
            Show All ({totalStrataCount} Levels)
          </button>
        )}
      </div>

      {/* Slider Control */}
      <div className="slider-wrapper">
        <div className="slider-label-row">
          <span>Level Elevation</span>
          <span className="current-level-tag font-mono">
            {getFloorDisplayLabel(selectedFloor)}
          </span>
        </div>
        <input
          type="range"
          min={-basementFloors}
          max={totalFloors}
          value={selectedFloor !== null ? selectedFloor : 0}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            onSelectFloor(val === 0 ? null : val);
          }}
          className="floor-range-slider"
          aria-label="Floor selector slider"
        />
      </div>

      {/* Quick Floor Grid Pills */}
      <div className="floor-buttons-container">
        <div className="floor-buttons-header font-mono">
          <span>DIRECT STRATUM SELECT</span>
          <span>{totalStrataCount} TOTAL {basementFloors > 0 ? 'STRATA' : 'FLOORS'}</span>
        </div>
        <div className="floor-buttons-grid">
          <button
            type="button"
            className={`floor-pill ${selectedFloor === null ? 'active' : ''}`}
            onClick={() => onSelectFloor(null)}
            title="Show All Strata"
          >
            All
          </button>

          {/* Below-Ground Basement Pills */}
          {basementFloorList.map((bNum) => (
            <button
              key={`b-${bNum}`}
              type="button"
              className={`floor-pill basement-pill ${selectedFloor === bNum ? 'active' : ''}`}
              onClick={() => onSelectFloor(bNum)}
              title={bNum === -1 ? `B1 — ${basementUse}` : `Basement B${Math.abs(bNum)}`}
              style={selectedFloor === bNum ? { background: '#0D9488', color: '#ffffff', borderColor: '#2DD4BF' } : {}}
            >
              B{Math.abs(bNum)}
            </button>
          ))}

          {/* Above-Ground Floor Pills */}
          {aboveGroundFloors.map((floorNum) => {
            const pillLabel = isGBlockStyle
              ? (floorLabels?.[floorNum - 1] || `F${floorNum}`)
              : `F${floorNum}`;

            return (
              <button
                key={`f-${floorNum}`}
                type="button"
                className={`floor-pill ${selectedFloor === floorNum ? 'active' : ''}`}
                onClick={() => onSelectFloor(floorNum)}
                title={`Floor ${pillLabel}`}
              >
                {pillLabel}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

