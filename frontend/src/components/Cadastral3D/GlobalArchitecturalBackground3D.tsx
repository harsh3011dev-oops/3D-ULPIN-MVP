import React, { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';

export type SectionState = 'hero' | 'how-it-works' | 'capabilities' | 'cta';

interface GlobalArchitecturalBackground3DProps {
  activeSection: SectionState;
  activeStepIndex?: number; // 0: Land, 1: Building, 2: Floor, 3: Unit, 4: ULPIN
}

/* ─────────────────────────────────────────────────────────────
   1. SURROUNDING LOW-POLY URBAN CONTEXT (Varied Footprints, Setbacks & Rooftops)
   ───────────────────────────────────────────────────────────── */

function CadastralContext({
  highlightParcel = false,
  highlightEnvelope = false,
}: {
  highlightParcel?: boolean;
  highlightEnvelope?: boolean;
}) {
  // Main Parcel Polygon around the skyscraper (center X ~ 5.4)
  const parcelPoints = useMemo<[number, number, number][]>(() => [
    [2.8, 0.02, -2.8],
    [8.4, 0.02, -2.8],
    [8.8, 0.02, 3.2],
    [3.2, 0.02, 3.4],
    [2.8, 0.02, -2.8],
  ], []);

  const cornerPins: [number, number, number][] = [
    [2.8, 0.04, -2.8],
    [8.4, 0.04, -2.8],
    [8.8, 0.04, 3.2],
    [3.2, 0.04, 3.4],
  ];

  // Surrounding skyline towers with varied footprints, setbacks, and rooftop geometry
  const urbanBuildings = useMemo(
    () => [
      // East Tower (Taller tower with 2-tier setback & roof box)
      {
        basePos: [11.8, 2.2, -2.2] as [number, number, number],
        baseSize: [2.6, 4.4, 2.4] as [number, number, number],
        midPos: [11.8, 4.8, -2.2] as [number, number, number],
        midSize: [2.0, 1.4, 1.8] as [number, number, number],
        roofPos: [11.8, 5.7, -2.2] as [number, number, number],
        roofSize: [1.2, 0.4, 1.2] as [number, number, number],
        color: '#1E293B',
        trim: '#334155',
      },
      // East Mid-Rise Block with Rooftop Garden Box
      {
        basePos: [12.4, 1.6, 2.4] as [number, number, number],
        baseSize: [2.4, 3.2, 2.6] as [number, number, number],
        midPos: [12.2, 3.4, 2.4] as [number, number, number],
        midSize: [1.6, 0.8, 1.8] as [number, number, number],
        color: '#263449',
        trim: '#475569',
      },
      // West Tower with stepped crown
      {
        basePos: [-1.6, 2.0, -2.2] as [number, number, number],
        baseSize: [2.6, 4.0, 2.4] as [number, number, number],
        midPos: [-1.6, 4.4, -2.2] as [number, number, number],
        midSize: [1.8, 1.2, 1.8] as [number, number, number],
        roofPos: [-1.6, 5.2, -2.2] as [number, number, number],
        roofSize: [1.1, 0.4, 1.1] as [number, number, number],
        color: '#1B2636',
        trim: '#334155',
      },
      // West Low-Rise Plaza Building
      {
        basePos: [-1.8, 1.4, 2.2] as [number, number, number],
        baseSize: [2.2, 2.8, 2.2] as [number, number, number],
        midPos: [-1.8, 3.0, 2.2] as [number, number, number],
        midSize: [1.4, 0.6, 1.4] as [number, number, number],
        color: '#223042',
        trim: '#3B4D63',
      },
      // North Distant High-Rise Complex
      {
        basePos: [5.8, 2.4, -6.4] as [number, number, number],
        baseSize: [3.4, 4.8, 2.6] as [number, number, number],
        midPos: [5.8, 5.2, -6.4] as [number, number, number],
        midSize: [2.4, 1.2, 1.8] as [number, number, number],
        roofPos: [5.8, 6.0, -6.4] as [number, number, number],
        roofSize: [1.4, 0.4, 1.2] as [number, number, number],
        color: '#1E293B',
        trim: '#475569',
      },
      // North-West Slender Corporate Tower
      {
        basePos: [1.6, 2.8, -6.0] as [number, number, number],
        baseSize: [2.4, 5.6, 2.2] as [number, number, number],
        midPos: [1.6, 6.0, -6.0] as [number, number, number],
        midSize: [1.6, 1.2, 1.5] as [number, number, number],
        roofPos: [1.6, 6.8, -6.0] as [number, number, number],
        roofSize: [1.0, 0.4, 1.0] as [number, number, number],
        color: '#162232',
        trim: '#2D3E54',
      },
    ],
    []
  );

  return (
    <group>
      {/* ── Ground Cadastral Grid ── */}
      <gridHelper
        args={[54, 54, '#0D9488', '#1E293B']}
        position={[5.4, 0, 0]}
      />

      {/* ── Dark Reflective Ground Plane ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[5.4, -0.01, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial
          color="#060A12"
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>

      {/* ── Main Cadastral Boundary Line ── */}
      <Line
        points={parcelPoints}
        color={highlightParcel ? '#22D3EE' : '#0D9488'}
        lineWidth={highlightParcel ? 3.6 : 2.4}
      />

      {/* ── Corner Geodetic Marker Pins ── */}
      {cornerPins.map((pin, i) => (
        <group key={i} position={pin}>
          <mesh>
            <cylinderGeometry args={[0.08, 0.08, 0.1, 16]} />
            <meshStandardMaterial
              color={highlightParcel ? '#22D3EE' : '#0D9488'}
              emissive={highlightParcel ? '#22D3EE' : '#0D9488'}
              emissiveIntensity={highlightParcel ? 1.5 : 0.6}
            />
          </mesh>
          {highlightParcel && (
            <mesh position={[0, 0.35, 0]}>
              <sphereGeometry args={[0.07, 12, 12]} />
              <meshBasicMaterial color="#22D3EE" />
            </mesh>
          )}
        </group>
      ))}

      {/* ── Volumetric Bounding Wireframe (Active during Envelope step) ── */}
      {highlightEnvelope && (
        <group position={[5.4, 2.7, 0.2]}>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(4.4, 5.4, 4.0)]} />
            <lineBasicMaterial color="#22D3EE" linewidth={2.2} transparent opacity={0.85} />
          </lineSegments>
        </group>
      )}

      {/* ── Refined Surrounding Skyline (Varied heights & setbacks) ── */}
      {urbanBuildings.map((b, idx) => (
        <group key={idx}>
          {/* Base volume */}
          <mesh position={b.basePos} castShadow receiveShadow>
            <boxGeometry args={b.baseSize} />
            <meshStandardMaterial
              color={b.color}
              roughness={0.3}
              metalness={0.7}
            />
          </mesh>
          <lineSegments position={b.basePos}>
            <edgesGeometry args={[new THREE.BoxGeometry(...b.baseSize)]} />
            <lineBasicMaterial color={b.trim} linewidth={1} />
          </lineSegments>

          {/* Setback mid tier */}
          {b.midPos && b.midSize && (
            <group>
              <mesh position={b.midPos} castShadow receiveShadow>
                <boxGeometry args={b.midSize} />
                <meshStandardMaterial
                  color={b.color}
                  roughness={0.25}
                  metalness={0.75}
                />
              </mesh>
              <lineSegments position={b.midPos}>
                <edgesGeometry args={[new THREE.BoxGeometry(...b.midSize)]} />
                <lineBasicMaterial color="#475569" linewidth={1} />
              </lineSegments>
            </group>
          )}

          {/* Rooftop mechanical enclosure */}
          {b.roofPos && b.roofSize && (
            <mesh position={b.roofPos} castShadow>
              <boxGeometry args={b.roofSize} />
              <meshStandardMaterial color={b.trim} roughness={0.3} metalness={0.8} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────
   2. REALISTIC MODERN GLASS SKYSCRAPER CENTERPIECE
   (Substantial volume, rich facade curtain wall, entrance canopy)
   ───────────────────────────────────────────────────────────── */

interface SkyscraperCenterpieceProps {
  floorSeparation: number;
  highlightUnit: boolean;
  highlightEnvelope: boolean;
  activeStepIndex: number;
  activeSection: SectionState;
}

function ModernGlassSkyscraper({
  floorSeparation,
  highlightUnit,
  highlightEnvelope,
  activeStepIndex,
  activeSection,
}: SkyscraperCenterpieceProps) {
  // Photorealistic Architectural Glass Material
  const curtainWallGlassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#152B44', // Rich architectural blue-slate glass
        emissive: '#0A1828',
        emissiveIntensity: 0.3,
        roughness: 0.1,
        metalness: 0.9,
        transparent: true,
        opacity: 0.92,
      }),
    []
  );

  // Polished Aluminum / Chrome Spandrel Trim
  const chromeSpandrelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#CBD5E1', // Polished metallic spandrels
        roughness: 0.18,
        metalness: 0.92,
      }),
    []
  );

  // Dark Slate Titanium Mullions
  const titaniumMullionMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#334155',
        roughness: 0.25,
        metalness: 0.85,
      }),
    []
  );

  // Architectural Stone Plinth & Canopy Trim
  const stoneAccentMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#E2E8F0',
        roughness: 0.28,
        metalness: 0.15,
      }),
    []
  );

  // Interior Services Core
  const illuminatedCoreMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#0D9488',
        emissive: '#14B8A6',
        emissiveIntensity: 0.5,
        roughness: 0.2,
        metalness: 0.6,
      }),
    []
  );

  // Active Certified Unit Material
  const activeUnitMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#06B6D4',
        emissive: '#0891B2',
        emissiveIntensity: 1.3,
        roughness: 0.05,
        metalness: 0.75,
        transparent: true,
        opacity: 0.95,
      }),
    []
  );

  // 6 discrete floor strata levels with substantial width/depth and architectural setbacks
  const floorLevels = useMemo(
    () => [
      {
        id: 0,
        name: 'Grand Entrance Lobby & Plaza',
        baseY: 0.42,
        height: 0.7,
        size: [3.6, 0.7, 3.2] as [number, number, number],
      },
      {
        id: 1,
        name: 'Lower Commercial Strata',
        baseY: 1.15,
        height: 0.65,
        size: [3.4, 0.65, 3.0] as [number, number, number],
        wingOffset: [1.4, 0, 0] as [number, number, number],
        wingSize: [1.0, 0.5, 1.8] as [number, number, number],
      },
      {
        id: 2,
        name: 'Mid-Rise Financial Suite',
        baseY: 1.85,
        height: 0.65,
        size: [3.2, 0.65, 2.8] as [number, number, number],
        hasSkyTerrace: true,
      },
      {
        id: 3,
        name: 'Certified Sky-Villa Unit 04',
        baseY: 2.55,
        height: 0.65,
        size: [3.0, 0.65, 2.6] as [number, number, number],
        isTargetUnit: true,
      },
      {
        id: 4,
        name: 'Executive Tech Suites',
        baseY: 3.25,
        height: 0.65,
        size: [2.8, 0.65, 2.4] as [number, number, number],
      },
      {
        id: 5,
        name: 'Sky Lounge Penthouse',
        baseY: 3.95,
        height: 0.65,
        size: [2.6, 0.65, 2.2] as [number, number, number],
      },
    ],
    []
  );

  return (
    <group position={[5.4, 0, 0]} scale={[0.84, 0.84, 0.84]}>
      {/* ── 1. GRAND PODIUM & ENTRANCE PLINTH ── */}
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.6, 0.12, 4.0]} />
        <primitive object={chromeSpandrelMat} attach="material" />
      </mesh>
      <lineSegments position={[0, 0.06, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(4.6, 0.12, 4.0)]} />
        <lineBasicMaterial color="#0D9488" linewidth={1.5} />
      </lineSegments>

      {/* Recessed Ground Lobby Pillars */}
      <group position={[0, 0.42, 1.7]}>
        {[-1.6, -0.8, 0, 0.8, 1.6].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]} castShadow>
            <cylinderGeometry args={[0.045, 0.045, 0.68, 12]} />
            <primitive object={titaniumMullionMat} attach="material" />
          </mesh>
        ))}
      </group>

      {/* Cantilevered Entrance Portico / Canopy */}
      <mesh position={[0, 0.8, 2.0]} castShadow>
        <boxGeometry args={[2.4, 0.08, 1.0]} />
        <primitive object={stoneAccentMat} attach="material" />
      </mesh>

      {/* ── 2. CENTRAL ELEVATOR & STRUCTURAL CORE ── */}
      <mesh position={[0, 2.6 + floorSeparation * 2.5, 0]}>
        <boxGeometry args={[1.1, 5.2 + floorSeparation * 5, 1.1]} />
        <primitive object={illuminatedCoreMat} attach="material" />
      </mesh>

      {/* Diagrid Exterior Corner Mullions */}
      <group position={[0, 2.6 + floorSeparation * 2.5, 0]}>
        {[-1.6, 1.6].map((cx, i) =>
          [-1.4, 1.4].map((cz, j) => (
            <mesh key={`${i}-${j}`} position={[cx, 0, cz]}>
              <boxGeometry args={[0.06, 5.2 + floorSeparation * 5, 0.06]} />
              <primitive object={chromeSpandrelMat} attach="material" />
            </mesh>
          ))
        )}
      </group>

      {/* ── 3. SKYSCRAPER GLASS CURTAIN WALL FLOOR STRATA ── */}
      {floorLevels.map((lvl, idx) => {
        const yPos = lvl.baseY + idx * floorSeparation;
        const isTarget = lvl.isTargetUnit && highlightUnit;
        const isFloorStep = activeStepIndex === 2;

        return (
          <group key={lvl.id} position={[0, yPos, 0]}>
            {/* Main Glass Curtain Wall Floor Volume */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={lvl.size} />
              <primitive
                object={isTarget ? activeUnitMat : curtainWallGlassMat}
                attach="material"
              />
            </mesh>

            {/* Precision Aluminum Mullion Edges */}
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(...lvl.size)]} />
              <lineBasicMaterial
                color={isTarget ? '#22D3EE' : isFloorStep ? '#14B8A6' : '#94A3B8'}
                linewidth={isTarget ? 2 : 1}
              />
            </lineSegments>

            {/* Horizontal Chrome Floor Spandrel Band */}
            <mesh position={[0, -lvl.height / 2 + 0.04, 0]}>
              <boxGeometry args={[lvl.size[0] * 1.01, 0.08, lvl.size[2] * 1.01]} />
              <primitive object={chromeSpandrelMat} attach="material" />
            </mesh>

            {/* Vertical Facade Window Mullions */}
            <group position={[0, 0, lvl.size[2] / 2 + 0.01]}>
              {[-1.0, -0.35, 0.35, 1.0].map((mx, mi) => (
                <mesh key={mi} position={[mx, 0, 0]}>
                  <boxGeometry args={[0.025, lvl.height * 0.88, 0.02]} />
                  <primitive object={titaniumMullionMat} attach="material" />
                </mesh>
              ))}
            </group>

            {/* Cantilevered Sky-Terrace Wing */}
            {lvl.wingSize && lvl.wingOffset && (
              <group position={lvl.wingOffset}>
                <mesh castShadow receiveShadow>
                  <boxGeometry args={lvl.wingSize} />
                  <primitive object={curtainWallGlassMat} attach="material" />
                </mesh>
                <lineSegments>
                  <edgesGeometry args={[new THREE.BoxGeometry(...lvl.wingSize)]} />
                  <lineBasicMaterial color="#38BDF8" />
                </lineSegments>
                <mesh position={[0, -lvl.wingSize[1] / 2 + 0.03, 0]}>
                  <boxGeometry args={[lvl.wingSize[0] * 1.02, 0.06, lvl.wingSize[2] * 1.02]} />
                  <primitive object={chromeSpandrelMat} attach="material" />
                </mesh>
              </group>
            )}

            {/* Sky Garden Balcony */}
            {lvl.hasSkyTerrace && (
              <group position={[-lvl.size[0] / 2 - 0.35, 0, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[0.7, 0.06, 1.4]} />
                  <primitive object={chromeSpandrelMat} attach="material" />
                </mesh>
                <mesh position={[0, 0.14, 0]}>
                  <boxGeometry args={[0.65, 0.2, 1.35]} />
                  <primitive object={curtainWallGlassMat} attach="material" />
                </mesh>
              </group>
            )}

            {/* Certified 3D ULPIN Pinned Annotation (Active in How It Works steps) */}
            {isTarget && activeSection === 'how-it-works' && (
              <Html
                position={[lvl.size[0] / 2 + 0.6, 0.15, lvl.size[2] / 2]}
                center
                distanceFactor={10}
              >
                <div className="bg-3d-ulpin-pin font-mono">
                  <div className="pin-dot" />
                  <div className="pin-tooltip">
                    <span className="pin-code">ULPIN: 07-286129-0772295-04-01</span>
                    <span className="pin-sub">Strata Penthouse Unit · 210.5 m³ Certified</span>
                  </div>
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* ── 4. ARCHITECTURAL ROOF MECHANICAL PENTHOUSE & CROWN ── */}
      <group position={[0, 4.6 + floorLevels.length * floorSeparation, 0]}>
        {/* Setback Glass Penthouse */}
        <mesh position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[1.9, 0.5, 1.6]} />
          <primitive object={curtainWallGlassMat} attach="material" />
        </mesh>
        <lineSegments position={[0, 0.25, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(1.9, 0.5, 1.6)]} />
          <lineBasicMaterial color="#22D3EE" linewidth={1.5} />
        </lineSegments>

        {/* Crown Canopy Trellis */}
        <mesh position={[0, 0.52, 0]}>
          <cylinderGeometry args={[1.1, 1.1, 0.06, 24]} />
          <primitive object={chromeSpandrelMat} attach="material" />
        </mesh>

        {/* Mechanical Rooftop Enclosure */}
        <mesh position={[0, 0.72, 0]} castShadow>
          <boxGeometry args={[1.0, 0.35, 0.9]} />
          <primitive object={titaniumMullionMat} attach="material" />
        </mesh>

        {/* Architectural Spire Mast */}
        <mesh position={[0, 1.25, 0]} castShadow>
          <cylinderGeometry args={[0.015, 0.04, 1.0, 12]} />
          <primitive object={chromeSpandrelMat} attach="material" />
        </mesh>

        {/* Pulsing Cyan Geodetic Spatial Beacon */}
        <mesh position={[0, 1.78, 0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshBasicMaterial color="#22D3EE" />
        </mesh>
      </group>
    </group>
  );
}

/* ─────────────────────────────────────────────────────────────
   3. CURSOR PARALLAX & CAMERA CONTROLLER
   - Smooth 2–5° visual view angle
   - Fog integration and responsive framing
   ───────────────────────────────────────────────────────────── */

function SceneController({
  activeSection,
  activeStepIndex = 0,
}: GlobalArchitecturalBackground3DProps) {
  const { camera, size } = useThree();
  const skyscraperGroupRef = useRef<THREE.Group>(null);

  // Mouse normalized coordinates [-1, 1]
  const mouseRef = useRef({ x: 0, y: 0 });

  // Camera target coordinates (Framing the skyscraper on the right half with headroom)
  const targetCamPos = useRef(new THREE.Vector3(1.6, 2.4, 10.4));
  const targetLookAt = useRef(new THREE.Vector3(3.4, 2.0, 0));
  const currentLookAt = useRef(new THREE.Vector3(3.4, 2.0, 0));

  // Floor separation and highlights
  const targetSeparation = useRef(0);
  const currentSeparation = useRef(0);
  const targetHighlight = useRef(false);
  const targetParcelHighlight = useRef(false);
  const targetEnvelopeHighlight = useRef(false);

  // Attach pointermove listener to window
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      mouseRef.current.x = nx;
      mouseRef.current.y = ny;
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, []);

  // Update target camera positions according to activeSection and activeStepIndex
  useEffect(() => {
    const aspect = size.width / (size.height || 1);
    const isMobile = aspect < 1.0;
    const isTablet = aspect >= 1.0 && aspect < 1.45;

    // Reset highlights
    targetHighlight.current = false;
    targetParcelHighlight.current = false;
    targetEnvelopeHighlight.current = false;
    targetSeparation.current = 0.02;

    if (activeSection === 'hero') {
      // Hero Framing at 100% Zoom: Skyscraper clearly framed in the RIGHT 50%
      if (isMobile) {
        targetCamPos.current.set(5.4, 2.8, 12.0);
        targetLookAt.current.set(5.4, 2.0, 0);
      } else if (isTablet) {
        targetCamPos.current.set(3.6, 2.6, 11.2);
        targetLookAt.current.set(4.6, 2.0, 0);
      } else {
        // Desktop 100% zoom: Perfect framing showing full tower with headroom below navbar
        targetCamPos.current.set(1.6, 2.4, 10.4);
        targetLookAt.current.set(3.4, 2.0, 0);
      }
    } else if (activeSection === 'how-it-works') {
      // Closer architectural analysis sequence
      if (activeStepIndex === 0) {
        // LAND: High-angle view focusing on ground parcel
        targetCamPos.current.set(3.8, 4.2, 8.0);
        targetLookAt.current.set(5.2, 0.6, 0);
        targetParcelHighlight.current = true;
      } else if (activeStepIndex === 1) {
        // BUILDING: Volumetric envelope wireframe
        targetCamPos.current.set(3.4, 2.8, 8.2);
        targetLookAt.current.set(5.4, 2.4, 0);
        targetEnvelopeHighlight.current = true;
      } else if (activeStepIndex === 2) {
        // FLOOR: Exploded strata slabs separation
        targetCamPos.current.set(3.2, 3.0, 8.6);
        targetLookAt.current.set(5.4, 2.6, 0);
        targetSeparation.current = 0.28; // Slices strata levels vertically
      } else if (activeStepIndex === 3) {
        // UNIT: Isolated unit highlight
        targetCamPos.current.set(3.4, 2.8, 7.6);
        targetLookAt.current.set(5.5, 2.5, 0);
        targetSeparation.current = 0.18;
        targetHighlight.current = true;
      } else if (activeStepIndex === 4) {
        // 3D ULPIN: Certified spatial key
        targetCamPos.current.set(3.6, 2.9, 7.8);
        targetLookAt.current.set(5.5, 2.5, 0);
        targetSeparation.current = 0.12;
        targetHighlight.current = true;
      }
    } else if (activeSection === 'capabilities') {
      targetCamPos.current.set(2.6, 3.3, 9.8);
      targetLookAt.current.set(4.8, 2.1, 0);
      targetSeparation.current = 0.02;
    } else if (activeSection === 'cta') {
      targetCamPos.current.set(2.0, 2.8, 11.8);
      targetLookAt.current.set(4.2, 2.1, 0);
      targetSeparation.current = 0.02;
    }
  }, [activeSection, activeStepIndex, size]);

  // Frame-by-frame animation loop (Restrained 2–5° look-around parallax + idle drift)
  useFrame((state, delta) => {
    const clockTime = state.clock.getElapsedTime();

    // 1. Damped floor separation interpolation
    currentSeparation.current = THREE.MathUtils.lerp(
      currentSeparation.current,
      targetSeparation.current,
      delta * 5.0
    );

    // 2. Controlled subtle cursor parallax (2–5° view angle change)
    const mouseX = mouseRef.current.x;
    const mouseY = mouseRef.current.y;

    const parallaxCamX = targetCamPos.current.x + mouseX * 0.25;
    const parallaxCamY = targetCamPos.current.y - mouseY * 0.18;
    const parallaxCamZ = targetCamPos.current.z + Math.abs(mouseX) * 0.08;

    // 3. Subtle idle sinusoidal camera drift
    const idleOffsetX = Math.sin(clockTime * 0.25) * 0.08;
    const idleOffsetY = Math.cos(clockTime * 0.2) * 0.05;

    // 4. Smooth Camera Lerp
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      parallaxCamX + idleOffsetX,
      delta * 3.5
    );
    camera.position.y = THREE.MathUtils.lerp(
      camera.position.y,
      parallaxCamY + idleOffsetY,
      delta * 3.5
    );
    camera.position.z = THREE.MathUtils.lerp(
      camera.position.z,
      parallaxCamZ,
      delta * 3.5
    );

    // 5. LookAt Target Lerp
    currentLookAt.current.lerp(targetLookAt.current, delta * 3.5);
    camera.lookAt(currentLookAt.current);

    // 6. Subtle Skyscraper Rotation (Restrained 2–3° rotation)
    if (skyscraperGroupRef.current) {
      const targetRotY = mouseX * 0.04 + Math.sin(clockTime * 0.15) * 0.02;
      const targetRotX = mouseY * 0.015;

      skyscraperGroupRef.current.rotation.y = THREE.MathUtils.lerp(
        skyscraperGroupRef.current.rotation.y,
        targetRotY,
        delta * 3.0
      );
      skyscraperGroupRef.current.rotation.x = THREE.MathUtils.lerp(
        skyscraperGroupRef.current.rotation.x,
        targetRotX,
        delta * 3.0
      );
    }
  });

  return (
    <>
      {/* ── ATMOSPHERIC FOG & BACKGROUND ── */}
      <color attach="background" args={['#080E1A']} />
      <fog attach="fog" args={['#080E1A', 12, 38]} />

      {/* ── CINEMATIC ARCHITECTURAL LIGHTING ── */}
      <ambientLight intensity={0.75} color="#E2E8F0" />

      {/* Primary Key Architectural Sun Light */}
      <directionalLight
        position={[16, 22, 14]}
        intensity={1.65}
        color="#FFFBEB"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={38}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />

      {/* Sky Blue Reflection Fill Light */}
      <directionalLight
        position={[-12, 12, -8]}
        intensity={0.85}
        color="#93C5FD"
      />

      {/* Cadastral Cyan Ground Bounce */}
      <directionalLight
        position={[5, -4, 6]}
        intensity={0.4}
        color="#14B8A6"
      />

      {/* ── 3D SCENE CONTENT ── */}
      <group ref={skyscraperGroupRef}>
        {/* Cadastral context & refined background towers */}
        <CadastralContext
          highlightParcel={targetParcelHighlight.current}
          highlightEnvelope={targetEnvelopeHighlight.current}
        />

        {/* The Realistic Modern Glass Skyscraper */}
        <ModernGlassSkyscraper
          floorSeparation={currentSeparation.current}
          highlightUnit={targetHighlight.current}
          highlightEnvelope={targetEnvelopeHighlight.current}
          activeStepIndex={activeStepIndex}
          activeSection={activeSection}
        />
      </group>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   4. EXPORTED PERSISTENT BACKGROUND CANVAS
   ───────────────────────────────────────────────────────────── */

export default function GlobalArchitecturalBackground3D({
  activeSection,
  activeStepIndex = 0,
}: GlobalArchitecturalBackground3DProps) {
  return (
    <div className="global-3d-background-layer">
      <Canvas
        camera={{
          fov: 38,
          position: [1.6, 2.4, 10.4],
          near: 0.1,
          far: 60,
        }}
        gl={{
          antialias: true,
          alpha: false, // Solid atmospheric fog integration
          powerPreference: 'high-performance',
        }}
        dpr={[1, 1.75]}
      >
        <SceneController
          activeSection={activeSection}
          activeStepIndex={activeStepIndex}
        />
      </Canvas>
    </div>
  );
}
