import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { HOMEPAGE_LANDMARKS, INDIA_MAJOR_HUBS, geoToGlobePosition, VisualLandmark } from '../../data/homepageVisualLocations';

// Simplified geodetic boundary points forming the iconic silhouette of India
// (Kashmir north, Gujarat west, Kanyakumari south, Arunachal east, Bengal/Odisha coast)
const INDIA_PERIMETER_COORDS: [number, number][] = [
  // Northern boundary (Kashmir, Ladakh, Himachal, Uttarakhand)
  [36.8, 74.5], [35.5, 77.8], [34.2, 79.2], [32.5, 78.9], [30.4, 80.8], [28.8, 80.2],
  // Nepal/Sikkim/Bhutan border transition
  [27.3, 88.6], [28.0, 91.6], [28.2, 96.2], [27.0, 97.2],
  // North-East / Myanmar border
  [25.5, 95.0], [24.0, 93.2], [22.0, 92.8], [22.8, 89.2],
  // Bay of Bengal East Coast (Sundarbans to Kanyakumari)
  [21.6, 87.5], [19.8, 86.0], [17.7, 83.3], [15.9, 80.6], [13.1, 80.3], [10.8, 79.8], [9.3, 79.1], [8.1, 77.5],
  // Arabian Sea West Coast (Kanyakumari to Gujarat)
  [8.5, 76.9], [11.2, 75.8], [15.4, 73.8], [18.9, 72.8], [20.9, 72.8], [21.0, 70.0], [22.4, 69.0], [23.8, 68.2], [24.5, 71.0],
  // Western border (Rajasthan, Punjab to Kashmir)
  [26.5, 70.3], [28.5, 71.8], [30.5, 73.5], [32.5, 74.8], [34.5, 74.2], [36.8, 74.5]
];

// Major internal regional river / cadastral division lines
const CADASTRAL_GRID_LINES: [number, number][][] = [
  // Tropic of Cancer line (~23.5° N)
  [[23.5, 68.5], [23.5, 73.0], [23.5, 78.5], [23.5, 83.5], [23.5, 88.5], [23.5, 92.5]],
  // Central Meridian of India (82.5° E - IST reference)
  [[8.5, 82.5], [15.0, 82.5], [20.0, 82.5], [25.0, 82.5], [30.0, 82.5]],
  // Indo-Gangetic Cadastral Arc
  [[30.0, 76.0], [28.6, 77.2], [27.2, 78.0], [25.5, 83.0], [24.0, 88.0]],
  // Deccan Plateau Cadastral Axis
  [[19.0, 73.0], [17.4, 78.5], [15.0, 77.0], [13.0, 80.2]]
];

interface IndiaMap3DProps {
  onSelectLandmark?: (landmark: VisualLandmark) => void;
  selectedLandmarkId?: string | null;
  activeSection: string;
}

export default function IndiaMap3D({
  onSelectLandmark,
  selectedLandmarkId,
  activeSection,
}: IndiaMap3DProps) {
  const globeRadius = 6.8;
  const meshRef = useRef<THREE.Mesh>(null);
  const hubsGroupRef = useRef<THREE.Group>(null);

  // Convert 2D perimeter coordinates into 3D curved polygon points
  const perimeterPoints3D = useMemo(() => {
    return INDIA_PERIMETER_COORDS.map(([lat, lon]) => {
      const pos = geoToGlobePosition(lat, lon, globeRadius + 0.02);
      return new THREE.Vector3(pos[0], pos[1], pos[2]);
    });
  }, [globeRadius]);

  // Convert internal grid lines
  const internalLines3D = useMemo(() => {
    return CADASTRAL_GRID_LINES.map((lineCoords) =>
      lineCoords.map(([lat, lon]) => {
        const pos = geoToGlobePosition(lat, lon, globeRadius + 0.015);
        return new THREE.Vector3(pos[0], pos[1], pos[2]);
      })
    );
  }, [globeRadius]);

  // Create India plate geometry via 2D shape projected on sphere
  const indiaPlateMesh = useMemo(() => {
    const shape = new THREE.Shape();
    INDIA_PERIMETER_COORDS.forEach(([lat, lon], idx) => {
      // Scale lat/lon into normalized 2D plate coords
      const x = (lon - 79.0) * 0.28;
      const y = (lat - 22.5) * 0.28;
      if (idx === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });

    const extrudeSettings = {
      depth: 0.12,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, []);

  // Pulse animation for hubs and lines
  useFrame((state, delta) => {
    if (hubsGroupRef.current) {
      hubsGroupRef.current.children.forEach((child, idx) => {
        if (child instanceof THREE.Mesh) {
          const scale = 1 + Math.sin(state.clock.elapsedTime * 2.5 + idx * 0.6) * 0.22;
          child.scale.set(scale, scale, scale);
        }
      });
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* ── Curved Dark Geospatial Earth Base ── */}
      <mesh position={[0, -0.6, -1.8]} receiveShadow>
        <sphereGeometry args={[globeRadius, 64, 64]} />
        <meshStandardMaterial
          color="#0B132B"
          roughness={0.85}
          metalness={0.15}
          emissive="#060D1E"
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* ── Global Aerospace Longitude/Latitude Cadastral Wireframe ── */}
      <mesh position={[0, -0.6, -1.8]}>
        <sphereGeometry args={[globeRadius + 0.005, 32, 24]} />
        <meshBasicMaterial
          color="#1E293B"
          wireframe
          transparent
          opacity={0.35}
        />
      </mesh>

      {/* ── Extruded India Landmass Elevation Plate ── */}
      <mesh
        ref={meshRef}
        geometry={indiaPlateMesh}
        position={[0, 0, 0.05]}
        rotation={[0, 0, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color="#1E293B"
          roughness={0.55}
          metalness={0.25}
          emissive="#0D9488"
          emissiveIntensity={0.15}
        />
      </mesh>

      {/* ── India National Border Cadastral Outline (Crisp Teal) ── */}
      <Line
        points={perimeterPoints3D}
        color="#0D9488"
        lineWidth={2.8}
        dashed={false}
      />

      {/* ── Internal Regional Cadastral Grid Arcs ── */}
      {internalLines3D.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color="#0891B2"
          lineWidth={1.2}
          dashed
          dashSize={0.2}
          gapSize={0.12}
        />
      ))}

      {/* ── Major Hubs (Smart City & Cadastral Registry Nodes) ── */}
      <group ref={hubsGroupRef}>
        {INDIA_MAJOR_HUBS.map((hub) => {
          const [hx, hy, hz] = geoToGlobePosition(hub.lat, hub.lon, globeRadius + 0.04);
          const isNational = hub.type === 'national';
          return (
            <group key={hub.name} position={[hx, hy, hz]}>
              {/* Pulsing Beacon Halo */}
              <mesh>
                <ringGeometry args={[0.06, 0.11, 24]} />
                <meshBasicMaterial
                  color={isNational ? '#22D3EE' : '#14B8A6'}
                  transparent
                  opacity={0.8}
                  side={THREE.DoubleSide}
                />
              </mesh>

              {/* Core Geodetic Pin */}
              <mesh position={[0, 0, 0.02]}>
                <sphereGeometry args={[0.045, 16, 16]} />
                <meshBasicMaterial color={isNational ? '#38BDF8' : '#0D9488'} />
              </mesh>
            </group>
          );
        })}
      </group>

      {/* ── Atmosphere Halo Rim ── */}
      <mesh position={[0, -0.6, -1.8]}>
        <sphereGeometry args={[globeRadius + 0.18, 48, 48]} />
        <meshBasicMaterial
          color="#0D9488"
          transparent
          opacity={0.07}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}
