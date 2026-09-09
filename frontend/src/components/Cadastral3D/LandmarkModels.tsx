import React from 'react';
import Landmark3D from './Landmark3D';
import { HOMEPAGE_LANDMARKS, geoToGlobePosition, VisualLandmark } from '../../data/homepageVisualLocations';

interface LandmarkModelsProps {
  onSelectLandmark?: (landmark: VisualLandmark) => void;
  selectedLandmarkId?: string | null;
}

export default function LandmarkModels({
  onSelectLandmark,
  selectedLandmarkId,
}: LandmarkModelsProps) {
  const globeRadius = 6.8;

  return (
    <group>
      {HOMEPAGE_LANDMARKS.map((landmark) => {
        const [lx, ly, lz] = geoToGlobePosition(
          landmark.latitude,
          landmark.longitude,
          globeRadius + 0.08
        );

        return (
          <Landmark3D
            key={landmark.id}
            landmark={landmark}
            position={[lx, ly, lz]}
            scale={landmark.visualScale}
            isSelected={selectedLandmarkId === landmark.id}
            onSelect={onSelectLandmark}
          />
        );
      })}
    </group>
  );
}
