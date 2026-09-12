import React, { useState, useEffect, Suspense } from 'react';
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

/**
 * Loads a real custom 3D model (GLB / GLTF) if available.
 */
function CustomGLTFModel({ url, isHovered }: { url: string; isHovered: boolean }) {
  const { scene } = useGLTF(url);
  const clonedScene = React.useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return <primitive object={clonedScene} scale={isHovered ? 1.08 : 1.0} />;
}

/**
 * Universal dynamic parametric architectural marker for landmarks.
 * Strictly uses geometric parameters rather than hardcoded building names.
 */
function DynamicUniversalLandmarkMesh({ isHovered }: { isHovered: boolean }) {
  const baseColor = isHovered ? '#38BDF8' : '#0EA5E9';
  const stoneColor = isHovered ? '#F8FAFC' : '#CBD5E1';
  const finialGold = isHovered ? '#FDE047' : '#D97706';

  return (
    <group scale={1.0}>
      {/* Plinth Platform */}
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.16, 1.2]} />
        <meshStandardMaterial color={stoneColor} roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Main Structural Mass */}
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.78, 0.8]} />
        <meshStandardMaterial color={stoneColor} roughness={0.25} metalness={0.15} />
      </mesh>

      {/* Stepped Tier */}
      <mesh position={[0, 1.02, 0]} castShadow>
        <boxGeometry args={[0.55, 0.16, 0.55]} />
        <meshStandardMaterial color={baseColor} roughness={0.3} metalness={0.3} />
      </mesh>

      {/* Spire / Crown Finial */}
      <mesh position={[0, 1.25, 0]} castShadow>
        <coneGeometry args={[0.22, 0.45, 16]} />
        <meshStandardMaterial color={finialGold} roughness={0.2} metalness={0.6} />
      </mesh>
    </group>
  );
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
  const active = hovered || isSelected;

  useEffect(() => {
    console.log({
      landmark: landmark.name,
      modelPath: landmark.modelPath || 'dynamic-mesh',
      position,
      scale: landmark.visualScale * scale,
    });
  }, [landmark.name, landmark.modelPath, position, landmark.visualScale, scale]);

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

      {/* ── 3D Architectural Representation ── */}
      {landmark.modelPath ? (
        <Suspense fallback={<DynamicUniversalLandmarkMesh isHovered={active} />}>
          <CustomGLTFModel url={landmark.modelPath} isHovered={active} />
        </Suspense>
      ) : (
        <DynamicUniversalLandmarkMesh isHovered={active} />
      )}

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
