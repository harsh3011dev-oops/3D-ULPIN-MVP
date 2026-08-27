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
    scene.fog = new THREE.FogExp2(0x090d16, 0.01);
    sceneRef.current = scene;

    // 2. Camera Setup - Positioned comfortably to view the full building
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(24, 18, 24);
    cameraRef.current = camera;

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

    // 4. OrbitControls with Target centered on Building Mid-Height
    const totalFloors = building?.floor_count || 4;
    const buildingHeight = totalFloors * 1.8;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, buildingHeight / 2, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.01;
    controls.minDistance = 8;
    controls.maxDistance = 100;
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
    sunLight.position.set(30, 50, 25);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    const cyanLight = new THREE.PointLight(0x00f0ff, 2.5, 60);
    cyanLight.position.set(-20, 30, -20);
    scene.add(cyanLight);

    // 6. Ground Grid & Base Platform
    const gridHelper = new THREE.GridHelper(50, 30, 0x3b82f6, 0x1f2937);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a101d, roughness: 0.8 });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 7. Calculate Bounding Box of GeoJSON coordinates to scale nicely into 3D view
    const units = building?.units || [];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

    const rawGpsToMeter = (lng: number, lat: number) => {
      const rx = (lng - centerLng) * 111000 * Math.cos(centerLat * (Math.PI / 180));
      const rz = -(lat - centerLat) * 111000;
      return [rx, rz];
    };

    units.forEach((unit) => {
      const coords = unit.polygon_2d?.coordinates?.[0] || [];
      coords.forEach(([lng, lat]) => {
        const [rx, rz] = rawGpsToMeter(lng, lat);
        if (rx < minX) minX = rx;
        if (rx > maxX) maxX = rx;
        if (rz < minZ) minZ = rz;
        if (rz > maxZ) maxZ = rz;
      });
    });

    const bboxWidth = (maxX - minX) || 10;
    const bboxDepth = (maxZ - minZ) || 10;
    const targetSize = 10; // Normalized 10-meter size for comfortable 3D viewport viewing
    const scaleFactor = targetSize / Math.max(bboxWidth, bboxDepth);

    const gpsToMeter = (lng: number, lat: number) => {
      const [rx, rz] = rawGpsToMeter(lng, lat);
      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;
      return [(rx - cx) * scaleFactor, (rz - cz) * scaleFactor];
    };

    // 8. Extrude REAL GeoJSON Polygon Geometry for Each Unit
    const unitMap = new Map<string, THREE.Mesh>();

    units.forEach((unit) => {
      const isFloorVisible = selectedFloor === null || selectedFloor === unit.floor_number;
      if (!isFloorVisible) return;

      const floorNum = unit.floor_number;
      const height = 1.65; // Fixed height per floor layer
      const yPos = (floorNum - 1) * 1.8; // Elevation spacing

      // Extract real polygon coordinates
      const coords = unit.polygon_2d?.coordinates?.[0] || [
        [centerLng - 0.0002, centerLat - 0.0002],
        [centerLng + 0.0002, centerLat - 0.0002],
        [centerLng + 0.0002, centerLat + 0.0002],
        [centerLng - 0.0002, centerLat + 0.0002]
      ];

      // Create 2D Shape from scaled boundary coordinates
      const shape = new THREE.Shape();
      coords.forEach(([lng, lat], idx) => {
        const [x, z] = gpsToMeter(lng, lat);
        if (idx === 0) shape.moveTo(x, z);
        else shape.lineTo(x, z);
      });

      const extrudeSettings = {
        depth: height,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.05,
        bevelThickness: 0.05
      };

      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      geometry.rotateX(Math.PI / 2); // Rotate to horizontal plane

      const baseColor = FLOOR_HEX_COLORS[(floorNum - 1) % FLOOR_HEX_COLORS.length];
      const isSelected = selectedUnit?.unit_id === unit.unit_id;

      // Architectural Glass PBR Material
      const material = new THREE.MeshPhysicalMaterial({
        color: isSelected ? 0x00f0ff : baseColor,
        metalness: 0.2,
        roughness: 0.2,
        transmission: 0.3,
        transparent: true,
        opacity: isSelected ? 0.95 : 0.85,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        reflectivity: 0.9,
        wireframe: wireframeMode,
        emissive: isSelected ? 0x00f0ff : 0x000000,
        emissiveIntensity: isSelected ? 0.8 : 0.0,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = yPos + height;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { unit };

      // Edges geometry
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

    // 9. Raycasting & Mouse Interaction
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

    // 10. Animation Loop
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

        <button
          className="toolbar-btn w-9 h-9 rounded-md flex items-center justify-center bg-slate-800/80 border border-white/10 text-gray-300 hover:bg-blue-600 hover:text-white transition-all shadow-md"
          onClick={handleZoomIn}
          title="Zoom In"
        >
          <ZoomIn size={18} />
        </button>

        <button
          className="toolbar-btn w-9 h-9 rounded-md flex items-center justify-center bg-slate-800/80 border border-white/10 text-gray-300 hover:bg-blue-600 hover:text-white transition-all shadow-md"
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          <ZoomOut size={18} />
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
            Studio Scale Centered: {centerLat.toFixed(5)}°N, {centerLng.toFixed(5)}°E
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
        <span className="font-semibold text-cyan-400">Three.js Scaled Studio View</span> + <span className="text-blue-400">PBR Facade</span>
      </div>
    </div>
  );
}
