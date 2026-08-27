import React from 'react';
import MapDeckGL from './MapDeckGL';
import { Building, Unit } from '../../types';

interface Map3DProps {
  building: Building;
  selectedUnit: Unit | null;
  onUnitClick: (unit: Unit) => void;
  selectedFloor: number | null;
}

export default function Map3D({ building, selectedUnit, onUnitClick, selectedFloor }: Map3DProps) {
  return (
    <MapDeckGL
      building={building}
      selectedUnit={selectedUnit}
      onUnitClick={onUnitClick}
      selectedFloor={selectedFloor}
    />
  );
}
