import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Building, Unit } from '../../types';
import { RotateCw, Sparkles, Layers, MapPin, ZoomIn, ZoomOut, Box } from 'lucide-react';
import './Map3D.css';

interface MapThreeJSProps {
  building: Building;
  selectedUnit: Unit | null;
  onUnitClick: (unit: Unit) => void;
  selectedFloor: number | null;
}

const FLOOR_HEX_COLORS = [
  0x6366f1, // Lavender Indigo
  0x3b82f6, // Ocean Blue
  0x10b981, // Mint Emerald
  0xf59e0b, // Amber Gold
  0xec4899, // Rose Pink
  0x8b5cf6, // Violet Purple
];

export default function MapThreeJS({ building, selectedUnit, onUnitClick, selectedFloor }: MapThreeJSProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const unitMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const autoRotateRef = useRef(false);

  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);

  const pid = (building?.parcel_id || '').toUpperCase();
  const bid = (building?.building_id || '').toLowerCase();

  const isTajMahal = pid.includes('TAJMAHAL') || bid.includes('tajmahal');
  const isGurugram = pid.includes('GURUGRAM') || bid.includes('gurugram');
  const isMumbai = pid.includes('MUMBAI') || bid.includes('mumbai');

  const firstUnit = building?.units?.[0];
  const centerLng = Number(firstUnit?.centroid?.[1]) || 77.0495;
  const centerLat = Number(firstUnit?.centroid?.[0]) || 28.5925;

  autoRotateRef.current = autoRotate;

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 520;

    // 1. Scene Setup with Dark Architectural Backdrop
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080c14);
    scene.fog = new THREE.FogExp2(0x080c14, 0.007);
    sceneRef.current = scene;

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(30, 24, 30);
    cameraRef.current = camera;

    // 3. High Performance Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Orbit Controls
    const totalFloors = building?.floor_count || 4;
    const targetY = isTajMahal ? 6.0 : isGurugram ? 9.0 : isMumbai ? 12.0 : (totalFloors * 1.6) / 2;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, targetY, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 6;
    controls.maxDistance = 140;
    controlsRef.current = controls;

    // 5. Multi-Source Architectural Lighting
    const ambientLight = new THREE.AmbientLight(0xfff8f0, 1.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffbef, 2.5);
    sunLight.position.set(40, 60, 35);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);

    const cyanRimLight = new THREE.PointLight(0x7c6fe0, 3.0, 70);
    cyanRimLight.position.set(-25, 35, -25);
    scene.add(cyanRimLight);

    const warmFillLight = new THREE.DirectionalLight(0xe06f8f, 0.8);
    warmFillLight.position.set(-30, 20, 20);
    scene.add(warmFillLight);

    // 6. Ground Base & Site Grid
    const gridHelper = new THREE.GridHelper(70, 35, 0x7c6fe0, 0x1e293b);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    const groundGeo = new THREE.PlaneGeometry(70, 70);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0b1329, roughness: 0.8, metalness: 0.2 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Landscaping: Surrounding road curb & pathway accents
    const roadRingGeo = new THREE.RingGeometry(20, 21.5, 32);
    const roadRingMat = new THREE.MeshBasicMaterial({ color: 0x334155, side: THREE.DoubleSide });
    const roadRingMesh = new THREE.Mesh(roadRingGeo, roadRingMat);
    roadRingMesh.rotation.x = -Math.PI / 2;
    roadRingMesh.position.y = 0.005;
    scene.add(roadRingMesh);

    // Materials Palette
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.6,
      transparent: true,
      opacity: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      wireframe: wireframeMode
    });

    const facadeMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.25,
      wireframe: wireframeMode
    });

    const blueFacadeMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x1e40af,
      metalness: 0.4,
      roughness: 0.2,
      clearcoat: 0.8,
      wireframe: wireframeMode
    });

    const bronzeMaterial = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.85,
      roughness: 0.25,
      wireframe: wireframeMode
    });

    const steelMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.9,
      roughness: 0.2,
      wireframe: wireframeMode
    });

    const marbleMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      roughness: 0.15,
      metalness: 0.05,
      clearcoat: 0.95,
      wireframe: wireframeMode
    });

    // 7. Architectural Building Models with High-Detail Elements
    if (isTajMahal) {
      // Marble Plinth Base
      const plinthMesh = new THREE.Mesh(new THREE.BoxGeometry(16, 1.4, 16), marbleMaterial);
      plinthMesh.position.y = 0.7;
      plinthMesh.castShadow = true;
      plinthMesh.receiveShadow = true;
      scene.add(plinthMesh);

      // Main Octagonal Structure
      const mainBuildingMesh = new THREE.Mesh(new THREE.BoxGeometry(10.5, 7.0, 10.5), marbleMaterial);
      mainBuildingMesh.position.y = 4.9;
      mainBuildingMesh.castShadow = true;
      mainBuildingMesh.receiveShadow = true;
      scene.add(mainBuildingMesh);

      // Central High Drum
      const drumMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 2.6, 32), marbleMaterial);
      drumMesh.position.y = 9.7;
      drumMesh.castShadow = true;
      scene.add(drumMesh);

      // Onion Dome
      const domeMesh = new THREE.Mesh(new THREE.SphereGeometry(3.2, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.72), marbleMaterial);
      domeMesh.position.y = 11.0;
      domeMesh.castShadow = true;
      scene.add(domeMesh);

      // Golden Finial Spire
      const finialMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.2, 2.6, 16), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.9, roughness: 0.1 }));
      finialMesh.position.y = 14.3;
      scene.add(finialMesh);

      // 4 Minarets at corners
      [ [7.2, 7.2], [-7.2, 7.2], [7.2, -7.2], [-7.2, -7.2] ].forEach(([x, z]) => {
        const minaretMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 13.5, 24), marbleMaterial);
        minaretMesh.position.set(x, 8.15, z);
        minaretMesh.castShadow = true;
        scene.add(minaretMesh);

        const cupolaMesh = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.7), marbleMaterial);
        cupolaMesh.position.set(x, 15.2, z);
        scene.add(cupolaMesh);
      });
    } else if (isGurugram) {
      // Gurugram High-Rise IT Tower
      const podiumMesh = new THREE.Mesh(new THREE.BoxGeometry(15, 2.2, 15), facadeMetalMaterial);
      podiumMesh.position.y = 1.1;
      podiumMesh.castShadow = true;
      scene.add(podiumMesh);

      // Main Glass Cylinder Tower
      const towerMesh = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 5.4, 18, 36), glassMaterial);
      towerMesh.position.y = 11.2;
      towerMesh.castShadow = true;
      scene.add(towerMesh);

      // Structural mullion rings around glass facade
      for (let y = 3; y <= 19; y += 3) {
        const ringGeo = new THREE.TorusGeometry(5.0 - (y * 0.03), 0.08, 8, 36);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.2 });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.position.y = y;
        scene.add(ringMesh);
      }

      // Helipad Roof Platform
      const helipadMesh = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 5.0, 0.4, 36), steelMaterial);
      helipadMesh.position.y = 20.4;
      helipadMesh.castShadow = true;
      scene.add(helipadMesh);

      // Helipad H Letter Mark
      const hBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 2.4), new THREE.MeshBasicMaterial({ color: 0xf8fafc }));
      hBar1.position.set(-0.8, 20.62, 0);
      scene.add(hBar1);

      const hBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 2.4), new THREE.MeshBasicMaterial({ color: 0xf8fafc }));
      hBar2.position.set(0.8, 20.62, 0);
      scene.add(hBar2);

      const hCross = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.4), new THREE.MeshBasicMaterial({ color: 0xf8fafc }));
      hCross.position.set(0, 20.62, 0);
      scene.add(hCross);

      // Communications Spire with Red LED Beacon Light
      const spireMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.22, 6.0, 16), steelMaterial);
      spireMesh.position.y = 23.4;
      scene.add(spireMesh);

      const beaconLight = new THREE.PointLight(0xef4444, 2.0, 15);
      beaconLight.position.set(0, 26.5, 0);
      scene.add(beaconLight);

      const beaconSphere = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
      beaconSphere.position.set(0, 26.5, 0);
      scene.add(beaconSphere);

    } else if (isMumbai) {
      // Mumbai Twin Financial Tower Complex
      const podiumMesh = new THREE.Mesh(new THREE.BoxGeometry(16, 2.4, 12), bronzeMaterial);
      podiumMesh.position.y = 1.2;
      podiumMesh.castShadow = true;
      scene.add(podiumMesh);

      // Tower A & B
      const towerAMesh = new THREE.Mesh(new THREE.BoxGeometry(5.6, 24.0, 8.5), blueFacadeMaterial);
      towerAMesh.position.set(-3.8, 14.4, 0);
      towerAMesh.castShadow = true;
      scene.add(towerAMesh);

      const towerBMesh = new THREE.Mesh(new THREE.BoxGeometry(5.6, 24.0, 8.5), blueFacadeMaterial);
      towerBMesh.position.set(3.8, 14.4, 0);
      towerBMesh.castShadow = true;
      scene.add(towerBMesh);

      // Connecting Skybridges
      [14.0, 20.0].forEach(y => {
        const bridgeMesh = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.8, 5.5), glassMaterial);
        bridgeMesh.position.set(0, y, 0);
        scene.add(bridgeMesh);
      });

      // Rooftop Crown Structure
      const crownMesh = new THREE.Mesh(new THREE.BoxGeometry(12, 1.4, 7.5), steelMaterial);
      crownMesh.position.set(0, 27.1, 0);
      scene.add(crownMesh);

    } else {
      // Generic Architectural Block Model
      const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(13, 1.8, 13), steelMaterial);
      baseMesh.position.y = 0.9;
      baseMesh.castShadow = true;
      scene.add(baseMesh);

      const heightM = Math.max(totalFloors * 1.8, 8);
      const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(10, heightM, 10), glassMaterial);
      bodyMesh.position.y = 0.9 + heightM / 2;
      bodyMesh.castShadow = true;
      scene.add(bodyMesh);

      // Rooftop HVAC Equipment Box
      const hvacMesh = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.2, 3.5), steelMaterial);
      hvacMesh.position.set(0, 0.9 + heightM + 0.6, 0);
      scene.add(hvacMesh);
    }

    // 8. 3D Spatial Units (Floor Strata Volumes)
    const unitMap = new Map<string, THREE.Mesh>();
    const units = building?.units || [];

    units.forEach((unit) => {
      const floorNum = unit.floor_number;
      const levelY = (floorNum - 1) * 1.75 + 1.3;

      const levelGeo = new THREE.BoxGeometry(10.8, 0.5, 10.8);
      const baseColor = FLOOR_HEX_COLORS[(floorNum - 1) % FLOOR_HEX_COLORS.length];

      const levelMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.4,
        wireframe: wireframeMode,
      });

      const levelMesh = new THREE.Mesh(levelGeo, levelMat);
      levelMesh.position.y = levelY;
      levelMesh.userData = { unit, baseColor };
      scene.add(levelMesh);
      unitMap.set(unit.unit_id, levelMesh);

      // Crisp Floor Slab Boundary Ring
      const slabGeo = new THREE.BoxGeometry(11.0, 0.06, 11.0);
      const slabMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });
      const slabMesh = new THREE.Mesh(slabGeo, slabMat);
      slabMesh.position.y = levelY - 0.28;
      scene.add(slabMesh);
    });

    unitMeshesRef.current = unitMap;

    // Raycasting & Interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      if (!rendererRef.current) return;
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(Array.from(unitMap.values()));

      if (intersects.length > 0) {
        const hoveredMesh = intersects[0].object as THREE.Mesh;
        const u = hoveredMesh.userData.unit as Unit;
        setHoveredUnitId(u.unit_id);
        rendererRef.current.domElement.style.cursor = 'pointer';
      } else {
        setHoveredUnitId(null);
        if (rendererRef.current) rendererRef.current.domElement.style.cursor = 'grab';
      }
    };

    const handleClick = (e: MouseEvent) => {
      if (!rendererRef.current) return;
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(Array.from(unitMap.values()));

      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object as THREE.Mesh;
        if (clickedMesh.userData.unit) {
          onUnitClick(clickedMesh.userData.unit as Unit);
        }
      }
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('pointermove', handlePointerMove);
    domElem.addEventListener('click', handleClick);

    // Animation Render Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      if (autoRotateRef.current && sceneRef.current) {
        sceneRef.current.rotation.y += 0.004;
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        rendererRef.current.setSize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      domElem.removeEventListener('pointermove', handlePointerMove);
      domElem.removeEventListener('click', handleClick);
      renderer.dispose();
      unitMap.clear();
      unitMeshesRef.current.clear();
    };
  }, [building, wireframeMode]);

  // Update unit selection & floor isolation styles
  useEffect(() => {
    unitMeshesRef.current.forEach((mesh) => {
      const u = mesh.userData.unit as Unit;
      const isSelected = selectedUnit?.unit_id === u.unit_id;
      const isFloorVisible = selectedFloor === null || selectedFloor === u.floor_number;

      mesh.visible = isFloorVisible;
      const mat = mesh.material as THREE.MeshStandardMaterial;

      if (isSelected) {
        mat.color.setHex(0x7c6fe0);
        mat.emissive.setHex(0x7c6fe0);
        mat.emissiveIntensity = 0.9;
        mat.opacity = 0.95;
      } else {
        mat.color.setHex(mesh.userData.baseColor);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.0;
        mat.opacity = 0.4;
      }
    });
  }, [selectedUnit, selectedFloor]);

  const handleZoomIn = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.multiplyScalar(0.85);
      controlsRef.current.update();
    }
  };

  const handleZoomOut = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.multiplyScalar(1.15);
      controlsRef.current.update();
    }
  };

  return (
    <div className="threejs-map-container">
      <div className="threejs-canvas-wrapper" ref={mountRef} />

      {/* Toolbar Overlays */}
      <div className="threejs-toolbar">
        <button
          className={`toolbar-btn ${autoRotate ? 'active' : ''}`}
          onClick={() => setAutoRotate(!autoRotate)}
          title="Auto Rotate Scene"
        >
          <RotateCw size={15} />
          <span>{autoRotate ? 'Rotating' : 'Rotate'}</span>
        </button>

        <button
          className={`toolbar-btn ${wireframeMode ? 'active' : ''}`}
          onClick={() => setWireframeMode(!wireframeMode)}
          title="Toggle Wireframe Structural Skeleton"
        >
          <Layers size={15} />
          <span>Wireframe</span>
        </button>

        <div className="zoom-controls">
          <button className="zoom-btn" onClick={handleZoomIn} title="Zoom In"><ZoomIn size={14} /></button>
          <button className="zoom-btn" onClick={handleZoomOut} title="Zoom Out"><ZoomOut size={14} /></button>
        </div>
      </div>

      {/* Location Banner */}
      <div className="location-banner-header absolute top-4 left-4 p-2.5 z-10 flex items-center gap-2.5 bg-slate-900/90 backdrop-blur rounded-lg border border-indigo-500/40 shadow-xl">
        <div className="w-7 h-7 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center">
          <MapPin size={16} />
        </div>
        <div className="flex flex-col">
          <span className="text-[0.78rem] font-bold text-white leading-tight">
            {building?.building_name || 'Cadastral Building Model'}
          </span>
          <span className="text-[0.68rem] font-mono text-indigo-300">
            {centerLat.toFixed(5)}°N, {centerLng.toFixed(5)}°E • Height {building?.height || 45}m ({building?.floor_count || 4} Floors)
          </span>
        </div>
      </div>

      {/* Bottom Tech Badge */}
      <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-white/10 px-3 py-1.5 rounded-full text-xs text-gray-300">
        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
        <span className="font-semibold text-indigo-300">Three.js PBR Studio Engine</span>
      </div>
    </div>
  );
}
