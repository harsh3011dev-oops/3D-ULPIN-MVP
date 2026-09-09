import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line, Html } from '@react-three/drei';
import * as THREE from 'three';

interface BuildingSlabProps {
  index: number;
  totalFloors: number;
  separation: number;
  isTargetFloor: boolean;
  isTargetUnit: boolean;
}

function BuildingSlab({
  index,
  totalFloors,
  separation,
  isTargetFloor,
  isTargetUnit,
}: BuildingSlabProps) {
  const slabHeight = 0.35;
  const baseSpacing = 0.42;
  const yPos = index * baseSpacing + index * separation;

  // Colors: concrete/graphite for regular slabs, cyan for selected unit
  const slabColor = isTargetUnit
    ? '#0D9488'
    : isTargetFloor
    ? '#374151'
    : index % 2 === 0
    ? '#4B5563'
    : '#374151';

  const edgeColor = isTargetUnit ? '#5EEAD4' : '#9CA3AF';

  return (
    <group position={[0, yPos, 0]}>
      {/* Floor Slab Mesh */}
      <mesh position={[0, slabHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.8, slabHeight, 2.2]} />
        <meshStandardMaterial
          color={slabColor}
          roughness={0.4}
          metalness={0.15}
          emissive={isTargetUnit ? '#042F2E' : '#000000'}
        />
      </mesh>

      {/* Slab Structural Edges */}
      <lineSegments position={[0, slabHeight / 2, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(2.8, slabHeight, 2.2)]} />
        <lineBasicMaterial color={edgeColor} linewidth={1.5} />
      </lineSegments>

      {/* Target Property Unit Callout Pin */}
      {isTargetUnit && (
        <Html position={[1.5, 0.4, 1.2]} center distanceFactor={12}>
          <div className="cadastral-3d-pin">
            <div className="pin-pulse" />
            <div className="pin-card">
              <span className="pin-label">3D ULPIN UNIT #402</span>
              <span className="pin-code">ULPIN-DL-07-28.61-04-U02</span>
              <span className="pin-dim">Vol: 284 m³ · Level +4</span>
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

function HeroScene() {
  const groupRef = useRef<THREE.Group>(null);
  const [animTime, setAnimTime] = useState(0);

  // Animated cycle: Ground -> Extrude -> Explode floors -> Highlight unit -> Reassemble
  useFrame((_, delta) => {
    setAnimTime((prev) => (prev + delta * 0.45) % (Math.PI * 2));
  });

  // Cycle phase calculation
  // sin curve: 0 to 1
  const cycleVal = (Math.sin(animTime) + 1) / 2;
  const floorSeparation = cycleVal > 0.35 ? (cycleVal - 0.35) * 0.45 : 0;
  const isHighlighted = cycleVal > 0.45;

  const totalFloors = 7;
  const targetFloor = 4;

  // Surrounding Context Buildings (instanced-like positions for city block context)
  const surroundingBuildings = useMemo(() => [
    { pos: [-3.8, 0, -2.4], size: [2.0, 2.2, 1.8], color: '#E5E7EB' },
    { pos: [3.6, 0, -2.2],  size: [2.2, 1.8, 2.0], color: '#E5E7EB' },
    { pos: [-3.6, 0, 2.6],  size: [1.8, 1.4, 2.2], color: '#E5E7EB' },
    { pos: [3.8, 0, 2.8],   size: [2.0, 2.6, 1.8], color: '#E5E7EB' },
    { pos: [0, 0, -4.2],    size: [3.4, 1.2, 1.6], color: '#F3F4F6' },
  ], []);

  // Parcel boundary corners
  const parcelPoints = useMemo(() => [
    new THREE.Vector3(-1.7, 0.02, -1.4),
    new THREE.Vector3(1.7, 0.02, -1.4),
    new THREE.Vector3(1.7, 0.02, 1.4),
    new THREE.Vector3(-1.7, 0.02, 1.4),
    new THREE.Vector3(-1.7, 0.02, -1.4),
  ], []);

  return (
    <group ref={groupRef} position={[0, -1.2, 0]}>
      {/* CAD Ground Grid & Base Terrain */}
      <gridHelper args={[20, 20, '#D1D5DB', '#E5E7EB']} position={[0, 0, 0]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#FAFAF8" roughness={0.9} />
      </mesh>

      {/* Cadastral Parcel Outline (Teal / Cyan) */}
      <Line
        points={parcelPoints}
        color="#0D9488"
        lineWidth={2.5}
        dashed={false}
      />

      {/* Parcel Corner Markers */}
      {parcelPoints.slice(0, 4).map((pt, i) => (
        <mesh key={i} position={pt}>
          <cylinderGeometry args={[0.06, 0.06, 0.04, 16]} />
          <meshBasicMaterial color="#0D9488" />
        </mesh>
      ))}

      {/* Focus Cadastral Building: Multi-Strata Slabs */}
      <group position={[0, 0, 0]}>
        {Array.from({ length: totalFloors }).map((_, idx) => (
          <BuildingSlab
            key={idx}
            index={idx}
            totalFloors={totalFloors}
            separation={floorSeparation}
            isTargetFloor={idx === targetFloor}
            isTargetUnit={idx === targetFloor && isHighlighted}
          />
        ))}
      </group>

      {/* Surrounding Context Buildings */}
      {surroundingBuildings.map((b, i) => (
        <group key={i} position={b.pos as [number, number, number]}>
          <mesh position={[0, b.size[1] / 2, 0]} receiveShadow castShadow>
            <boxGeometry args={b.size as [number, number, number]} />
            <meshStandardMaterial color={b.color} roughness={0.7} metalness={0.05} />
          </mesh>
          <lineSegments position={[0, b.size[1] / 2, 0]}>
            <edgesGeometry args={[new THREE.BoxGeometry(...(b.size as [number, number, number]))]} />
            <lineBasicMaterial color="#D1D5DB" />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

export default function CadastralHero3D() {
  return (
    <div className="cadastral-hero-canvas-container">
      {/* Top Technical Metadata HUD */}
      <div className="hero-3d-hud">
        <div className="hud-badge">
          <span className="hud-dot" />
          <span>REAL-TIME 3D RECONSTRUCTION</span>
        </div>
        <div className="hud-coordinates font-mono">
          28.6129° N, 77.2295° E · LOD1 STRATA
        </div>
      </div>

      <Canvas
        shadows
        camera={{ position: [5.8, 5.2, 6.2], fov: 42 }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight
          position={[10, 15, 8]}
          intensity={1.1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0001}
        />
        <directionalLight position={[-8, 6, -5]} intensity={0.3} color="#94A3B8" />

        <HeroScene />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.8}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.3}
        />
      </Canvas>

      {/* Bottom Technical Scale Indicator */}
      <div className="hero-3d-footer-hud font-mono">
        <span>GRID: 1m² RESOLUTION</span>
        <span>VERTICAL ACCURACY: ±0.05m</span>
      </div>
    </div>
  );
}
