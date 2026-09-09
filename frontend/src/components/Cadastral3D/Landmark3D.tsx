import React, { useState, useEffect, useMemo } from 'react';
import { Html, useGLTF } from '@react-three/drei';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { VisualLandmark } from '../../data/homepageVisualLocations';

interface Landmark3DProps {
  landmark: VisualLandmark;
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  isSelected?: boolean;
  onSelect?: (landmark: VisualLandmark) => void;
}

// ── 1. TAJ MAHAL PROCEDURAL 3D ARCHITECTURAL MESH ──
function ProceduralTajMahal({ isHovered }: { isHovered: boolean }) {
  const marbleColor = isHovered ? '#FFFFFF' : '#F1F5F9';
  const edgeColor = isHovered ? '#22D3EE' : '#94A3B8';
  const accentGold = isHovered ? '#FDE047' : '#D97706';

  return (
    <group scale={1.0}>
      {/* Marble Plinth Platform */}
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.12, 1.5]} />
        <meshStandardMaterial color={marbleColor} roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Main Sanctuary Mass with Chamfered Corners */}
      <mesh position={[0, 0.52, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.92, 0.8, 0.92]} />
        <meshStandardMaterial color={marbleColor} roughness={0.25} metalness={0.15} />
      </mesh>

      {/* Central Iwan / Portal Niches */}
      {[[0, 0.46], [0, -0.46], [0.46, 0], [-0.46, 0]].map(([px, pz], i) => (
        <mesh
          key={i}
          position={[px, 0.5, pz]}
          rotation={[0, px !== 0 ? Math.PI / 2 : 0, 0]}
        >
          <boxGeometry args={[0.42, 0.55, 0.04]} />
          <meshStandardMaterial color="#334155" roughness={0.6} />
        </mesh>
      ))}

      {/* Bulbous Onion Dome */}
      <mesh position={[0, 1.15, 0]} castShadow>
        <sphereGeometry args={[0.42, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color={marbleColor} roughness={0.2} metalness={0.25} />
      </mesh>

      {/* Dome Gilded Kalasa Finial Spire */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.02, 0.045, 0.35, 12]} />
        <meshBasicMaterial color={accentGold} />
      </mesh>

      {/* 4 Corner Minarets */}
      {[[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]].map(([mx, mz], i) => (
        <group key={i} position={[mx, 0.7, mz]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.055, 0.075, 1.28, 12]} />
            <meshStandardMaterial color={marbleColor} roughness={0.35} />
          </mesh>
          {/* Minaret Chhatri Top */}
          <mesh position={[0, 0.68, 0]}>
            <sphereGeometry args={[0.075, 12, 12]} />
            <meshStandardMaterial color={edgeColor} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── 2. INDIA GATE PROCEDURAL 3D ARCHITECTURAL MESH ──
function ProceduralIndiaGate({ isHovered }: { isHovered: boolean }) {
  const sandstone = isHovered ? '#FDE68A' : '#D97706';
  const darkStone = isHovered ? '#F59E0B' : '#92400E';

  return (
    <group scale={1.05}>
      {/* Left Pylon Pillar */}
      <mesh position={[-0.38, 0.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 1.3, 0.5]} />
        <meshStandardMaterial color={darkStone} roughness={0.65} />
      </mesh>

      {/* Right Pylon Pillar */}
      <mesh position={[0.38, 0.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 1.3, 0.5]} />
        <meshStandardMaterial color={darkStone} roughness={0.65} />
      </mesh>

      {/* Arch Crown Beam */}
      <mesh position={[0, 1.45, 0]} castShadow>
        <boxGeometry args={[1.15, 0.38, 0.54]} />
        <meshStandardMaterial color={sandstone} roughness={0.55} />
      </mesh>

      {/* Stepped Attic Parapet */}
      <mesh position={[0, 1.74, 0]}>
        <boxGeometry args={[0.82, 0.2, 0.44]} />
        <meshStandardMaterial color={darkStone} roughness={0.6} />
      </mesh>

      {/* Top Cenotaph Bowl */}
      <mesh position={[0, 1.88, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.08, 16]} />
        <meshStandardMaterial color={isHovered ? '#22D3EE' : '#B45309'} />
      </mesh>
    </group>
  );
}

// ── 3. RED FORT PROCEDURAL 3D ARCHITECTURAL MESH ──
function ProceduralRedFort({ isHovered }: { isHovered: boolean }) {
  const redSandstone = isHovered ? '#F87171' : '#B91C1C';
  const marbleChhatri = isHovered ? '#FFFFFF' : '#E2E8F0';

  return (
    <group scale={0.95}>
      {/* Fortified Perimeter Curtain Wall */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.8, 0.7]} />
        <meshStandardMaterial color={redSandstone} roughness={0.7} />
      </mesh>

      {/* Left Octagonal Bastion Tower */}
      <mesh position={[-0.75, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.26, 1.2, 8]} />
        <meshStandardMaterial color={redSandstone} roughness={0.7} />
      </mesh>
      {/* Left Chhatri Dome */}
      <mesh position={[-0.75, 1.3, 0]}>
        <sphereGeometry args={[0.16, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color={marbleChhatri} />
      </mesh>

      {/* Right Octagonal Bastion Tower */}
      <mesh position={[0.75, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.26, 1.2, 8]} />
        <meshStandardMaterial color={redSandstone} roughness={0.7} />
      </mesh>
      {/* Right Chhatri Dome */}
      <mesh position={[0.75, 1.3, 0]}>
        <sphereGeometry args={[0.16, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
        <meshStandardMaterial color={marbleChhatri} />
      </mesh>

      {/* Central Lahore Gate Arch Portal */}
      <mesh position={[0, 0.35, 0.36]}>
        <boxGeometry args={[0.42, 0.6, 0.06]} />
        <meshStandardMaterial color="#0F172A" />
      </mesh>

      {/* Central Crest Chhatris */}
      <mesh position={[0, 1.02, 0]}>
        <boxGeometry args={[0.6, 0.22, 0.4]} />
        <meshStandardMaterial color={redSandstone} />
      </mesh>
      <mesh position={[0, 1.22, 0]}>
        <sphereGeometry args={[0.14, 12, 12]} />
        <meshStandardMaterial color={marbleChhatri} />
      </mesh>
    </group>
  );
}

// ── 4. QUTUB MINAR PROCEDURAL 3D ARCHITECTURAL MESH ──
function ProceduralQutubMinar({ isHovered }: { isHovered: boolean }) {
  const minarRed = isHovered ? '#FCA5A5' : '#991B1B';
  const balconyGold = isHovered ? '#FDE047' : '#D97706';

  return (
    <group scale={1.15}>
      {/* Base Octagonal Plinth */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.32, 0.3, 8]} />
        <meshStandardMaterial color={minarRed} roughness={0.75} />
      </mesh>

      {/* Story 1 (Fluted Column) */}
      <mesh position={[0, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.21, 0.26, 0.7, 16]} />
        <meshStandardMaterial color={minarRed} roughness={0.7} />
      </mesh>
      {/* Balcony 1 */}
      <mesh position={[0, 1.04, 0]}>
        <cylinderGeometry args={[0.25, 0.21, 0.08, 16]} />
        <meshBasicMaterial color={balconyGold} />
      </mesh>

      {/* Story 2 */}
      <mesh position={[0, 1.45, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.21, 0.74, 16]} />
        <meshStandardMaterial color={minarRed} roughness={0.7} />
      </mesh>
      {/* Balcony 2 */}
      <mesh position={[0, 1.86, 0]}>
        <cylinderGeometry args={[0.19, 0.16, 0.07, 16]} />
        <meshBasicMaterial color={balconyGold} />
      </mesh>

      {/* Story 3 (White Marble & Sandstone) */}
      <mesh position={[0, 2.2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.16, 0.6, 16]} />
        <meshStandardMaterial color={isHovered ? '#FFFFFF' : '#E2E8F0'} roughness={0.4} />
      </mesh>

      {/* Top Lantern Spire */}
      <mesh position={[0, 2.6, 0]}>
        <cylinderGeometry args={[0.03, 0.11, 0.22, 12]} />
        <meshStandardMaterial color={minarRed} />
      </mesh>
    </group>
  );
}

// ── 5. GATEWAY OF INDIA PROCEDURAL 3D ARCHITECTURAL MESH ──
function ProceduralGatewayOfIndia({ isHovered }: { isHovered: boolean }) {
  const basaltYellow = isHovered ? '#FEF08A' : '#CA8A04';
  const stoneBase = isHovered ? '#FDE047' : '#A16207';

  return (
    <group scale={0.98}>
      {/* Left Tower Pier */}
      <mesh position={[-0.45, 0.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.34, 1.3, 0.55]} />
        <meshStandardMaterial color={stoneBase} roughness={0.6} />
      </mesh>

      {/* Right Tower Pier */}
      <mesh position={[0.45, 0.65, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.34, 1.3, 0.55]} />
        <meshStandardMaterial color={stoneBase} roughness={0.6} />
      </mesh>

      {/* Central Grand Arch Portal Spanning */}
      <mesh position={[0, 1.4, 0]} castShadow>
        <boxGeometry args={[1.3, 0.38, 0.6]} />
        <meshStandardMaterial color={basaltYellow} roughness={0.55} />
      </mesh>

      {/* Central Central Dome */}
      <mesh position={[0, 1.72, 0]}>
        <sphereGeometry args={[0.28, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
        <meshStandardMaterial color={stoneBase} roughness={0.5} />
      </mesh>

      {/* 4 Corner Spires */}
      {[[-0.55, -0.22], [0.55, -0.22], [-0.55, 0.22], [0.55, 0.22]].map(([sx, sz], i) => (
        <mesh key={i} position={[sx, 1.6, sz]}>
          <coneGeometry args={[0.07, 0.4, 8]} />
          <meshBasicMaterial color={isHovered ? '#22D3EE' : '#78350F'} />
        </mesh>
      ))}
    </group>
  );
}

// ── 6. GOLDEN TEMPLE (HARMANDIR SAHIB) PROCEDURAL 3D MESH ──
function ProceduralGoldenTemple({ isHovered }: { isHovered: boolean }) {
  const goldColor = isHovered ? '#FEF08A' : '#EAB308';
  const poolColor = isHovered ? '#22D3EE' : '#0D9488';

  return (
    <group scale={0.92}>
      {/* Amrit Sarovar Water Reflection Plinth */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[1.6, 0.08, 1.6]} />
        <meshStandardMaterial color={poolColor} roughness={0.1} metalness={0.6} />
      </mesh>

      {/* Marble Causeway Approach */}
      <mesh position={[0, 0.09, 0.5]}>
        <boxGeometry args={[0.22, 0.05, 0.7]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.3} />
      </mesh>

      {/* Lower Story (White Marble) */}
      <mesh position={[0, 0.32, 0]} castShadow>
        <boxGeometry args={[0.85, 0.45, 0.85]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.3} />
      </mesh>

      {/* Upper Story (Gold Plated) */}
      <mesh position={[0, 0.72, 0]} castShadow>
        <boxGeometry args={[0.75, 0.38, 0.75]} />
        <meshStandardMaterial color={goldColor} roughness={0.2} metalness={0.7} />
      </mesh>

      {/* Central Gilded Dome */}
      <mesh position={[0, 1.05, 0]}>
        <sphereGeometry args={[0.26, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color={goldColor} roughness={0.15} metalness={0.8} />
      </mesh>

      {/* 4 Corner Gilded Chhatris */}
      {[[-0.32, -0.32], [0.32, -0.32], [-0.32, 0.32], [0.32, 0.32]].map(([cx, cz], i) => (
        <mesh key={i} position={[cx, 0.96, cz]}>
          <sphereGeometry args={[0.065, 8, 8]} />
          <meshStandardMaterial color={goldColor} metalness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// ── 7. CHARMINAR PROCEDURAL 3D ARCHITECTURAL MESH ──
function ProceduralCharminar({ isHovered }: { isHovered: boolean }) {
  const graniteColor = isHovered ? '#E2E8F0' : '#94A3B8';
  const minaretTop = isHovered ? '#22D3EE' : '#0D9488';

  return (
    <group scale={0.96}>
      {/* Square Arcade Base with 4 Grand Arches */}
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.95, 0.9, 0.95]} />
        <meshStandardMaterial color={graniteColor} roughness={0.6} />
      </mesh>

      {/* Arch Cavities */}
      {[[0, 0.48], [0, -0.48], [0.48, 0], [-0.48, 0]].map(([ax, az], i) => (
        <mesh key={i} position={[ax, 0.48, az]} rotation={[0, ax !== 0 ? Math.PI / 2 : 0, 0]}>
          <boxGeometry args={[0.48, 0.65, 0.05]} />
          <meshStandardMaterial color="#0F172A" />
        </mesh>
      ))}

      {/* 4 Soaring Corner Minarets (4 Tiers Each) */}
      {[[-0.48, -0.48], [0.48, -0.48], [-0.48, 0.48], [0.48, 0.48]].map(([mx, mz], i) => (
        <group key={i} position={[mx, 0.95, mz]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.075, 0.095, 1.6, 12]} />
            <meshStandardMaterial color={graniteColor} roughness={0.5} />
          </mesh>
          {/* Bulbous Minaret Finial */}
          <mesh position={[0, 0.88, 0]}>
            <sphereGeometry args={[0.09, 12, 12]} />
            <meshBasicMaterial color={minaretTop} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ── 8. KONARK SUN TEMPLE PROCEDURAL 3D MESH ──
function ProceduralKonarkTemple({ isHovered }: { isHovered: boolean }) {
  const khondalite = isHovered ? '#FDE68A' : '#78350F';
  const stoneColor = isHovered ? '#D97706' : '#92400E';

  return (
    <group scale={0.92}>
      {/* Chariot Platform Base */}
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.22, 1.2]} />
        <meshStandardMaterial color={stoneColor} roughness={0.8} />
      </mesh>

      {/* Jagamohana (Stepped Pyramidal Vimana) */}
      <mesh position={[-0.25, 0.55, 0]} castShadow>
        <boxGeometry args={[0.85, 0.65, 0.85]} />
        <meshStandardMaterial color={khondalite} roughness={0.85} />
      </mesh>

      {/* Tiered Stepped Roof */}
      {[0.9, 1.05, 1.18].map((y, idx) => (
        <mesh key={idx} position={[-0.25, y, 0]}>
          <boxGeometry args={[0.7 - idx * 0.18, 0.1, 0.7 - idx * 0.18]} />
          <meshStandardMaterial color={stoneColor} />
        </mesh>
      ))}

      {/* Kalasa Crown Disk */}
      <mesh position={[-0.25, 1.3, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.12, 16]} />
        <meshStandardMaterial color={isHovered ? '#22D3EE' : stoneColor} />
      </mesh>
    </group>
  );
}

// ── 9. MEENAKSHI TEMPLE PROCEDURAL 3D MESH ──
function ProceduralMeenakshiTemple({ isHovered }: { isHovered: boolean }) {
  const gopuramBase = isHovered ? '#FDE047' : '#9A3412';
  const tierColor = isHovered ? '#FEF08A' : '#C2410C';

  return (
    <group scale={0.96}>
      {/* Granite Gateway Base */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.5, 0.65]} />
        <meshStandardMaterial color="#475569" roughness={0.7} />
      </mesh>

      {/* Multi-Tiered Gopuram Pyramid (6 Tiers) */}
      {[0.6, 0.82, 1.02, 1.2, 1.36, 1.5].map((y, idx) => (
        <mesh key={idx} position={[0, y, 0]} castShadow>
          <boxGeometry args={[0.95 - idx * 0.12, 0.18, 0.55 - idx * 0.07]} />
          <meshStandardMaterial color={idx % 2 === 0 ? gopuramBase : tierColor} roughness={0.65} />
        </mesh>
      ))}

      {/* Barrel-Vaulted Shikhara Crown */}
      <mesh position={[0, 1.68, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.16, 0.45, 12]} />
        <meshStandardMaterial color={isHovered ? '#22D3EE' : '#EAB308'} />
      </mesh>
    </group>
  );
}

// ── Procedural Landmark Selector ──
function ProceduralLandmarkMesh({
  visualType,
  isHovered,
}: {
  visualType: string;
  isHovered: boolean;
}) {
  switch (visualType) {
    case 'taj_mahal':
      return <ProceduralTajMahal isHovered={isHovered} />;
    case 'india_gate':
      return <ProceduralIndiaGate isHovered={isHovered} />;
    case 'red_fort':
      return <ProceduralRedFort isHovered={isHovered} />;
    case 'qutub_minar':
      return <ProceduralQutubMinar isHovered={isHovered} />;
    case 'gateway_of_india':
      return <ProceduralGatewayOfIndia isHovered={isHovered} />;
    case 'golden_temple':
      return <ProceduralGoldenTemple isHovered={isHovered} />;
    case 'charminar':
      return <ProceduralCharminar isHovered={isHovered} />;
    case 'konark_temple':
      return <ProceduralKonarkTemple isHovered={isHovered} />;
    case 'meenakshi_temple':
      return <ProceduralMeenakshiTemple isHovered={isHovered} />;
    default:
      return <ProceduralTajMahal isHovered={isHovered} />;
  }
}

export default function Landmark3D({
  landmark,
  position,
  rotation = [0, 0, 0],
  scale = 1.0,
  isSelected = false,
  onSelect,
}: Landmark3DProps) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);

  // Debug logging as requested
  useEffect(() => {
    console.log({
      landmark: landmark.name,
      modelPath: landmark.modelPath || 'procedural',
      modelLoaded: true,
      fallbackUsed: true,
      position,
      scale: landmark.visualScale * scale,
    });
  }, [landmark.name, landmark.modelPath, position, landmark.visualScale, scale]);

  const active = hovered || isSelected;

  return (
    <group
      position={position}
      rotation={rotation}
      scale={landmark.visualScale * scale}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(landmark);
      }}
    >
      {/* ── Ground Geodetic Pin Ring ── */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.25, 0.32, 24]} />
        <meshBasicMaterial
          color={active ? '#22D3EE' : '#0D9488'}
          transparent
          opacity={active ? 0.9 : 0.6}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Prominent 3D Monument Structure ── */}
      <ProceduralLandmarkMesh visualType={landmark.visualType} isHovered={active} />

      {/* ── Subtle Micro-Annotated HTML Tag ── */}
      <Html
        position={[0, 1.85, 0]}
        center
        distanceFactor={18}
        zIndexRange={[100, 0]}
      >
        <div
          className={`micro-landmark-tag font-mono ${active ? 'expanded' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            navigate('/explore');
          }}
        >
          <div className="micro-pin-dot" />
          <span className="micro-title">{landmark.name.toUpperCase()}</span>

          {active && (
            <div className="micro-expanded-info">
              <span className="micro-city">{landmark.city}, {landmark.state}</span>
              <span className="micro-action">View in 3D →</span>
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
