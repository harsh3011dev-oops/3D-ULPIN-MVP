import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Building, Unit } from '../../types';
import { RotateCw, Sparkles, Layers, MapPin } from 'lucide-react';
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
  const unitMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());

  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);

  const firstUnit = building?.units?.[0];
  const centerLng = firstUnit?.centroid?.[1] || 77.0495;
  const centerLat = firstUnit?.centroid?.[0] || 28.5925;

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight || 520;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090d16);
    scene.fog = new THREE.FogExp2(0x090d16, 0.012);
    sceneRef.current = scene;

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(35, 30, 35);

    // 3. Renderer Setup
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

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 10;
    controls.maxDistance = 120;
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.6);
    sunLight.position.set(40, 60, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    const cyanLight = new THREE.PointLight(0x00f0ff, 2.0, 50);
    cyanLight.position.set(-20, 25, -20);
    scene.add(cyanLight);

    // 6. Ground Grid & Real Footprint Boundary Ring
    const gridHelper = new THREE.GridHelper(80, 40, 0x3b82f6, 0x1f2937);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // 7. Extrude REAL GeoJSON Polygon Geometry for Each Unit
    const unitMap = new Map<string, THREE.Mesh>();
    const units = building?.units || [];

    // Helper: Convert [lng, lat] to local meter offsets relative to parcel center
    const gpsToMeter = (lng: number, lat: number) => {
      const x = (lng - centerLng) * 111000 * Math.cos(centerLat * (Math.PI / 180)) * 1.5;
      const z = -(lat - centerLat) * 111000 * 1.5;
      return [x, z];
    };

    units.forEach((unit) => {
      const isFloorVisible = selectedFloor === null || selectedFloor === unit.floor_number;
      if (!isFloorVisible) return;

      const floorNum = unit.floor_number;
      const height = (unit.z_max - unit.z_min) * 2.0; // Scale height for 3D visual prominence
      const yMin = unit.z_min * 2.0;

      // Extract real polygon coordinates
      const coords = unit.polygon_2d?.coordinates?.[0] || [
        [centerLng - 0.0002, centerLat - 0.0002],
        [centerLng + 0.0002, centerLat - 0.0002],
        [centerLng + 0.0002, centerLat + 0.0002],
        [centerLng - 0.0002, centerLat + 0.0002]
      ];

      // Create 2D Shape from real boundary coordinates
      const shape = new THREE.Shape();
      coords.forEach(([lng, lat], idx) => {
        const [x, z] = gpsToMeter(lng, lat);
        if (idx === 0) shape.moveTo(x, z);
        else shape.lineTo(x, z);
      });

      // Extrude 3D Geometry directly from real GeoJSON Shape
      const extrudeSettings = {
        depth: height - 0.15,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.1,
        bevelThickness: 0.1
      };

      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geometry.rotateX(Math.PI / 2); // Rotate to horizontal ground plane

      const baseColor = FLOOR_HEX_COLORS[(floorNum - 1) % FLOOR_HEX_COLORS.length];
      const isSelected = selectedUnit?.unit_id === unit.unit_id;

      // Realistic Architectural PBR Facade Material
      const material = new THREE.MeshPhysicalMaterial({
        color: isSelected ? 0x00f0ff : baseColor,
        metalness: 0.15,
        roughness: 0.2,
        transmission: 0.35,
        transparent: true,
        opacity: isSelected ? 0.95 : 0.85,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        reflectivity: 0.9,
        wireframe: wireframeMode,
        emissive: isSelected ? 0x00f0ff : 0x000000,
        emissiveIntensity: isSelected ? 0.7 : 0.0,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = yMin + height;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { unit };

      // Add Edge Lines
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

    // 8. Raycasting & Hover Interaction
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
      <div ref={mountRef} className="w-full h-full min-h-[520px]" />

      {/* Floating Controls */}
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

      {/* Location Banner Header */}
      <div className="location-banner-header glass-panel absolute top-4 left-4 p-2.5 z-10 flex items-center gap-2.5 bg-slate-900/90 backdrop-blur rounded-lg border-blue-500/40">
        <div className="w-7 h-7 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center justify-center">
          <MapPin size={16} />
        </div>
        <div className="flex flex-col">
          <span className="text-[0.78rem] font-bold text-white leading-tight">
            {building?.building_name || 'Cadastral Parcel'}
          </span>
          <span className="text-[0.68rem] font-mono text-cyan-300">
            Real Extrusion GeoJSON: {centerLat.toFixed(5)}°N, {centerLng.toFixed(5)}°E
          </span>
        </div>
      </div>

      {/* Hover Info Badge */}
      {hoveredUnitId && (
        <div className="absolute bottom-16 left-4 z-10 glass-panel p-3 border border-cyan-500/40 bg-slate-900/90 shadow-glow rounded-lg">
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
        <span className="font-semibold text-cyan-400">Three.js GeoJSON Extrusion</span> + <span className="text-blue-400">PBR Facade</span>
      </div>
    </div>
  );
}
