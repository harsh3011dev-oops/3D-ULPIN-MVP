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

  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [hoveredUnitId, setHoveredUnitId] = useState<string | null>(null);

  const isTajMahal = building?.parcel_id?.includes('TAJMAHAL') || building?.building_id?.includes('tajmahal');
  const firstUnit = building?.units?.[0];
  const centerLng = firstUnit?.centroid?.[1] || 78.0421;
  const centerLat = firstUnit?.centroid?.[0] || 27.1751;

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight || 520;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.008);
    sceneRef.current = scene;

    // 2. Camera Setup
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 1000);
    camera.position.set(28, 20, 28);
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
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, isTajMahal ? 5.5 : 3.5, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.01;
    controls.minDistance = 8;
    controls.maxDistance = 100;
    controlsRef.current = controls;

    // 5. Warm Sun Light & Realistic Sky Lighting
    const ambientLight = new THREE.AmbientLight(0xfff8ed, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.2);
    sunLight.position.set(35, 55, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);

    const softFillLight = new THREE.DirectionalLight(0x90caf9, 0.8);
    softFillLight.position.set(-30, 20, -30);
    scene.add(softFillLight);

    // 6. Ground Reflective Platform & Garden Grid
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

    // White Ivory Marble Material for Taj Mahal
    const marbleMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf7f5f0,
      roughness: 0.18,
      metalness: 0.05,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
      reflectivity: 0.95,
      wireframe: wireframeMode,
    });

    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.9,
      roughness: 0.2,
      wireframe: wireframeMode,
    });

    if (isTajMahal) {
      // ==========================================
      // REALISTIC TAJ MAHAL 3D ARCHITECTURAL MODEL
      // ==========================================

      // A. Main Plinth Platform Base
      const plinthGeo = new THREE.BoxGeometry(16, 1.4, 16);
      const plinthMesh = new THREE.Mesh(plinthGeo, marbleMaterial);
      plinthMesh.position.y = 0.7;
      plinthMesh.castShadow = true;
      plinthMesh.receiveShadow = true;
      scene.add(plinthMesh);

      // B. Main Mausoleum Building Block (Square with chamfered corners)
      const mainBuildingGeo = new THREE.BoxGeometry(10, 6.5, 10);
      const mainBuildingMesh = new THREE.Mesh(mainBuildingGeo, marbleMaterial);
      mainBuildingMesh.position.y = 4.65;
      mainBuildingMesh.castShadow = true;
      mainBuildingMesh.receiveShadow = true;
      scene.add(mainBuildingMesh);

      // Main Entrance Arched Iwans (Recessed alcoves on 4 sides)
      const iwanGeo = new THREE.BoxGeometry(4.5, 4.2, 0.4);
      const iwanMat = new THREE.MeshStandardMaterial({ color: 0xe6e1d5, roughness: 0.4 });
      [
        { pos: [0, 4.4, 5.01] },
        { pos: [0, 4.4, -5.01] },
        { pos: [5.01, 4.4, 0], rot: Math.PI / 2 },
        { pos: [-5.01, 4.4, 0], rot: Math.PI / 2 }
      ].forEach((iwan) => {
        const m = new THREE.Mesh(iwanGeo, iwanMat);
        m.position.set(iwan.pos[0], iwan.pos[1], iwan.pos[2]);
        if (iwan.rot) m.rotation.y = iwan.rot;
        scene.add(m);
      });

      // C. Central Onion Dome & Drum
      const drumGeo = new THREE.CylinderGeometry(2.6, 2.6, 2.2, 32);
      const drumMesh = new THREE.Mesh(drumGeo, marbleMaterial);
      drumMesh.position.y = 8.8;
      drumMesh.castShadow = true;
      scene.add(drumMesh);

      // Main Bulbous Dome
      const domeGeo = new THREE.SphereGeometry(3.0, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.72);
      const domeMesh = new THREE.Mesh(domeGeo, marbleMaterial);
      domeMesh.position.y = 9.8;
      domeMesh.castShadow = true;
      scene.add(domeMesh);

      // Golden Spire / Finial
      const finialGeo = new THREE.CylinderGeometry(0.04, 0.18, 2.2, 16);
      const finialMesh = new THREE.Mesh(finialGeo, goldMaterial);
      finialMesh.position.y = 12.8;
      scene.add(finialMesh);

      const crescentGeo = new THREE.SphereGeometry(0.35, 16, 16);
      const crescentMesh = new THREE.Mesh(crescentGeo, goldMaterial);
      crescentMesh.position.y = 13.9;
      scene.add(crescentMesh);

      // D. 4 Corner Minaret Towers
      const minaretCoords = [
        [7.0, 7.0],
        [-7.0, 7.0],
        [7.0, -7.0],
        [-7.0, -7.0]
      ];

      minaretCoords.forEach(([x, z]) => {
        // Tower Shaft
        const shaftGeo = new THREE.CylinderGeometry(0.45, 0.6, 12, 24);
        const shaftMesh = new THREE.Mesh(shaftGeo, marbleMaterial);
        shaftMesh.position.set(x, 7.4, z);
        shaftMesh.castShadow = true;
        scene.add(shaftMesh);

        // Balcony Rings
        [4.0, 8.0, 12.0].forEach((ringY) => {
          const ringGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.3, 24);
          const ringMesh = new THREE.Mesh(ringGeo, marbleMaterial);
          ringMesh.position.set(x, ringY, z);
          scene.add(ringMesh);
        });

        // Top Cupola Dome
        const cupolaDrumGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.8, 16);
        const cupolaDrumMesh = new THREE.Mesh(cupolaDrumGeo, marbleMaterial);
        cupolaDrumMesh.position.set(x, 13.8, z);
        scene.add(cupolaDrumMesh);

        const cupolaDomeGeo = new THREE.SphereGeometry(0.65, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.7);
        const cupolaDomeMesh = new THREE.Mesh(cupolaDomeGeo, marbleMaterial);
        cupolaDomeMesh.position.set(x, 14.3, z);
        scene.add(cupolaDomeMesh);

        const cupolaSpireGeo = new THREE.CylinderGeometry(0.02, 0.08, 0.8);
        const cupolaSpireMesh = new THREE.Mesh(cupolaSpireGeo, goldMaterial);
        cupolaSpireMesh.position.set(x, 15.0, z);
        scene.add(cupolaSpireMesh);
      });

      // E. Map 3D Units to Taj Mahal Levels (Interactive Cadastral Units)
      units.forEach((unit) => {
        const floorNum = unit.floor_number;
        const isSelected = selectedUnit?.unit_id === unit.unit_id;
        const levelY = (floorNum - 1) * 2.2 + 1.2;

        const levelGeo = new THREE.BoxGeometry(10.2, 0.6, 10.2);
        const levelMat = new THREE.MeshStandardMaterial({
          color: isSelected ? 0x00f0ff : 0x3b82f6,
          transparent: true,
          opacity: isSelected ? 0.9 : 0.25,
          emissive: isSelected ? 0x00f0ff : 0x000000,
          emissiveIntensity: isSelected ? 0.8 : 0.0,
          wireframe: wireframeMode,
        });

        const levelMesh = new THREE.Mesh(levelGeo, levelMat);
        levelMesh.position.y = levelY;
        levelMesh.userData = { unit };
        scene.add(levelMesh);
        unitMap.set(unit.unit_id, levelMesh);
      });

    } else {
      // Standard Building Extrusion for other presets
      units.forEach((unit) => {
        const isFloorVisible = selectedFloor === null || selectedFloor === unit.floor_number;
        if (!isFloorVisible) return;

        const floorNum = unit.floor_number;
        const height = 1.65;
        const yPos = (floorNum - 1) * 1.8;

        const coords = unit.polygon_2d?.coordinates?.[0] || [
          [centerLng - 0.0002, centerLat - 0.0002],
          [centerLng + 0.0002, centerLat - 0.0002],
          [centerLng + 0.0002, centerLat + 0.0002],
          [centerLng - 0.0002, centerLat + 0.0002]
        ];

        const shape = new THREE.Shape();
        coords.forEach(([lng, lat], idx) => {
          const x = (lng - centerLng) * 15000;
          const z = -(lat - centerLat) * 15000;
          if (idx === 0) shape.moveTo(x, z);
          else shape.lineTo(x, z);
        });

        const extrudeSettings = { depth: height, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.05, bevelThickness: 0.05 };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.rotateX(Math.PI / 2);

        const baseColor = FLOOR_HEX_COLORS[(floorNum - 1) % FLOOR_HEX_COLORS.length];
        const isSelected = selectedUnit?.unit_id === unit.unit_id;

        const material = new THREE.MeshPhysicalMaterial({
          color: isSelected ? 0x00f0ff : baseColor,
          metalness: 0.2,
          roughness: 0.2,
          transmission: 0.3,
          transparent: true,
          opacity: isSelected ? 0.95 : 0.85,
          clearcoat: 1.0,
          wireframe: wireframeMode,
          emissive: isSelected ? 0x00f0ff : 0x000000,
          emissiveIntensity: isSelected ? 0.8 : 0.0,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = yPos + height;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = { unit };

        scene.add(mesh);
        unitMap.set(unit.unit_id, mesh);
      });
    }

    unitMeshesRef.current = unitMap;

    // 7. Raycasting & Mouse Interaction
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

    // 8. Animation Loop
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
    <div className="map3d-wrapper relative w-full h-full min-h-[520px] bg-[#0a0f1d] rounded-xl overflow-hidden shadow-2xl">
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
        <div className="w-7 h-7 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center">
          <MapPin size={16} />
        </div>
        <div className="flex flex-col">
          <span className="text-[0.78rem] font-bold text-white leading-tight">
            {building?.building_name || 'Taj Mahal World Heritage'}
          </span>
          <span className="text-[0.68rem] font-mono text-amber-300">
            {isTajMahal ? 'Authentic Architectural 3D Model: Agra (+27.1751°N)' : 'Studio Scale Centered'}
          </span>
        </div>
      </div>

      {/* Hover Info Badge */}
      {hoveredUnitId && (
        <div className="absolute bottom-16 left-4 z-10 glass-panel p-3 border border-cyan-500/40 bg-slate-900/90 shadow-glow rounded-lg">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-cyan-400" />
            <span className="text-xs font-extrabold text-white">Click to Select Cadastral Zone</span>
          </div>
          <code className="text-[0.75rem] font-mono text-cyan-300 block mt-1">{hoveredUnitId}</code>
        </div>
      )}

      {/* Tech Stack Badge Footer */}
      <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-white/10 px-3 py-1.5 rounded-full text-xs text-gray-300">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
        <span className="font-semibold text-amber-300">Three.js Authentic Taj Mahal 3D Studio</span> + <span className="text-blue-400">Ivory Marble & Gold Spire</span>
      </div>
    </div>
  );
}
