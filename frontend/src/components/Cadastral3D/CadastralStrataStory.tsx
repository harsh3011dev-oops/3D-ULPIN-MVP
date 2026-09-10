import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';

interface CadastralStrataStoryProps {
  activeSection: string;
  activeStepIndex: number;
}

export default function CadastralStrataStory({
  activeSection,
  activeStepIndex,
}: CadastralStrataStoryProps) {
  const groupRef = useRef<THREE.Group>(null);
  const totalFloors = 6;
  const targetFloor = 3;

  // Track animated floor separation and building extrusion
  const targetSeparation = useRef(0);
  const currentSeparation = useRef(0);
  const targetExtrusion = useRef(1);
  const currentExtrusion = useRef(1);

  // Update target metrics based on current story step
  if (activeSection === 'how-it-works') {
    if (activeStepIndex === 0) {
      // LAND: Parcel outline flat on ground
      targetSeparation.current = 0;
      targetExtrusion.current = 0.08;
    } else if (activeStepIndex === 1) {
      // BUILDING: Extruded solid volume
      targetSeparation.current = 0.02;
      targetExtrusion.current = 1.0;
    } else if (activeStepIndex === 2) {
      // FLOOR: Exploded strata slabs
      targetSeparation.current = 0.42;
      targetExtrusion.current = 1.0;
    } else if (activeStepIndex === 3) {
      // UNIT: Highlighted unit in exploded stack
      targetSeparation.current = 0.45;
      targetExtrusion.current = 1.0;
    } else {
      // ULPIN: Minted key view
      targetSeparation.current = 0.38;
      targetExtrusion.current = 1.0;
    }
  } else {
    // Other sections: compact assembled building
    targetSeparation.current = 0.04;
    targetExtrusion.current = 1.0;
  }

  useFrame((_, delta) => {
    currentSeparation.current += (targetSeparation.current - currentSeparation.current) * 3.2 * delta;
    currentExtrusion.current += (targetExtrusion.current - currentExtrusion.current) * 3.2 * delta;
  });

  const parcelPoints = useMemo(() => [
    new THREE.Vector3(-1.6, 0.02, -1.3),
    new THREE.Vector3(1.6, 0.02, -1.3),
    new THREE.Vector3(1.6, 0.02, 1.3),
    new THREE.Vector3(-1.6, 0.02, 1.3),
    new THREE.Vector3(-1.6, 0.02, -1.3),
  ], []);

  const slabHeight = 0.32;
  const baseSpacing = 0.38;

  // Located at central India coordinates (~21°N, 78°E)
  return (
    <group ref={groupRef} position={[0.2, 0.4, 0.8]} scale={0.82}>
      {/* Geodetic Parcel Boundary Polygon */}
      <Line
        points={parcelPoints}
        color="#0D9488"
        lineWidth={3.0}
      />

      {/* Parcel Corner Pins */}
      {parcelPoints.slice(0, 4).map((pt, idx) => (
        <mesh key={idx} position={pt}>
          <cylinderGeometry args={[0.07, 0.07, 0.05, 16]} />
          <meshBasicMaterial color="#22D3EE" />
        </mesh>
      ))}

      {/* Slices of Multi-Strata Building */}
      {Array.from({ length: totalFloors }).map((_, idx) => {
        const isTarget = idx === targetFloor;
        const isUnitActive = isTarget && activeSection === 'how-it-works' && activeStepIndex >= 3;
        const yPos = (idx * baseSpacing + idx * currentSeparation.current) * currentExtrusion.current;

        const slabColor = isUnitActive
          ? '#0D9488'
          : idx % 2 === 0
          ? '#334155'
          : '#1E293B';

        const edgeColor = isUnitActive ? '#22D3EE' : '#64748B';

        return (
          <group key={idx} position={[0, yPos + slabHeight / 2, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[2.6, slabHeight * currentExtrusion.current, 2.0]} />
              <meshStandardMaterial
                color={slabColor}
                roughness={0.35}
                metalness={0.2}
                emissive={isUnitActive ? '#083344' : '#000000'}
                emissiveIntensity={isUnitActive ? 0.9 : 0}
              />
            </mesh>

            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(2.6, slabHeight * currentExtrusion.current, 2.0)]} />
              <lineBasicMaterial color={edgeColor} linewidth={1.5} />
            </lineSegments>

            {/* Persistent ULPIN Spatial Key on Highlighted Unit */}
            {isUnitActive && activeStepIndex >= 4 && (
              <Html position={[1.5, 0.35, 1.2]} center distanceFactor={14}>
                <div className="bg-3d-ulpin-pin font-mono">
                  <div className="pin-dot" />
                  <div className="pin-tooltip">
                    <span className="pin-code">3D ULPIN: 07-286129-0772295-03-01</span>
                    <span className="pin-sub">ISO 19152 LADM Strata Level 03</span>
                  </div>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
