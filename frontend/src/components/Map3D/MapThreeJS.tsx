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
  FootprintDimensions,
} from '../../utils/footprintUtils';
import { fetchTerrainHeight } from '../../utils/reearth';
import { RotateCw, Layers, MapPin, ZoomIn, ZoomOut, PanelLeft, PanelRight } from 'lucide-react';
import './Map3D.css';

interface MapThreeJSProps {
  building: Building;
  selectedUnit: Unit | null;
  onUnitClick: (unit: Unit) => void;
  selectedFloor: number | null;
  isLeftOpen?: boolean;
  isRightOpen?: boolean;
  onToggleLeft?: () => void;
  onToggleRight?: () => void;
}

const FLOOR_HEX_COLORS = [
  0x6366f1,
  0x3b82f6,
  0x10b981,
  0xf59e0b,
  0xec4899,
  0x8b5cf6,
];

// High-resolution architectural glass curtain wall facade texture generator
function generateBuildingTexture(floors: number) {
  const canvas = document.createElement('canvas');
  const COLS = 8;
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Deep metallic curtain-wall base background
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, 1024, 1024);

    const visibleRows = Math.min(floors, 24);
    const rowH = 1024 / visibleRows;
    const colW = 1024 / COLS;

    for (let j = 0; j < visibleRows; j++) {
      const y = j * rowH;

      // 1. Spandrel Beam (Horizontal aluminum panel between floors)
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, y, 1024, rowH * 0.2);

      // Metallic trim line on spandrel edge
      ctx.fillStyle = '#475569';
      ctx.fillRect(0, y + rowH * 0.2 - 2, 1024, 2);

      // Contact shadow beneath floor slab
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(0, y + rowH * 0.2, 1024, rowH * 0.06);

      // 2. Glass Window Pane Row
      const winY = y + rowH * 0.25;
      const winH = rowH * 0.7;

      for (let i = 0; i < COLS; i++) {
        const x = i * colW + colW * 0.06;
        const winW = colW * 0.88;

        // Window Frame Border (Bronze / Anodized Aluminum)
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x - 2, winY - 2, winW + 4, winH + 4);

        // Realistic Interior Window Lighting Variation
        const seed = (i * 19 + j * 37) % 100;
        if (seed > 80) {
          // Warm Interior Office Light On
          const grad = ctx.createLinearGradient(x, winY, x, winY + winH);
          grad.addColorStop(0, '#fef08a');
          grad.addColorStop(0.7, '#eab308');
          grad.addColorStop(1, '#ca8a04');
          ctx.fillStyle = grad;
        } else if (seed > 60) {
          // Cool Modern LED Office Light On
          const grad = ctx.createLinearGradient(x, winY, x, winY + winH);
          grad.addColorStop(0, '#e0f2fe');
          grad.addColorStop(1, '#38bdf8');
          ctx.fillStyle = grad;
        } else if (seed > 15) {
          // Deep Blue Reflective Architectural Glass
          const grad = ctx.createLinearGradient(x, winY, x + winW, winY + winH);
          grad.addColorStop(0, '#1d4ed8');
          grad.addColorStop(0.4, '#2563eb');
          grad.addColorStop(1, '#0f172a');
          ctx.fillStyle = grad;
        } else {
          // Dark / Unlit Tinted Window
          ctx.fillStyle = '#090d16';
        }
        ctx.fillRect(x, winY, winW, winH);

        // Glass Glare Reflection Diagonal Streak
        ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
        ctx.beginPath();
        ctx.moveTo(x, winY);
        ctx.lineTo(x + winW * 0.35, winY);
        ctx.lineTo(x, winY + winH * 0.65);
        ctx.closePath();
        ctx.fill();

        // Horizontal Window Pane Divider (Mullion line)
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x, winY + winH * 0.5, winW, 2);
      }

      // 3. Vertical Mullion Beams across facade
      for (let i = 0; i <= COLS; i++) {
        ctx.fillStyle = '#334155';
        ctx.fillRect(i * colW - 2, y, 4, rowH);
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, Math.ceil(floors / 6));
  return tex;
}

// Procedural ground plaza texture with stone tiles, green lawn patches & access road
function generatePlazaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Base dark plaza asphalt
    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, 1024, 1024);

    // Stone tile pavement grid
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
    ctx.lineWidth = 2;
    const tileSize = 64;
    for (let x = 0; x < 1024; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y < 1024; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Main plaza paved apron
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(256, 256, 512, 512);

    // Green lawn landscaping patches
    ctx.fillStyle = '#14532d'; // rich emerald grass
    ctx.fillRect(90, 90, 140, 844);
    ctx.fillRect(794, 90, 140, 844);

    // Front asphalt road
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 930, 1024, 94);

    // Dashed center road markings
    ctx.fillStyle = '#94a3b8';
    for (let x = 20; x < 1024; x += 60) {
      ctx.fillRect(x, 975, 35, 4);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Build surrounding context: Ground plaza, lawn gardens, 3D street trees, lamp posts, vehicles
function buildSurroundingContext(scene: THREE.Scene, dims: { width: number; depth: number }, sceneExtent: number) {
  // 1. Ground Plaza Mesh
  const plazaTex = generatePlazaTexture();
  plazaTex.repeat.set(2, 2);
  const groundGeo = new THREE.PlaneGeometry(sceneExtent * 2.5, sceneExtent * 2.5);
  const groundMat = new THREE.MeshStandardMaterial({
    map: plazaTex,
    roughness: 0.75,
    metalness: 0.2,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -0.05;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Materials for urban props
  const treeBarkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
  const treeFoliageMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6, metalness: 0.1 });
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 });
  const lampGlowMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xfef08a, emissiveIntensity: 1.2 });
  const carMat1 = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6, roughness: 0.3 });
  const carMat2 = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.6, roughness: 0.3 });
  const carWheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.9 });

  // 2. 3D Trees surrounding plaza lawns
  const marginX = dims.width / 2 + 6;
  const marginZ = dims.depth / 2 + 6;
  const treePositions = [
    [-marginX - 4, -marginZ],
    [-marginX - 4, 0],
    [-marginX - 4, marginZ],
    [marginX + 4, -marginZ],
    [marginX + 4, 0],
    [marginX + 4, marginZ],
    [-marginX / 2, -marginZ - 5],
    [marginX / 2, -marginZ - 5],
    [-marginX / 2, marginZ + 5],
    [marginX / 2, marginZ + 5],
  ];

  treePositions.forEach(([x, z]) => {
    const treeGroup = new THREE.Group();
    // Trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 3.5, 8), treeBarkMat);
    trunk.position.y = 1.75;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    // Tiered Foliage
    const f1 = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 1), treeFoliageMat);
    f1.position.y = 4.2;
    f1.castShadow = true;
    treeGroup.add(f1);

    const f2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), treeFoliageMat);
    f2.position.y = 5.8;
    f2.castShadow = true;
    treeGroup.add(f2);

    treeGroup.position.set(x, 0, z);
    scene.add(treeGroup);
  });

  // 3. Street Lamp Posts along plaza walkway
  const lampPositions = [
    [-marginX - 1, -marginZ + 2],
    [-marginX - 1, marginZ - 2],
    [marginX + 1, -marginZ + 2],
    [marginX + 1, marginZ - 2],
  ];

  lampPositions.forEach(([x, z]) => {
    const lampGroup = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.2, 8), lampPoleMat);
    pole.position.y = 2.1;
    lampGroup.add(pole);

    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), lampGlowMat);
    globe.position.y = 4.3;
    lampGroup.add(globe);

    lampGroup.position.set(x, 0, z);
    scene.add(lampGroup);
  });

  // 4. Low-Poly Vehicles on Access Road
  const carPositions = [
    { x: -marginX - 2, z: marginZ + 12, mat: carMat1, rot: 0 },
    { x: marginX + 4, z: marginZ + 12, mat: carMat2, rot: Math.PI },
  ];

  carPositions.forEach(({ x, z, mat, rot }) => {
    const car = new THREE.Group();
    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 4.2), mat);
    body.position.y = 0.65;
    body.castShadow = true;
    car.add(body);

    // Cabin
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.75, 2.2),
      new THREE.MeshPhysicalMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.9 }),
    );
    cabin.position.set(0, 1.35, -0.2);
    cabin.castShadow = true;
    car.add(cabin);

    // Wheels
    const wGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
    wGeo.rotateZ(Math.PI / 2);
    [[-1, 0.35, 1.2], [1, 0.35, 1.2], [-1, 0.35, -1.2], [1, 0.35, -1.2]].forEach(([wx, wy, wz]) => {
      const w = new THREE.Mesh(wGeo, carWheelMat);
      w.position.set(wx, wy, wz);
      car.add(w);
    });

    car.position.set(x, 0, z);
    car.rotation.y = rot;
    scene.add(car);
  });
}

function buildTajMahalModel(
  scene: THREE.Scene,
  dims: FootprintDimensions,
  heightM: number,
): { width: number; depth: number; height: number } {
  const plinthW = Math.max(dims.width * 1.4, 85);
  const plinthD = Math.max(dims.depth * 1.4, 85);
  const plinthH = 5.5;

  // Materials
  const marbleMat = new THREE.MeshPhysicalMaterial({
    color: 0xfafafa,
    roughness: 0.16,
    metalness: 0.04,
    clearcoat: 0.9,
    clearcoatRoughness: 0.08,
    reflectivity: 0.95,
  });

  const marbleDarkMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
  });

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.95,
    roughness: 0.15,
  });

  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.35,
  });

  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7,
    transmission: 0.9,
    transparent: true,
    opacity: 0.85,
    roughness: 0.05,
  });

  // 1. Marble Plinth Platform
  const plinthMesh = new THREE.Mesh(
    new THREE.BoxGeometry(plinthW, plinthH, plinthD),
    plinthMat,
  );
  plinthMesh.position.y = plinthH / 2;
  plinthMesh.castShadow = true;
  plinthMesh.receiveShadow = true;
  scene.add(plinthMesh);

  // 2. Main Mausoleum Chamfered Octagon Body
  const tombW = Math.min(dims.width, 56);
  const tombD = Math.min(dims.depth, 56);
  const tombH = 34;
  const chamfer = 9.0;

  const tombShape = new THREE.Shape();
  const hw = tombW / 2;
  const hd = tombD / 2;
  tombShape.moveTo(-hw + chamfer, -hd);
  tombShape.lineTo(hw - chamfer, -hd);
  tombShape.lineTo(hw, -hd + chamfer);
  tombShape.lineTo(hw, hd - chamfer);
  tombShape.lineTo(hw - chamfer, hd);
  tombShape.lineTo(-hw + chamfer, hd);
  tombShape.lineTo(-hw, hd - chamfer);
  tombShape.lineTo(-hw, -hd + chamfer);
  tombShape.closePath();

  const tombGeo = new THREE.ExtrudeGeometry(tombShape, {
    depth: tombH,
    bevelEnabled: false,
  });
  tombGeo.rotateX(-Math.PI / 2);

  const tombMesh = new THREE.Mesh(tombGeo, marbleMat);
  tombMesh.position.y = plinthH;
  tombMesh.castShadow = true;
  tombMesh.receiveShadow = true;
  scene.add(tombMesh);

  // 4 Grand Pishtaq Arches (North, South, East, West facades)
  const iwanW = tombW * 0.44;
  const iwanH = tombH * 0.74;
  const iwanD = 3.2;
  const iwanGeo = new THREE.BoxGeometry(iwanW, iwanH, iwanD);

  const iwanN = new THREE.Mesh(iwanGeo, marbleDarkMat);
  iwanN.position.set(0, plinthH + iwanH / 2 + 1.2, -hd + iwanD / 2);
  scene.add(iwanN);

  const iwanS = new THREE.Mesh(iwanGeo, marbleDarkMat);
  iwanS.position.set(0, plinthH + iwanH / 2 + 1.2, hd - iwanD / 2);
  scene.add(iwanS);

  const iwanE = new THREE.Mesh(new THREE.BoxGeometry(iwanD, iwanH, iwanW), marbleDarkMat);
  iwanE.position.set(hw - iwanD / 2, plinthH + iwanH / 2 + 1.2, 0);
  scene.add(iwanE);

  const iwanWmesh = new THREE.Mesh(new THREE.BoxGeometry(iwanD, iwanH, iwanW), marbleDarkMat);
  iwanWmesh.position.set(-hw + iwanD / 2, plinthH + iwanH / 2 + 1.2, 0);
  scene.add(iwanWmesh);

  // 3. Central Cylindrical High Drum & Bulbous Onion Dome
  const roofY = plinthH + tombH;
  const drumR = tombW * 0.22;
  const drumH = 9.5;
  const drumMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(drumR, drumR, drumH, 32),
    marbleMat,
  );
  drumMesh.position.set(0, roofY + drumH / 2, 0);
  drumMesh.castShadow = true;
  scene.add(drumMesh);

  // Bulbous Onion Dome Profile using LatheGeometry
  const domePts: THREE.Vector2[] = [];
  const domeR = drumR * 1.22;
  const domeH = 22;
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const y = t * domeH;
    let r = Math.sin(t * Math.PI) * domeR;
    if (t < 0.35) r = drumR + Math.sin((t / 0.35) * (Math.PI / 2)) * (domeR - drumR);
    else if (t > 0.78) r = domeR * Math.pow(1 - (t - 0.78) / 0.22, 1.7);
    domePts.push(new THREE.Vector2(Math.max(0.05, r), y));
  }
  const domeGeo = new THREE.LatheGeometry(domePts, 32);
  const domeMesh = new THREE.Mesh(domeGeo, marbleMat);
  domeMesh.position.set(0, roofY + drumH, 0);
  domeMesh.castShadow = true;
  scene.add(domeMesh);

  // Golden Finial / Kalash Apex Spire
  const finialH = 7.8;
  const finialMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.45, finialH, 12),
    goldMat,
  );
  finialMesh.position.set(0, roofY + drumH + domeH + finialH / 2, 0);
  finialMesh.castShadow = true;
  scene.add(finialMesh);

  const finialBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 16, 16),
    goldMat,
  );
  finialBall.position.set(0, roofY + drumH + domeH + 1.2, 0);
  scene.add(finialBall);

  // 4. Four Roof Chattris (Domed Pavilions on Roof)
  const chattriDist = tombW * 0.32;
  const chattriR = 3.6;
  const chattriColH = 5.2;

  [
    [-chattriDist, -chattriDist],
    [chattriDist, -chattriDist],
    [-chattriDist, chattriDist],
    [chattriDist, chattriDist],
  ].forEach(([cx, cz]) => {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2) {
      const colX = cx + Math.cos(angle) * (chattriR * 0.7);
      const colZ = cz + Math.sin(angle) * (chattriR * 0.7);
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, chattriColH, 8),
        marbleMat,
      );
      col.position.set(colX, roofY + chattriColH / 2, colZ);
      col.castShadow = true;
      scene.add(col);
    }
    const cDome = new THREE.Mesh(
      new THREE.SphereGeometry(chattriR * 0.8, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      marbleMat,
    );
    cDome.position.set(cx, roofY + chattriColH, cz);
    cDome.castShadow = true;
    scene.add(cDome);

    const cFin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.18, 1.6, 8),
      goldMat,
    );
    cFin.position.set(cx, roofY + chattriColH + chattriR * 0.8 + 0.8, cz);
    scene.add(cFin);
  });

  // 5. Four Freestanding Corner Minarets
  const minaretOffsetW = plinthW / 2 - 7;
  const minaretOffsetD = plinthD / 2 - 7;
  const minaretH = 41;

  [
    [-minaretOffsetW, -minaretOffsetD],
    [minaretOffsetW, -minaretOffsetD],
    [-minaretOffsetW, minaretOffsetD],
    [minaretOffsetW, minaretOffsetD],
  ].forEach(([mx, mz]) => {
    const pedH = 3.2;
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 3.0, pedH, 8),
      marbleMat,
    );
    ped.position.set(mx, plinthH + pedH / 2, mz);
    ped.castShadow = true;
    scene.add(ped);

    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 2.2, minaretH, 16),
      marbleMat,
    );
    shaft.position.set(mx, plinthH + pedH + minaretH / 2, mz);
    shaft.castShadow = true;
    scene.add(shaft);

    [0.33, 0.66, 0.95].forEach((pct) => {
      const bY = plinthH + pedH + minaretH * pct;
      const bRing = new THREE.Mesh(
        new THREE.CylinderGeometry(2.3, 2.1, 0.75, 16),
        marbleMat,
      );
      bRing.position.set(mx, bY, mz);
      bRing.castShadow = true;
      scene.add(bRing);
    });

    const cupolaY = plinthH + pedH + minaretH;
    const cupola = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      marbleMat,
    );
    cupola.position.set(mx, cupolaY + 0.7, mz);
    cupola.castShadow = true;
    scene.add(cupola);

    const mFin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.14, 1.8, 8),
      goldMat,
    );
    mFin.position.set(mx, cupolaY + 1.8, mz);
    scene.add(mFin);
  });

  // 6. Charbagh Reflecting Water Pool
  const poolW = 14;
  const poolL = plinthD * 1.1;
  const poolMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(poolW, poolL),
    waterMat,
  );
  poolMesh.rotation.x = -Math.PI / 2;
  poolMesh.position.set(0, 0.08, plinthD / 2 + poolL / 2 + 3);
  scene.add(poolMesh);

  return { width: plinthW, depth: plinthD, height: roofY + drumH + domeH + finialH };
}

function buildExtrudedBuilding(
  scene: THREE.Scene,
  building: Building,
  _glassMaterial: THREE.MeshPhysicalMaterial,
  steelMaterial: THREE.MeshStandardMaterial,
): { width: number; depth: number; height: number } {
  const dims = getFootprintDimensions(building.footprint);
  const heightM = getBuildingHeight(building);
  
  const bName = (building.building_name || building.address || '').toLowerCase();
  if (bName.includes('taj mahal') || (dims.centerLat >= 27.170 && dims.centerLat <= 27.180 && dims.centerLng >= 78.035 && dims.centerLng <= 78.048)) {
    return buildTajMahalModel(scene, dims, heightM);
  }

  const floorCount = building?.floor_count || 4;
  const floorH = heightM / floorCount;
  const podiumHeight = Math.min(4.5, heightM * 0.1);

  // Materials
  const tex = generateBuildingTexture(floorCount);
  const facadeMaterial = new THREE.MeshPhysicalMaterial({
    map: tex,
    metalness: 0.35,
    roughness: 0.22,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    reflectivity: 0.9,
  });

  const graniteMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.6,
    metalness: 0.3,
  });

  const glassCanopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    transmission: 0.85,
    transparent: true,
    opacity: 0.9,
    roughness: 0.08,
    clearcoat: 1.0,
  });

  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.9,
    roughness: 0.2,
  });

  // 1. Granite Entrance Podium / Base
  const podiumMesh = new THREE.Mesh(
    new THREE.BoxGeometry(dims.width * 1.04, podiumHeight, dims.depth * 1.04),
    graniteMat,
  );
  podiumMesh.position.y = podiumHeight / 2;
  podiumMesh.castShadow = true;
  podiumMesh.receiveShadow = true;
  scene.add(podiumMesh);

  // Glass Entrance Canopy / Awning
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(dims.width * 0.45, 0.25, 4.5),
    glassCanopyMat,
  );
  canopy.position.set(0, podiumHeight * 0.75, dims.depth / 2 + 2.2);
  canopy.castShadow = true;
  scene.add(canopy);

  // Warm Entrance Lobby Light
  const lobbyLight = new THREE.PointLight(0xfef08a, 2.5, 12);
  lobbyLight.position.set(0, podiumHeight * 0.5, dims.depth / 2 + 1);
  scene.add(lobbyLight);

  // 2. Main Tower Body
  const shape = building.footprint ? footprintToShape(building.footprint) : null;

  if (shape) {
    const bodyGeo = new THREE.ExtrudeGeometry(shape, {
      depth: heightM,
      bevelEnabled: false,
    });
    bodyGeo.rotateX(-Math.PI / 2);

    const bodyMesh = new THREE.Mesh(bodyGeo, facadeMaterial);
    bodyMesh.position.y = podiumHeight;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    scene.add(bodyMesh);

    // 3. Physical 3D Floor Slab Rings (extruding out at every floor level for visual architectural depth)
    for (let f = 1; f < floorCount; f++) {
      const slabGeo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.22,
        bevelEnabled: false,
      });
      slabGeo.rotateX(-Math.PI / 2);
      const slabMesh = new THREE.Mesh(slabGeo, darkSteelMat);
      slabMesh.position.y = podiumHeight + f * floorH;
      slabMesh.scale.set(1.015, 1, 1.015);
      slabMesh.castShadow = true;
      scene.add(slabMesh);
    }
  } else {
    // Fallback: Box tower
    const bodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(dims.width, heightM, dims.depth),
      facadeMaterial,
    );
    bodyMesh.position.y = podiumHeight + heightM / 2;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    scene.add(bodyMesh);

    // Physical floor slab rings
    for (let f = 1; f < floorCount; f++) {
      const slabMesh = new THREE.Mesh(
        new THREE.BoxGeometry(dims.width * 1.02, 0.22, dims.depth * 1.02),
        darkSteelMat,
      );
      slabMesh.position.y = podiumHeight + f * floorH;
      slabMesh.castShadow = true;
      scene.add(slabMesh);
    }
  }

  // 4. Vertical Corner Architectural Columns
  const cW = 0.6;
  const halfW = dims.width / 2;
  const halfD = dims.depth / 2;
  const colGeo = new THREE.BoxGeometry(cW, heightM, cW);
  [[-halfW, halfD], [halfW, halfD], [-halfW, -halfD], [halfW, -halfD]].forEach(([cx, cz]) => {
    const colMesh = new THREE.Mesh(colGeo, steelMaterial);
    colMesh.position.set(cx, podiumHeight + heightM / 2, cz);
    colMesh.castShadow = true;
    scene.add(colMesh);
  });

  // 5. Rooftop Structure & Details
  const roofY = podiumHeight + heightM;

  // Parapet Wall
  const parapetHeight = Math.max(1.2, heightM * 0.02);
  const parapetMesh = new THREE.Mesh(
    new THREE.BoxGeometry(dims.width * 1.01, parapetHeight, dims.depth * 1.01),
    steelMaterial,
  );
  parapetMesh.position.y = roofY + parapetHeight / 2;
  parapetMesh.castShadow = true;
  scene.add(parapetMesh);

  // Setback Penthouse / Elevator Core
  const pentW = dims.width * 0.4;
  const pentD = dims.depth * 0.4;
  const pentH = Math.max(3.5, heightM * 0.08);
  const penthouse = new THREE.Mesh(
    new THREE.BoxGeometry(pentW, pentH, pentD),
    facadeMaterial,
  );
  penthouse.position.y = roofY + parapetHeight + pentH / 2;
  penthouse.castShadow = true;
  scene.add(penthouse);

  // HVAC Cooling Tower Louvers
  const hvacW = pentW * 0.7;
  const hvacD = pentD * 0.7;
  const hvacH = 1.8;
  const hvacMesh = new THREE.Mesh(
    new THREE.BoxGeometry(hvacW, hvacH, hvacD),
    darkSteelMat,
  );
  hvacMesh.position.y = roofY + parapetHeight + pentH + hvacH / 2;
  hvacMesh.castShadow = true;
  scene.add(hvacMesh);

  // Telecom Spire / Antenna
  const spireH = Math.max(8, heightM * 0.18);
  const spireMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.25, spireH, 8),
    steelMaterial,
  );
  spireMesh.position.y = roofY + parapetHeight + pentH + hvacH + spireH / 2;
  scene.add(spireMesh);

  // Red Aviation Warning Beacon Light at Spire Apex
  const beaconMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 2.0 }),
  );
  beaconMesh.position.y = roofY + parapetHeight + pentH + hvacH + spireH;
  scene.add(beaconMesh);

  const beaconLight = new THREE.PointLight(0xef4444, 3.0, 30);
  beaconLight.position.y = roofY + parapetHeight + pentH + hvacH + spireH;
  scene.add(beaconLight);

  return { width: dims.width, depth: dims.depth, height: roofY + pentH + spireH };
}

export default function MapThreeJS({
  building,
  selectedUnit,
  onUnitClick,
  selectedFloor,
  isLeftOpen,
  isRightOpen,
  onToggleLeft,
  onToggleRight,
}: MapThreeJSProps) {
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
  const [groundElevation, setGroundElevation] = useState<number | null>(null);

  const { lat: centerLat, lng: centerLng } = getBuildingCenter(building);

  useEffect(() => {
    if (!centerLat || !centerLng) return;
    let cancelled = false;
    fetchTerrainHeight(centerLng, centerLat).then((result) => {
      if (!cancelled && result?.elevation != null) {
        setGroundElevation(result.elevation);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [centerLat, centerLng]);

  autoRotateRef.current = autoRotate;

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 520;

    const dims = getFootprintDimensions(building.footprint);
    const buildingHeight = getBuildingHeight(building);
    const floorHeight = getFloorHeight(building);
    const maxDim = Math.max(dims.width, dims.depth, 10);
    const sceneExtent = Math.max(maxDim * 3, buildingHeight * 0.6, 60);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Atmospheric Sky Dome Background
    const skyDomeGeo = new THREE.SphereGeometry(sceneExtent * 4, 32, 32);
    const skyDomeMat = new THREE.MeshBasicMaterial({
      color: 0x080e1a,
      side: THREE.BackSide,
    });
    const skyDome = new THREE.Mesh(skyDomeGeo, skyDomeMat);
    scene.add(skyDome);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 50000);
    const camDist = Math.max(maxDim * 1.9, buildingHeight * 1.0, 35);
    camera.position.set(camDist, buildingHeight * 0.5 + maxDim * 0.4, camDist);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;

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
    controls.maxDistance = 10000;
    controlsRef.current = controls;

    // 1. Natural Hemisphere Lighting (Sky Blue Top, Ground Dark Teal Bottom)
    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x1e293b, 1.4);
    scene.add(hemiLight);

    // 2. High-Intensity Directional Sun Light casting soft PCF shadows
    const sunLight = new THREE.DirectionalLight(0xfffaf0, 2.8);
    sunLight.position.set(sceneExtent * 0.7, buildingHeight * 2.2, sceneExtent * 0.6);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.bias = -0.0001;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = sceneExtent * 5;
    const d = sceneExtent * 1.5;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    // 3. Cyan/Purple Accent Rim Light for Studio Aesthetic
    const rimLight = new THREE.PointLight(0x818cf8, 3.5, sceneExtent * 2.5);
    rimLight.position.set(-maxDim * 1.5, buildingHeight * 0.8, -maxDim * 1.5);
    scene.add(rimLight);

    // Materials
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

    // Build Urban Environment (Plaza, Trees, Street Lamps, Vehicles)
    buildSurroundingContext(scene, dims, sceneExtent);

    // Build Detailed Architectural Building Model
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
        opacity: 0,
        depthWrite: false,
        wireframe: wireframeMode,
      });

      const levelMesh = new THREE.Mesh(new THREE.BoxGeometry(slabW, floorHeight * 0.9, slabD), levelMat);
      levelMesh.position.y = levelY;
      levelMesh.userData = { unit, baseColor };
      levelMesh.visible = false;
      scene.add(levelMesh);
      unitMap.set(unit.unit_id, levelMesh);
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

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (mountRef.current) {
      resizeObserver.observe(mountRef.current);
    }

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
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
      const isFloorActive = selectedFloor !== null && selectedFloor === getUnitFloor(u);
      const mat = mesh.material as THREE.MeshStandardMaterial;

      if (isSelected) {
        mesh.visible = true;
        mat.color.setHex(0x7c6fe0);
        mat.emissive.setHex(0x7c6fe0);
        mat.emissiveIntensity = 1.0;
        mat.opacity = 0.9;
      } else if (isFloorActive) {
        mesh.visible = true;
        mat.color.setHex(mesh.userData.baseColor);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.0;
        mat.opacity = 0.35;
      } else {
        mesh.visible = false;
        mat.opacity = 0;
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

        {onToggleLeft && (
          <button
            className={`toolbar-btn ${isLeftOpen ? 'active' : ''}`}
            onClick={onToggleLeft}
            title="Toggle Spatial Toolkit"
          >
            <PanelLeft size={15} />
            <span>Toolkit</span>
          </button>
        )}
        {onToggleRight && (
          <button
            className={`toolbar-btn ${isRightOpen ? 'active' : ''}`}
            onClick={onToggleRight}
            title="Toggle Record & Floors"
          >
            <PanelRight size={15} />
            <span>Record</span>
          </button>
        )}
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
            {centerLat.toFixed(5)}°N, {centerLng.toFixed(5)}°E • {displayHeight.toFixed(1)}m ({building?.floor_count || 4} Floors)
            {groundElevation != null ? ` • Ground ${groundElevation.toFixed(1)}m MSL` : ''}
          </span>
        </div>
      </div>

      <div className="absolute bottom-3 left-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-white/10 px-3 py-1.5 rounded-full text-xs text-gray-300">
        <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
        <span className="font-semibold text-indigo-300">Three.js — Architectural Studio Replica</span>
      </div>
    </div>
  );
}
