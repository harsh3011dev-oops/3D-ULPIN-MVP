import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import IndiaMap3D from './IndiaMap3D';
import LandmarkModels from './LandmarkModels';
import CadastralStrataStory from './CadastralStrataStory';
import { VisualLandmark } from '../../data/homepageVisualLocations';

export type SectionState = 'hero' | 'how-it-works' | 'capabilities' | 'cta';

interface GlobalIndia3DSceneProps {
  activeSection: SectionState;
  activeStepIndex?: number;
  onSelectLandmark?: (landmark: VisualLandmark) => void;
  selectedLandmarkId?: string | null;
}

// ── Camera Controller & Smooth Lerp Interpolator ──
function ScrollCameraController({
  activeSection,
  activeStepIndex = 0,
  mousePos,
  reducedMotion,
}: {
  activeSection: SectionState;
  activeStepIndex: number;
  mousePos: { x: number; y: number };
  reducedMotion: boolean;
}) {
  const { camera } = useThree();
  const targetCamPos = useRef(new THREE.Vector3(0.5, 3.8, 8.5));
  const targetLookAt = useRef(new THREE.Vector3(0, 0.4, 0));
  const currentLookAt = useRef(new THREE.Vector3(0, 0.4, 0));

  // Determine section-specific camera angles
  if (activeSection === 'hero') {
    // Wide cinematic perspective of India
    targetCamPos.current.set(0.6, 4.0, 8.8);
    targetLookAt.current.set(0, 0.2, 0);
  } else if (activeSection === 'how-it-works') {
    // Zoom in progressively into the cadastral strata story building
    if (activeStepIndex === 0) {
      // LAND
      targetCamPos.current.set(0.8, 2.8, 4.5);
      targetLookAt.current.set(0.2, 0.4, 0.8);
    } else if (activeStepIndex === 1) {
      // BUILDING
      targetCamPos.current.set(1.4, 2.5, 4.2);
      targetLookAt.current.set(0.2, 0.6, 0.8);
    } else if (activeStepIndex === 2) {
      // FLOOR
      targetCamPos.current.set(1.8, 3.0, 4.4);
      targetLookAt.current.set(0.2, 1.2, 0.8);
    } else if (activeStepIndex === 3) {
      // UNIT
      targetCamPos.current.set(1.5, 2.4, 3.8);
      targetLookAt.current.set(0.2, 1.1, 0.8);
    } else {
      // ULPIN
      targetCamPos.current.set(1.6, 2.6, 4.0);
      targetLookAt.current.set(0.2, 1.0, 0.8);
    }
  } else if (activeSection === 'capabilities') {
    // Angled regional scan across India
    targetCamPos.current.set(-3.2, 4.2, 7.8);
    targetLookAt.current.set(0.4, 0.5, 0);
  } else if (activeSection === 'cta') {
    // Expansive pull-back overview of India
    targetCamPos.current.set(0.8, 5.2, 10.5);
    targetLookAt.current.set(0, 0.1, 0);
  }

  useFrame((_, delta) => {
    // Parallax damping
    const parallaxX = reducedMotion ? 0 : mousePos.x * 0.45;
    const parallaxY = reducedMotion ? 0 : mousePos.y * 0.35;

    const desiredCamPos = targetCamPos.current.clone();
    desiredCamPos.x += parallaxX;
    desiredCamPos.y += parallaxY;

    // Smooth interpolation (Lerp)
    camera.position.lerp(desiredCamPos, 2.4 * delta);
    currentLookAt.current.lerp(targetLookAt.current, 2.4 * delta);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}

// ── Gentle Idle Drift Rig ──
function IndiaSceneRig({
  children,
  reducedMotion,
}: {
  children: React.ReactNode;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current && !reducedMotion) {
      // Extremely slow, calm yaw drift
      groupRef.current.rotation.y += delta * 0.045;
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

export default function GlobalIndia3DScene({
  activeSection,
  activeStepIndex = 0,
  onSelectLandmark,
  selectedLandmarkId,
}: GlobalIndia3DSceneProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);

  // Check prefers-reduced-motion media query
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(media.matches);
      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    }
  }, []);

  // Window cursor parallax tracking
  useEffect(() => {
    if (reducedMotion) return;
    const handleMouseMove = (e: MouseEvent) => {
      // Normalized between -1 and 1
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      setMousePos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [reducedMotion]);

  return (
    <div className="global-3d-background-layer" aria-hidden>
      <Canvas
        shadows
        camera={{ position: [0.6, 4.0, 8.8], fov: 42 }}
        style={{ width: '100%', height: '100%' }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight
          position={[10, 16, 12]}
          intensity={1.2}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-8, 6, -6]} intensity={0.4} color="#38BDF8" />
        <pointLight position={[0, 4, 2]} intensity={0.6} color="#0D9488" />

        <ScrollCameraController
          activeSection={activeSection}
          activeStepIndex={activeStepIndex}
          mousePos={mousePos}
          reducedMotion={reducedMotion}
        />

        <IndiaSceneRig reducedMotion={reducedMotion}>
          {/* 3D India Subcontinent, National Cadastral Border & Major Hubs */}
          <IndiaMap3D
            activeSection={activeSection}
            onSelectLandmark={onSelectLandmark}
            selectedLandmarkId={selectedLandmarkId}
          />

          {/* 3D Architectural Indian Landmark Models & Interactive Geodetic Pins */}
          <LandmarkModels
            onSelectLandmark={onSelectLandmark}
            selectedLandmarkId={selectedLandmarkId}
          />

          {/* 5-Stage Cadastral Strata Transformation Story Building */}
          <CadastralStrataStory
            activeSection={activeSection}
            activeStepIndex={activeStepIndex}
          />
        </IndiaSceneRig>
      </Canvas>
    </div>
  );
}
