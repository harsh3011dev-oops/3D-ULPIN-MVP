import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Building, Unit } from '../../types';
import { RotateCw, Eye, Sparkles, Layers, Box } from 'lucide-react';
import './Map3D.css';

interface MapThreeJSProps {
  building: Building;
  selectedUnit: Unit | null;
  onUnitClick: (unit: Unit) => void;
  selectedFloor: number | null;
}

const FLOOR_HEX_COLORS = [
  0x3b82f6, // Blue
  0x10b981, // Emerald
  0xf59e0b, // Amber
  0x8b5cf6, // Purple
  0x06b6d4, // Cyan
  0xec4899, // Pink
];

export default function MapThreeJS({ building, selectedUnit, onUnitClick, selectedFloor }: MapThreeJSProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const unitMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());

  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight || 520;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);
    scene.fog = new THREE.FogExp2(0x090d16, 0.015);
    sceneRef.current = scene;

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(28, 22, 28);

    // 3. Renderer Setup with Shadows & Anti-Aliasing
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls Setup
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below ground
    controls.minDistance = 10;
    controls.maxDistance = 80;
    controlsRef.current = controls;

    // 5. Lighting System
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(30, 50, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);

    const cyanRimLight = new THREE.PointLight(0x00f0ff, 2.5, 40);
    cyanRimLight.position.set(-15, 20, -15);
    scene.add(cyanRimLight);

    const blueRimLight = new THREE.PointLight(0x3b82f6, 2.0, 40);
    blueRimLight.position.set(15, 10, 15);
    scene.add(blueRimLight);

    // 6. Ground Grid & Glowing Base Platform
    const gridHelper = new THREE.GridHelper(60, 40, 0x3b82f6, 0x1f2937);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0c1322,
      roughness: 0.8,
      metalness: 0.2,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Ground Parcel Outline Glow Ring
    const ringGeo = new THREE.RingGeometry(11.8, 12.0, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.02;
    scene.add(ringMesh);

    // 7. Render Building Units in 3D Studio Space
    const unitMap = new Map<string, THREE.Mesh>();
    const totalFloors = building?.floor_count || 4;
    const units = building?.units || [];

    // Scale units into 3D Studio view box
    units.forEach((unit) => {
      const isFloorVisible = selectedFloor === null || selectedFloor === unit.floor_number;
      if (!isFloorVisible) return;

      const floorNum = unit.floor_number;
      const height = (unit.z_max - unit.z_min) * 1.2;
      const yPos = unit.z_min * 1.2 + height / 2;

      // Determine 2D offset based on unit index in floor
      const unitIdx = parseInt(unit.unit_id.split('_').pop() || '1', 10);
      const xOffset = (unitIdx % 2 === 1 ? -1 : 1) * 3.2;
      const zOffset = (unitIdx <= 2 ? -1 : 1) * 3.2;

      const geometry = new THREE.BoxGeometry(6.0, height - 0.2, 6.0);
      
      const baseColor = FLOOR_HEX_COLORS[(floorNum - 1) % FLOOR_HEX_COLORS.length];
      const isSelected = selectedUnit?.unit_id === unit.unit_id;

      // Realistic Architectural Glass/Facade Material
      const material = new THREE.MeshPhysicalMaterial({
        color: isSelected ? 0x00f0ff : baseColor,
        metalness: 0.1,
        roughness: 0.2,
        transmission: 0.4, // Glass translucency
        transparent: true,
        opacity: isSelected ? 0.95 : 0.85,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        reflectivity: 0.9,
        wireframe: wireframeMode,
        emissive: isSelected ? 0x00f0ff : 0x000000,
        emissiveIntensity: isSelected ? 0.6 : 0.0,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(xOffset, yPos, zOffset);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { unit };

      // Add Glowing Neon Edges to Mesh
      const edgesGeo = new THREE.EdgesGeometry(geometry);
      const edgesMat = new THREE.LineBasicMaterial({
        color: isSelected ? 0xffffff : 0x60a5fa,
        linewidth: isSelected ? 2 : 1,
      });
      const edgesMesh = new THREE.LineSegments(edgesGeo, edgesMat);
      mesh.add(edgesMesh);

      scene.add(mesh);
      unitMap.set(unit.unit_id, mesh);
    });

    unitMeshesRef.current = unitMap;

    // 8. Raycasting for Mouse Interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(Array.from(unitMap.values()));

      if (intersects.length > 0) {
        const hoveredMesh = intersects[0].object as THREE.Mesh;
        const u = hoveredMesh.userData.unit as Unit;
        setHoveredUnitId(u.unit_id);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHoveredUnitId(null);
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const handleClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
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

    // 9. Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      if (autoRotate) {
        scene.rotation.y += 0.005;
      } else {
        scene.rotation.y = 0;
      }

      renderer.render(scene, camera);
    };
    animate();

    // Resize Handler
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      domElem.removeEventListener('pointermove', handlePointerMove);
      domElem.removeEventListener('click', handleClick);
      renderer.dispose();
    };
  }, [building, selectedUnit, selectedFloor, wireframeMode, autoRotate]);

  return (
    <div className="map3d-wrapper relative w-full h-full min-h-[520px] bg-[#090d16] rounded-xl overflow-hidden shadow-2xl">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="w-full h-full min-h-[520px]" />

      {/* Floating Toolbar Controls */}
      <div className="map-toolbar glass-panel absolute top-4 right-4 flex flex-col gap-2 p-2 z-10">
        <button
          className={`toolbar-btn w-9 h-9 rounded-md flex items-center justify-center border transition-all shadow-md ${
            autoRotate ? 'bg-blue-600 border-blue-400 text-white shadow-glow' : 'bg-slate-800/80 border-white/10 text-gray-300 hover:bg-blue-600 hover:text-white'
          }`}
          onClick={() => setAutoRotate(!autoRotate)}
          title="Toggle 360° Studio Auto-Rotation"
        >
          <RotateCw size={18} className={autoRotate ? 'animate-spin' : ''} />
        </button>

        <button
          className={`toolbar-btn w-9 h-9 rounded-md flex items-center justify-center border transition-all shadow-md ${
            wireframeMode ? 'bg-cyan-600 border-cyan-400 text-white shadow-glow' : 'bg-slate-800/80 border-white/10 text-gray-300 hover:bg-blue-600 hover:text-white'
          }`}
          onClick={() => setWireframeMode(!wireframeMode)}
          title="Toggle Wireframe Architectural Mode"
        >
          <Layers size={18} />
        </button>
      </div>

      {/* Hover Info Badge */}
      {hoveredUnitId && (
        <div className="absolute top-4 left-4 z-10 glass-panel p-3 border border-cyan-500/40 bg-slate-900/90 shadow-glow rounded-lg">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-cyan-400" />
            <span className="text-xs font-extrabold text-white">Click to Select Unit</span>
          </div>
          <code className="text-[0.75rem] font-mono text-cyan-300 block mt-1">{hoveredUnitId}</code>
        </div>
      )}

      {/* Tech Stack Badge Footer */}
      <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-white/10 px-3 py-1.5 rounded-full text-xs text-gray-300">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
        <span className="font-semibold text-cyan-400">Three.js Realistic 3D Studio</span> + <span className="text-blue-400">PBR Glass</span>
      </div>
    </div>
  );
}
