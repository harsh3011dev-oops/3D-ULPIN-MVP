import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';

export type SectionState = 'hero' | 'how-it-works' | 'capabilities' | 'cta';

interface GlobalCadastralBackground3DProps {
  activeSection: SectionState;
  activeStepIndex?: number; // 0: Land, 1: Building, 2: Floor, 3: Unit, 4: ULPIN
}

interface SlabsProps {
  floorSeparation: number;
  highlightUnit: boolean;
  totalFloors?: number;
  targetFloor?: number;
}

function MainBuildingSlabs({
  floorSeparation,
  highlightUnit,
  totalFloors = 7,
  targetFloor = 4,
}: SlabsProps) {
  const slabHeight = 0.36;
  const baseSpacing = 0.42;

  return (
    <group position={[0, 0, 0]}>
      {Array.from({ length: totalFloors }).map((_, idx) => {
        const isTarget = idx === targetFloor;
        const yPos = idx * baseSpacing + idx * floorSeparation;

        const isUnitActive = isTarget && highlightUnit;
        const slabColor = isUnitActive
          ? '#0D9488'
          : idx % 2 === 0
          ? '#475569'
          : '#334155';

        const edgeColor = isUnitActive ? '#22D3EE' : '#94A3B8';

        return (
          <group key={idx} position={[0, yPos + slabHeight / 2, 0]}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={[3.0, slabHeight, 2.4]} />
              <meshStandardMaterial
                color={slabColor}
                roughness={0.35}
                metalness={0.15}
                emissive={isUnitActive ? '#083344' : '#000000'}
                emissiveIntensity={isUnitActive ? 0.8 : 0}
              />
            </mesh>

            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(3.0, slabHeight, 2.4)]} />
              <lineBasicMaterial color={edgeColor} linewidth={1.5} />
            </lineSegments>

            {/* Pinned ULPIN Tag on highlighted unit */}
            {isUnitActive && (
              <Html position={[1.8, 0.4, 1.3]} center distanceFactor={14}>
                <div className="bg-3d-ulpin-pin font-mono">
                  <div className="pin-dot" />
                  <div className="pin-tooltip">
                    <span className="pin-code">ULPIN: 07-286129-0772295-04-02</span>
                    <span className="pin-sub">Strata Level 04 · Certified</span>
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

function Scene({ activeSection, activeStepIndex = 0 }: GlobalCadastralBackground3DProps) {
  const sceneGroupRef = useRef<THREE.Group>(null);
  const targetCamPos = useRef(new THREE.Vector3(7.0, 6.2, 7.5));
  const targetLookAt = useRef(new THREE.Vector3(0, 1.2, 0));
  const currentLookAt = useRef(new THREE.Vector3(0, 1.2, 0));

  const targetSeparation = useRef(0);
  const currentSeparation = useRef(0);
  const targetHighlight = useRef(false);

  // Determine target camera and object states according to section / step
  if (activeSection === 'hero') {
    targetCamPos.current.set(7.5, 6.2, 8.0);
    targetLookAt.current.set(0, 1.4, 0);
    targetSeparation.current = 0.08;
    targetHighlight.current = false;
  } else if (activeSection === 'how-it-works') {
    // Stage-specific camera focus
    if (activeStepIndex === 0) {
      // LAND: Look down at parcel
      targetCamPos.current.set(4.5, 7.5, 5.0);
      targetLookAt.current.set(0, 0.2, 0);
      targetSeparation.current = 0;
      targetHighlight.current = false;
    } else if (activeStepIndex === 1) {
      // BUILDING: Extruded full volume
      targetCamPos.current.set(6.0, 4.5, 6.5);
      targetLookAt.current.set(0, 1.5, 0);
      targetSeparation.current = 0.02;
      targetHighlight.current = false;
    } else if (activeStepIndex === 2) {
      // FLOOR: Exploded strata
      targetCamPos.current.set(6.5, 5.5, 6.8);
      targetLookAt.current.set(0, 2.2, 0);
      targetSeparation.current = 0.38;
      targetHighlight.current = false;
    } else if (activeStepIndex === 3) {
      // UNIT: Highlight one unit
      targetCamPos.current.set(5.2, 4.2, 5.5);
      targetLookAt.current.set(0, 2.0, 0);
      targetSeparation.current = 0.42;
      targetHighlight.current = true;
    } else {
      // ULPIN: Minted key
      targetCamPos.current.set(5.8, 4.8, 6.0);
      targetLookAt.current.set(0, 2.0, 0);
      targetSeparation.current = 0.35;
      targetHighlight.current = true;
    }
  } else if (activeSection === 'capabilities') {
    // Angled side perspective focusing on strata & validation
    targetCamPos.current.set(-6.5, 5.2, 6.5);
    targetLookAt.current.set(0, 1.8, 0);
    targetSeparation.current = 0.25;
    targetHighlight.current = true;
  } else if (activeSection === 'cta') {
    // Wide cinematic pull-back
    targetCamPos.current.set(9.5, 8.5, 10.0);
    targetLookAt.current.set(0, 1.2, 0);
    targetSeparation.current = 0.04;
    targetHighlight.current = false;
  }

  // Smooth frame interpolation (Lerp)
  useFrame((state, delta) => {
    // Camera smooth lerp
    state.camera.position.lerp(targetCamPos.current, 2.8 * delta);
    currentLookAt.current.lerp(targetLookAt.current, 2.8 * delta);
    state.camera.lookAt(currentLookAt.current);

    // Floor separation smooth lerp
    currentSeparation.current += (targetSeparation.current - currentSeparation.current) * 3.5 * delta;

    // Continuous gentle building yaw rotation
    if (sceneGroupRef.current) {
      sceneGroupRef.current.rotation.y += delta * 0.12;
    }
  });

  // Surrounding Context Buildings
  const surroundingBuildings = useMemo(() => [
    { pos: [-4.2, 0, -2.8], size: [2.2, 2.4, 2.0], color: '#CBD5E1' },
    { pos: [4.0, 0, -2.6],  size: [2.4, 2.0, 2.2], color: '#CBD5E1' },
    { pos: [-4.0, 0, 3.2],  size: [2.0, 1.6, 2.4], color: '#CBD5E1' },
    { pos: [4.2, 0, 3.4],   size: [2.2, 3.0, 2.0], color: '#CBD5E1' },
    { pos: [0, 0, -5.2],    size: [4.2, 1.4, 1.8], color: '#E2E8F0' },
    { pos: [-5.6, 0, 0],    size: [1.8, 2.8, 3.2], color: '#E2E8F0' },
    { pos: [5.6, 0, 0],     size: [1.8, 2.2, 3.0], color: '#E2E8F0' },
  ], []);

  // Parcel boundary coordinates
  const parcelCorners = useMemo(() => [
    new THREE.Vector3(-1.8, 0.02, -1.5),
    new THREE.Vector3(1.8, 0.02, -1.5),
    new THREE.Vector3(1.8, 0.02, 1.5),
    new THREE.Vector3(-1.8, 0.02, 1.5),
    new THREE.Vector3(-1.8, 0.02, -1.5),
  ], []);

  return (
    <group ref={sceneGroupRef} position={[0, -0.8, 0]}>
      {/* CAD Ground Grid & Terrain */}
      <gridHelper args={[32, 32, '#CBD5E1', '#E2E8F0']} position={[0, 0, 0]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[32, 32]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.9} />
      </mesh>

      {/* Cadastral Parcel Outline (Teal) */}
      <Line
        points={parcelCorners}
        color="#0D9488"
        lineWidth={2.5}
      />

      {/* Parcel Corner Geodetic Pins */}
      {parcelCorners.slice(0, 4).map((pt, i) => (
        <mesh key={i} position={pt}>
          <cylinderGeometry args={[0.06, 0.06, 0.04, 16]} />
          <meshBasicMaterial color="#0D9488" />
        </mesh>
      ))}

      {/* Primary Focus Multi-Strata Building */}
      <MainBuildingSlabs
        floorSeparation={currentSeparation.current}
        highlightUnit={targetHighlight.current}
        totalFloors={7}
        targetFloor={4}
      />

      {/* Low-Poly Context City Block */}
      {surroundingBuildings.map((b, i) => (
        <group key={i} position={b.pos as [number, number, number]}>
          <mesh position={[0, b.size[1] / 2, 0]} receiveShadow castShadow>
            <boxGeometry args={b.size as [number, number, number]} />
            <meshStandardMaterial color={b.color} roughness={0.65} metalness={0.05} />
          </mesh>
          <lineSegments position={[0, b.size[1] / 2, 0]}>
            <edgesGeometry args={[new THREE.BoxGeometry(...(b.size as [number, number, number]))]} />
            <lineBasicMaterial color="#94A3B8" />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

export default function GlobalCadastralBackground3D({
  activeSection,
  activeStepIndex = 0,
}: GlobalCadastralBackground3DProps) {
  return (
    <div className="global-3d-background-layer" aria-hidden>
      <Canvas
        shadows
        camera={{ position: [7.5, 6.2, 8.0], fov: 42 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight
          position={[12, 16, 10]}
          intensity={1.15}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-8, 6, -6]} intensity={0.4} color="#64748B" />

        <Scene activeSection={activeSection} activeStepIndex={activeStepIndex} />
      </Canvas>
    </div>
  );
}
