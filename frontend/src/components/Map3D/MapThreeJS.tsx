import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Building, Unit } from '../../types';
import { RotateCw, Sparkles, Layers, MapPin, ZoomIn, ZoomOut } from 'lucide-react';
import './Map3D.css';

interface MapThreeJSProps {
  building: Building;
  selectedUnit: Unit | null;
  onUnitClick: (unit: Unit) => void;
  selectedFloor: number | null;
}

const FLOOR_HEX_COLORS = [
  0x3b82f6, // Floor 1: Blue
  0x10b981, // Floor 2: Emerald
  0xf59e0b, // Floor 3: Amber
  0x8b5cf6, // Floor 4: Purple
  0x06b6d4, // Floor 5: Cyan
  0xec4899, // Floor 6: Pink
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
  const isDelhi = pid.includes('DELHI') || bid.includes('delhi');

  const firstUnit = building?.units?.[0];
  const centerLng = Number(firstUnit?.centroid?.[1]) || 77.0495;
  const centerLat = Number(firstUnit?.centroid?.[0]) || 28.5925;

  autoRotateRef.current = autoRotate;

  // Initialize Three.js Scene ONCE per building dataset change
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 520;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060a12);
    scene.fog = new THREE.FogExp2(0x060a12, 0.008);
    sceneRef.current = scene;

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(28, 22, 28);
    cameraRef.current = camera;

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const totalFloors = building?.floor_count || 4;
    const targetY = isTajMahal ? 5.5 : isGurugram ? 8.0 : isMumbai ? 6.5 : (totalFloors * 1.5) / 2;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, targetY, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.01;
    controls.minDistance = 8;
    controls.maxDistance = 120;
    controlsRef.current = controls;

    // 5. Lighting System
    const ambientLight = new THREE.AmbientLight(0xfff8ed, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    sunLight.position.set(35, 55, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);

    const cyanRimLight = new THREE.PointLight(0x00f0ff, 2.5, 60);
    cyanRimLight.position.set(-20, 30, -20);
    scene.add(cyanRimLight);

    // 6. Ground Grid Base
    const gridHelper = new THREE.GridHelper(60, 30, 0x3b82f6, 0x1f2937);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a1324, roughness: 0.7 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const unitMap = new Map<string, THREE.Mesh>();
    const units = building?.units || [];

    // Materials Palette
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x00f0ff,
      metalness: 0.2,
      roughness: 0.15,
      transmission: 0.45,
      transparent: true,
      opacity: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      wireframe: wireframeMode
    });

    const blueFacadeMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x1e3a8a,
      metalness: 0.3,
      roughness: 0.2,
      clearcoat: 0.9,
      wireframe: wireframeMode
    });

    const bronzeMaterial = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.8,
      roughness: 0.3,
      wireframe: wireframeMode
    });

    const steelMaterial = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.9,
      roughness: 0.2,
      wireframe: wireframeMode
    });

    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.9,
      roughness: 0.2,
      wireframe: wireframeMode
    });

    const marbleMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf7f5f0,
      roughness: 0.18,
      metalness: 0.05,
      clearcoat: 0.9,
      wireframe: wireframeMode
    });

    // Preset architectural models
    if (isTajMahal) {
      const plinthMesh = new THREE.Mesh(new THREE.BoxGeometry(16, 1.4, 16), marbleMaterial);
      plinthMesh.position.y = 0.7;
      scene.add(plinthMesh);

      const mainBuildingMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 6.5, 10), marbleMaterial);
      mainBuildingMesh.position.y = 4.65;
      scene.add(mainBuildingMesh);

      const drumMesh = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 2.2, 32), marbleMaterial);
      drumMesh.position.y = 8.8;
      scene.add(drumMesh);

      const domeMesh = new THREE.Mesh(new THREE.SphereGeometry(3.0, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.72), marbleMaterial);
      domeMesh.position.y = 9.8;
      scene.add(domeMesh);

      const finialMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.18, 2.2, 16), goldMaterial);
      finialMesh.position.y = 12.8;
      scene.add(finialMesh);

      [ [7.0, 7.0], [-7.0, 7.0], [7.0, -7.0], [-7.0, -7.0] ].forEach(([x, z]) => {
        const shaftMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 12, 24), marbleMaterial);
        shaftMesh.position.set(x, 7.4, z);
        scene.add(shaftMesh);

        const cupolaDomeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.7), marbleMaterial);
        cupolaDomeMesh.position.set(x, 14.3, z);
        scene.add(cupolaDomeMesh);
      });
    } else if (isGurugram) {
      const podiumMesh = new THREE.Mesh(new THREE.BoxGeometry(14, 2.0, 14), steelMaterial);
      podiumMesh.position.y = 1.0;
      scene.add(podiumMesh);

      const towerMesh = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.2, 14, 32), glassMaterial);
      towerMesh.position.y = 9.0;
      scene.add(towerMesh);

      const helipadMesh = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.8, 0.4, 32), steelMaterial);
      helipadMesh.position.y = 16.2;
      scene.add(helipadMesh);

      const spireMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.2, 5.0, 16), steelMaterial);
      spireMesh.position.y = 18.7;
      scene.add(spireMesh);
    } else if (isMumbai) {
      const podiumMesh = new THREE.Mesh(new THREE.BoxGeometry(15, 2.2, 11), bronzeMaterial);
      podiumMesh.position.y = 1.1;
      scene.add(podiumMesh);

      const towerAMesh = new THREE.Mesh(new THREE.BoxGeometry(5.2, 22.0, 8), blueFacadeMaterial);
      towerAMesh.position.set(-3.5, 13.2, 0);
      scene.add(towerAMesh);

      const towerBMesh = new THREE.Mesh(new THREE.BoxGeometry(5.2, 22.0, 8), blueFacadeMaterial);
      towerBMesh.position.set(3.5, 13.2, 0);
      scene.add(towerBMesh);

      const bridgeMesh1 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.6, 5.0), glassMaterial);
      bridgeMesh1.position.set(0, 12.5, 0);
      scene.add(bridgeMesh1);

      const bridgeMesh2 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.6, 5.0), glassMaterial);
      bridgeMesh2.position.set(0, 18.5, 0);
      scene.add(bridgeMesh2);

      const crownMesh = new THREE.Mesh(new THREE.BoxGeometry(11, 1.2, 7), steelMaterial);
      crownMesh.position.set(0, 24.8, 0);
      scene.add(crownMesh);
    } else {
      const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(12, 1.6, 12), steelMaterial);
      baseMesh.position.y = 0.8;
      scene.add(baseMesh);

      const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(9.5, (totalFloors * 1.5), 9.5), glassMaterial);
      bodyMesh.position.y = 0.8 + (totalFloors * 1.5) / 2;
      scene.add(bodyMesh);
    }

    // Units
    units.forEach((unit) => {
      const floorNum = unit.floor_number;
      const levelY = (floorNum - 1) * 1.65 + 1.2;

      const levelGeo = new THREE.BoxGeometry(10.5, 0.45, 10.5);
      const baseColor = FLOOR_HEX_COLORS[(floorNum - 1) % FLOOR_HEX_COLORS.length];

      const levelMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.35,
        wireframe: wireframeMode,
      });

      const levelMesh = new THREE.Mesh(levelGeo, levelMat);
      levelMesh.position.y = levelY;
      levelMesh.userData = { unit, baseColor };
      scene.add(levelMesh);
      unitMap.set(unit.unit_id, levelMesh);
    });

    unitMeshesRef.current = unitMap;

    // Raycasting
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

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      if (autoRotateRef.current && sceneRef.current) {
        sceneRef.current.rotation.y += 0.005;
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

  // Dynamically update materials without tearing down WebGL scene
  useEffect(() => {
    unitMeshesRef.current.forEach((mesh) => {
      const u = mesh.userData.unit as Unit;
      const isSelected = selectedUnit?.unit_id === u.unit_id;
      const isFloorVisible = selectedFloor === null || selectedFloor === u.floor_number;

      mesh.visible = isFloorVisible;
      const mat = mesh.material as THREE.MeshStandardMaterial;

      if (isSelected) {
        mat.color.setHex(0x00f0ff);
        mat.emissive.setHex(0x00f0ff);
        mat.emissiveIntensity = 0.85;
        mat.opacity = 0.9;
      } else {
        mat.color.setHex(mesh.userData.baseColor);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.0;
        mat.opacity = 0.35;
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
    <div className="map3d-wrapper relative w-full h-full min-h-[520px] bg-[#0a0f1d] rounded-xl overflow-hidden shadow-2xl">
      <div ref={mountRef} className="w-full h-full min-h-[520px]" />

      {/* Floating Controls */}
      <div className="map-toolbar glass-panel absolute top-4 right-4 flex flex-col gap-2 p-2 z-10">
        <button
          className={`toolbar-btn w-9 h-9 rounded-md flex items-center justify-center border transition-all shadow-md ${
            autoRotate ? 'bg-amber-600 border-amber-400 text-white shadow-glow' : 'bg-slate-800/80 border-white/10 text-gray-300 hover:bg-amber-600 hover:text-white'
          }`}
          onClick={() => setAutoRotate(!autoRotate)}
          title="Toggle 360° Studio Auto-Rotation"
        >
          <RotateCw size={18} className={autoRotate ? 'animate-spin' : ''} />
        </button>

        <button
          className={`toolbar-btn w-9 h-9 rounded-md flex items-center justify-center border transition-all shadow-md ${
            wireframeMode ? 'bg-cyan-600 border-cyan-400 text-white shadow-glow' : 'bg-slate-800/80 border-white/10 text-gray-300 hover:bg-amber-600 hover:text-white'
          }`}
          onClick={() => setWireframeMode(!wireframeMode)}
          title="Toggle Wireframe Architectural Mode"
        >
          <Layers size={18} />
        </button>

        <button
          className="toolbar-btn w-9 h-9 rounded-md flex items-center justify-center bg-slate-800/80 border border-white/10 text-gray-300 hover:bg-amber-600 hover:text-white transition-all shadow-md"
          onClick={handleZoomIn}
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>

        <button
          className="toolbar-btn w-9 h-9 rounded-md flex items-center justify-center bg-slate-800/80 border border-white/10 text-gray-300 hover:bg-amber-600 hover:text-white transition-all shadow-md"
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          <ZoomOut size={18} />
        </button>
      </div>

      {/* Location Banner Header */}
      <div className="location-banner-header glass-panel absolute top-4 left-4 p-2.5 z-10 flex items-center gap-2.5 bg-slate-900/90 backdrop-blur rounded-lg border-amber-500/40">
        <div className="w-7 h-7 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
          <MapPin size={16} />
        </div>
        <div className="flex flex-col">
          <span className="text-[0.78rem] font-bold text-white leading-tight">
            {building?.building_name || 'Cadastral Parcel'}
          </span>
          <span className="text-[0.68rem] font-mono text-amber-300">
            {centerLat.toFixed(5)}°N, {centerLng.toFixed(5)}°E • Height {building?.height || 14}m
          </span>
        </div>
      </div>

      {/* Hover Info Badge */}
      {hoveredUnitId && (
        <div className="absolute bottom-16 left-4 z-10 glass-panel p-3 border border-amber-500/40 bg-slate-900/90 shadow-glow rounded-lg">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-amber-400" />
            <span className="text-xs font-extrabold text-white">Click to Select Cadastral Zone</span>
          </div>
          <code className="text-[0.75rem] font-mono text-amber-300 block mt-1">{hoveredUnitId}</code>
        </div>
      )}

      {/* Tech Stack Badge Footer */}
      <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-white/10 px-3 py-1.5 rounded-full text-xs text-gray-300">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
        <span className="font-semibold text-amber-400">Three.js Procedural Architectural Studio</span> + <span className="text-blue-400">PBR Materials</span>
      </div>
    </div>
  );
}
