import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RotateCw, ZoomIn, ZoomOut, Eye, Layers, Compass, Maximize2 } from 'lucide-react';
import './Map3D.css';

export default function Map3D({ building, selectedUnit, onUnitClick, selectedFloor }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const meshesGroupRef = useRef(null);

  const [hoveredUnit, setHoveredUnit] = useState(null);
  const [wireframeMode, setWireframeMode] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);

  // Distinct Floor Colors for 3D volumetric layers
  const FLOOR_COLORS = [
    0x3B82F6, // Blue - Floor 1
    0x10B981, // Emerald Green - Floor 2
    0xF59E0B, // Amber - Floor 3
    0x8B5CF6, // Purple - Floor 4
    0x06B6D4, // Cyan - Floor 5
    0xEC4899, // Pink - Floor 6
  ];

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.008);
    sceneRef.current = scene;

    // 2. Camera setup
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(45, 40, 55);
    cameraRef.current = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Clear previous canvas
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Don't go below ground
    controls.minDistance = 10;
    controls.maxDistance = 180;
    controlsRef.current = controls;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(50, 80, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.bias = -0.0001;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    fillLight.position.set(-40, 30, -40);
    scene.add(fillLight);

    // 6. Cadastral Ground Plane & Grid
    const gridHelper = new THREE.GridHelper(120, 40, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // Ground Plot Base
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    scene.add(ground);

    // Parcel Boundary Ribbon Ring
    const boundaryGeo = new THREE.RingGeometry(24.5, 25, 64);
    const boundaryMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide });
    const boundaryRing = new THREE.Mesh(boundaryGeo, boundaryMat);
    boundaryRing.rotation.x = -Math.PI / 2;
    boundaryRing.position.y = 0.05;
    scene.add(boundaryRing);

    // Container for building meshes
    const meshesGroup = new THREE.Group();
    scene.add(meshesGroup);
    meshesGroupRef.current = meshesGroup;

    // 7. Animation Loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.autoRotate = autoRotate;
        controlsRef.current.update();
      }
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // 8. Handle Resize
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
    };
  }, []);

  // Update Mesh Objects whenever building or selectedFloor/selectedUnit changes
  useEffect(() => {
    if (!meshesGroupRef.current || !building?.units) return;

    const group = meshesGroupRef.current;
    // Clear previous building meshes
    while (group.children.length > 0) {
      const child = group.children[0];
      if (child.geometry) child.geometry.dispose();
      group.remove(child);
    }

    const units = building.units;

    // Generate 3D Box/Extrusions for units
    units.forEach((unit) => {
      const floorNum = unit.floor_number || 1;
      const isFloorVisible = selectedFloor === null || selectedFloor === floorNum;
      if (!isFloorVisible) return;

      const height = unit.z_max - unit.z_min;
      const yPos = unit.z_min + height / 2;

      // Map unit centroid / coordinates to 3D Local Scene Space
      // Convert lat/lng offset or local grid layout
      const coords = unit.polygon_2d?.coordinates?.[0];
      let width = 16;
      let depth = 16;
      let xOffset = 0;
      let zOffset = 0;

      if (coords && coords.length >= 4) {
        // Derive local bounding box sizes from coordinates
        const lngs = coords.map(c => c[0]);
        const lats = coords.map(c => c[1]);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);

        width = Math.max(8, (maxLng - minLng) * 25000);
        depth = Math.max(8, (maxLat - minLat) * 25000);

        // Center calculation
        const cLng = (minLng + maxLng) / 2;
        const cLat = (minLat + maxLat) / 2;

        xOffset = (cLng - 77.0495) * 30000;
        zOffset = (cLat - 28.5925) * 30000;
      }

      const geometry = new THREE.BoxGeometry(width, height, depth);

      const isSelected = selectedUnit && selectedUnit.unit_id === unit.unit_id;
      const baseColor = FLOOR_COLORS[(floorNum - 1) % FLOOR_COLORS.length];

      const material = new THREE.MeshStandardMaterial({
        color: isSelected ? 0x00f0ff : baseColor,
        roughness: 0.3,
        metalness: 0.4,
        transparent: true,
        opacity: isSelected ? 0.95 : 0.8,
        wireframe: wireframeMode,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(xOffset, yPos, zOffset);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { unit };

      // Edges geometry for glowing lines
      const edges = new THREE.EdgesGeometry(geometry);
      const lineMat = new THREE.LineBasicMaterial({
        color: isSelected ? 0xffffff : 0x93c5fd,
        linewidth: isSelected ? 2 : 1,
      });
      const wireframeLines = new THREE.LineSegments(edges, lineMat);
      mesh.add(wireframeLines);

      group.add(mesh);
    });

  }, [building, selectedFloor, selectedUnit, wireframeMode]);

  // Raycasting Raycaster Handler for Hover and Clicks
  const handlePointerMove = (e) => {
    if (!containerRef.current || !cameraRef.current || !meshesGroupRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x, y }, cameraRef.current);

    const intersects = raycaster.intersectObjects(meshesGroupRef.current.children);

    if (intersects.length > 0) {
      const hitUnit = intersects[0].object.userData.unit;
      setHoveredUnit(hitUnit);
      containerRef.current.style.cursor = 'pointer';
    } else {
      setHoveredUnit(null);
      containerRef.current.style.cursor = 'grab';
    }
  };

  const handleClick = (e) => {
    if (!containerRef.current || !cameraRef.current || !meshesGroupRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x, y }, cameraRef.current);

    const intersects = raycaster.intersectObjects(meshesGroupRef.current.children);

    if (intersects.length > 0) {
      const hitUnit = intersects[0].object.userData.unit;
      onUnitClick(hitUnit);
    }
  };

  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
      cameraRef.current.position.set(45, 40, 55);
      controlsRef.current.target.set(0, 7, 0);
      controlsRef.current.update();
    }
  };

  return (
    <div className="map3d-wrapper" id="cesium-globe">
      <div
        ref={containerRef}
        className="map3d-canvas-container"
        onPointerMove={handlePointerMove}
        onClick={handleClick}
      />

      {/* Floating Toolbar Controls */}
      <div className="map-toolbar glass-panel">
        <button
          className={`toolbar-btn ${autoRotate ? 'active' : ''}`}
          onClick={() => setAutoRotate(!autoRotate)}
          title="Auto Rotate Scene"
        >
          <RotateCw size={18} />
        </button>

        <button
          className={`toolbar-btn ${wireframeMode ? 'active' : ''}`}
          onClick={() => setWireframeMode(!wireframeMode)}
          title="Toggle Wireframe Cadastral Structure"
        >
          <Layers size={18} />
        </button>

        <button className="toolbar-btn" onClick={resetCamera} title="Reset Camera View">
          <Compass size={18} />
        </button>
      </div>

      {/* Hover Unit Tooltip Overlay */}
      {hoveredUnit && (
        <div className="unit-hover-tooltip glass-panel fade-in">
          <div className="tooltip-header">
            <span className="tooltip-floor">Level {hoveredUnit.floor_number}</span>
            <span className="tooltip-title">{hoveredUnit.unit_name || hoveredUnit.unit_id}</span>
          </div>
          <code className="tooltip-ulpin">{hoveredUnit.ulpin}</code>
          <div className="tooltip-height">
            <span>Elevation: +{hoveredUnit.z_min}m to +{hoveredUnit.z_max}m</span>
          </div>
        </div>
      )}

      {/* Volumetric Height Metric Overlay */}
      <div className="height-ruler-overlay glass-panel">
        <span className="ruler-title">Max Elevation</span>
        <span className="ruler-val">+{building?.height || 14.0}m</span>
      </div>
    </div>
  );
}
