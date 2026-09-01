import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Building, Unit } from '../../types';
import {
  getBuildingCenter,
  getBuildingHeight,
  getFloorHeight,
  getFootprintDimensions,
  getUnitFloor,
  footprintToShape,
} from '../../utils/footprintUtils';
import { RotateCw, Layers, MapPin, ZoomIn, ZoomOut } from 'lucide-react';
import './Map3D.css';

interface MapThreeJSProps {
  building: Building;
  selectedUnit: Unit | null;
  onUnitClick: (unit: Unit) => void;
  selectedFloor: number | null;
}

const FLOOR_HEX_COLORS = [
  0x6366f1,
  0x3b82f6,
  0x10b981,
  0xf59e0b,
  0xec4899,
  0x8b5cf6,
];

function buildExtrudedBuilding(
  scene: THREE.Scene,
  building: Building,
  glassMaterial: THREE.MeshPhysicalMaterial,
  steelMaterial: THREE.MeshStandardMaterial,
): { width: number; depth: number; height: number } {
  const dims = getFootprintDimensions(building.footprint);
  const heightM = getBuildingHeight(building);
  const podiumHeight = Math.min(3, heightM * 0.05);

  const podiumMesh = new THREE.Mesh(
    new THREE.BoxGeometry(dims.width * 1.05, podiumHeight, dims.depth * 1.05),
    steelMaterial,
  );
  podiumMesh.position.y = podiumHeight / 2;
  podiumMesh.castShadow = true;
  podiumMesh.receiveShadow = true;
  scene.add(podiumMesh);

  const shape = building.footprint ? footprintToShape(building.footprint) : null;

  if (shape) {
    const bodyGeo = new THREE.ExtrudeGeometry(shape, {
      depth: heightM,
      bevelEnabled: false,
    });
    bodyGeo.rotateX(-Math.PI / 2);
    const bodyMesh = new THREE.Mesh(bodyGeo, glassMaterial);
    bodyMesh.position.y = podiumHeight;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    scene.add(bodyMesh);
  } else {
    const bodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(dims.width, heightM, dims.depth),
      glassMaterial,
    );
    bodyMesh.position.y = podiumHeight + heightM / 2;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    scene.add(bodyMesh);
  }

  const hvacSize = Math.min(dims.width, dims.depth) * 0.25;
  const hvacMesh = new THREE.Mesh(
    new THREE.BoxGeometry(hvacSize, Math.min(2, heightM * 0.02), hvacSize),
    steelMaterial,
  );
  hvacMesh.position.y = podiumHeight + heightM + 1;
  scene.add(hvacMesh);

  return { width: dims.width, depth: dims.depth, height: heightM + podiumHeight };
}

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
  const [, setHoveredUnitId] = useState<string | null>(null);

  const { lat: centerLat, lng: centerLng } = getBuildingCenter(building);

  autoRotateRef.current = autoRotate;

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 520;

    const dims = getFootprintDimensions(building.footprint);
    const buildingHeight = getBuildingHeight(building);
    const floorHeight = getFloorHeight(building);
    const totalFloors = building?.floor_count || 4;
    const maxDim = Math.max(dims.width, dims.depth, 10);
    const sceneExtent = Math.max(maxDim * 3, buildingHeight * 0.5, 50);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080c14);
    scene.fog = new THREE.FogExp2(0x080c14, 0.5 / sceneExtent);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, Math.max(5000, buildingHeight * 6));
    const camDist = Math.max(maxDim * 1.8, buildingHeight * 0.9, 30);
    camera.position.set(camDist, buildingHeight * 0.45 + maxDim * 0.3, camDist);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const targetY = buildingHeight / 2;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, targetY, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = Math.max(6, maxDim * 0.4);
    controls.maxDistance = Math.max(200, buildingHeight * 4, maxDim * 6);
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xfff8f0, 1.4));

    const sunLight = new THREE.DirectionalLight(0xfffbef, 2.5);
    sunLight.position.set(sceneExtent * 0.6, buildingHeight + maxDim, sceneExtent * 0.5);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0001;
    scene.add(sunLight);

    const rimLight = new THREE.PointLight(0x7c6fe0, 3.0, sceneExtent * 2);
    rimLight.position.set(-maxDim, buildingHeight * 0.6, -maxDim);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0xe06f8f, 0.8);
    fillLight.position.set(-sceneExtent * 0.4, buildingHeight * 0.3, sceneExtent * 0.3);
    scene.add(fillLight);

    const gridHelper = new THREE.GridHelper(sceneExtent * 2, 40, 0x7c6fe0, 0x1e293b);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(sceneExtent * 2, sceneExtent * 2),
      new THREE.MeshStandardMaterial({ color: 0x0b1329, roughness: 0.8, metalness: 0.2 }),
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x93c5fd,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.6,
      transparent: true,
      opacity: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      wireframe: wireframeMode,
    });

    const steelMaterial = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.9,
      roughness: 0.2,
      wireframe: wireframeMode,
    });

    const built = buildExtrudedBuilding(scene, building, glassMaterial, steelMaterial);
    const slabW = built.width * 1.02;
    const slabD = built.depth * 1.02;

    const unitMap = new Map<string, THREE.Mesh>();
    const units = building?.units || [];

    units.forEach((unit) => {
      const floorNum = getUnitFloor(unit);
      const levelY = (floorNum - 1) * floorHeight + floorHeight / 2;
      const baseColor = FLOOR_HEX_COLORS[(floorNum - 1) % FLOOR_HEX_COLORS.length];

      const levelMat = new THREE.MeshStandardMaterial({
        color: baseColor,
        transparent: true,
        opacity: 0.4,
        wireframe: wireframeMode,
      });

      const levelMesh = new THREE.Mesh(new THREE.BoxGeometry(slabW, floorHeight * 0.12, slabD), levelMat);
      levelMesh.position.y = levelY;
      levelMesh.userData = { unit, baseColor };
      scene.add(levelMesh);
      unitMap.set(unit.unit_id, levelMesh);

      const slabMesh = new THREE.Mesh(
        new THREE.BoxGeometry(slabW, 0.06, slabD),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 }),
      );
      slabMesh.position.y = levelY - floorHeight * 0.06;
      scene.add(slabMesh);
    });

    unitMeshesRef.current = unitMap;

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
        setHoveredUnitId((intersects[0].object as THREE.Mesh).userData.unit.unit_id);
        rendererRef.current.domElement.style.cursor = 'pointer';
      } else {
        setHoveredUnitId(null);
        rendererRef.current.domElement.style.cursor = 'grab';
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
  }, [building, wireframeMode, onUnitClick]);

  useEffect(() => {
    unitMeshesRef.current.forEach((mesh) => {
      const u = mesh.userData.unit as Unit;
      const isSelected = selectedUnit?.unit_id === u.unit_id;
      const isFloorVisible = selectedFloor === null || selectedFloor === getUnitFloor(u);

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

  const displayHeight = getBuildingHeight(building);

  return (
    <div className="threejs-map-container">
      <div className="threejs-canvas-wrapper" ref={mountRef} />

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

      <div className="location-banner-header absolute top-4 left-4 p-2.5 z-10 flex items-center gap-2.5 bg-slate-900/90 backdrop-blur rounded-lg border border-indigo-500/40 shadow-xl">
        <div className="w-7 h-7 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 flex items-center justify-center">
          <MapPin size={16} />
        </div>
        <div className="flex flex-col">
          <span className="text-[0.78rem] font-bold text-white leading-tight">
            {building?.building_name || building?.address || 'Cadastral Building Model'}
          </span>
          <span className="text-[0.68rem] font-mono text-indigo-300">
            {centerLat.toFixed(5)}°N, {centerLng.toFixed(5)}°E • {displayHeight.toFixed(1)}m ({building?.floor_count || totalFloorsFromBuilding(building)} Floors)
          </span>
        </div>
      </div>

      <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-white/10 px-3 py-1.5 rounded-full text-xs text-gray-300">
        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
        <span className="font-semibold text-indigo-300">Three.js — AI Footprint Extrusion</span>
      </div>
    </div>
  );
}

function totalFloorsFromBuilding(building: Building): number {
  return building.floor_count || 4;
}
