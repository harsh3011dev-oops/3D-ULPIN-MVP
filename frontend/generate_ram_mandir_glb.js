import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Polyfill FileReader for Three.js GLTFExporter in Node.js
if (typeof globalThis.FileReader === 'undefined') {
  class NodeFileReader {
    constructor() {
      this.onloadend = null;
      this.result = null;
    }
    async readAsArrayBuffer(blob) {
      const buffer = await blob.arrayBuffer();
      this.result = buffer;
      if (this.onloadend) {
        this.onloadend({ target: this });
      }
    }
  }
  globalThis.FileReader = NodeFileReader;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createRamMandirScene() {
  const root = new THREE.Group();
  root.name = 'Ayodhya_Ram_Mandir_Architectural_Model';

  // ── Materials (PBR Nagara Sandstone & Marble) ──
  const sandstoneLight = new THREE.MeshStandardMaterial({
    color: 0xe59866, // Warm Bansi Paharpur pink/ochre sandstone
    roughness: 0.68,
    metalness: 0.08,
    name: 'Sandstone_Light',
  });

  const sandstoneMedium = new THREE.MeshStandardMaterial({
    color: 0xd35400, // Deep carved sandstone
    roughness: 0.75,
    metalness: 0.05,
    name: 'Sandstone_Carved',
  });

  const sandstoneDark = new THREE.MeshStandardMaterial({
    color: 0xa04000, // Base podium stone
    roughness: 0.82,
    metalness: 0.04,
    name: 'Sandstone_Foundation',
  });

  const marbleWhite = new THREE.MeshStandardMaterial({
    color: 0xf4f6f7, // Makrana marble flooring
    roughness: 0.35,
    metalness: 0.12,
    name: 'Marble_White',
  });

  const goldFinial = new THREE.MeshStandardMaterial({
    color: 0xf1c40f, // Gilded brass / gold kalasha finials
    roughness: 0.22,
    metalness: 0.92,
    name: 'Gilded_Gold_Kalasha',
  });

  const darkGranite = new THREE.MeshStandardMaterial({
    color: 0x2c3e50, // Sanctum inner threshold
    roughness: 0.5,
    metalness: 0.2,
    name: 'Granite_Trim',
  });

  // ── 1. JAGATI (Stepped Plinth Platform) ──
  // Ground Tier 1
  const plinth1Geo = new THREE.BoxGeometry(72, 2.5, 110);
  const plinth1 = new THREE.Mesh(plinth1Geo, sandstoneDark);
  plinth1.position.set(0, 1.25, 0);
  plinth1.castShadow = true;
  plinth1.receiveShadow = true;
  root.add(plinth1);

  // Ground Tier 2 (Molded step plinth)
  const plinth2Geo = new THREE.BoxGeometry(66, 2.2, 102);
  const plinth2 = new THREE.Mesh(plinth2Geo, sandstoneMedium);
  plinth2.position.set(0, 3.6, 0);
  plinth2.castShadow = true;
  plinth2.receiveShadow = true;
  root.add(plinth2);

  // Main Flooring Platform (Marble Courtyard)
  const floorGeo = new THREE.BoxGeometry(64, 0.4, 100);
  const floorMesh = new THREE.Mesh(floorGeo, marbleWhite);
  floorMesh.position.set(0, 4.9, 0);
  floorMesh.receiveShadow = true;
  root.add(floorMesh);

  // Entrance Grand Staircase (Eastern Approach, +Z)
  for (let s = 0; s < 12; s++) {
    const stepGeo = new THREE.BoxGeometry(22 - s * 0.5, 0.4, 2.2);
    const stepMesh = new THREE.Mesh(stepGeo, sandstoneMedium);
    stepMesh.position.set(0, s * 0.4 + 0.2, 51 + (12 - s) * 1.6);
    stepMesh.castShadow = true;
    stepMesh.receiveShadow = true;
    root.add(stepMesh);
  }

  // ── 2. GARBHAGRIHA (Main Sanctum Base & Sanctuary) ──
  // Located towards rear (-Z axis: z = -28)
  const sanctumBaseGeo = new THREE.BoxGeometry(24, 12, 24);
  const sanctumBase = new THREE.Mesh(sanctumBaseGeo, sandstoneLight);
  sanctumBase.position.set(0, 11, -28);
  sanctumBase.castShadow = true;
  sanctumBase.receiveShadow = true;
  root.add(sanctumBase);

  // Sanctum Cornice Band
  const sanctumCorniceGeo = new THREE.BoxGeometry(26, 1.5, 26);
  const sanctumCornice = new THREE.Mesh(sanctumCorniceGeo, sandstoneDark);
  sanctumCornice.position.set(0, 17.75, -28);
  sanctumCornice.castShadow = true;
  root.add(sanctumCornice);

  // ── 3. MAIN SHIKHARA (Tall Curvilinear Nagara Tower Spire) ──
  // 5 Tiers with stepped curvilinear taper
  const shikharaTiers = [
    { w: 22, d: 22, h: 7, y: 22 },
    { w: 18.5, d: 18.5, h: 7, y: 29 },
    { w: 15, d: 15, h: 6.5, y: 35.5 },
    { w: 11.5, d: 11.5, h: 6, y: 41.5 },
    { w: 7.5, d: 7.5, h: 5.5, y: 47 },
  ];

  shikharaTiers.forEach((tier, idx) => {
    // Central core
    const tierGeo = new THREE.BoxGeometry(tier.w, tier.h, tier.d);
    const tierMesh = new THREE.Mesh(tierGeo, idx % 2 === 0 ? sandstoneLight : sandstoneMedium);
    tierMesh.position.set(0, tier.y, -28);
    tierMesh.castShadow = true;
    tierMesh.receiveShadow = true;
    root.add(tierMesh);

    // Decorative projection ribs (Rathas) on 4 faces
    const ribOffsets = [
      [0, tier.d / 2 + 0.3, 0],
      [0, -tier.d / 2 - 0.3, 0],
      [tier.w / 2 + 0.3, 0, Math.PI / 2],
      [-tier.w / 2 - 0.3, 0, Math.PI / 2],
    ];

    ribOffsets.forEach(([rx, rz, rotY]) => {
      const ribGeo = new THREE.BoxGeometry(tier.w * 0.45, tier.h * 0.95, 0.8);
      const ribMesh = new THREE.Mesh(ribGeo, sandstoneMedium);
      ribMesh.position.set(rx, tier.y, -28 + rz);
      ribMesh.rotation.y = rotY;
      ribMesh.castShadow = true;
      root.add(ribMesh);
    });

    // Tier cornice rim
    const rimGeo = new THREE.BoxGeometry(tier.w + 1.2, 0.6, tier.d + 1.2);
    const rimMesh = new THREE.Mesh(rimGeo, sandstoneDark);
    rimMesh.position.set(0, tier.y + tier.h / 2 + 0.3, -28);
    rimMesh.castShadow = true;
    root.add(rimMesh);
  });

  // Shikhara Griva (Neck)
  const grivaGeo = new THREE.CylinderGeometry(4.2, 4.8, 2.5, 24);
  const grivaMesh = new THREE.Mesh(grivaGeo, sandstoneDark);
  grivaMesh.position.set(0, 51, -28);
  grivaMesh.castShadow = true;
  root.add(grivaMesh);

  // Large Ribbed Amalaka Disk
  const amalakaGeo = new THREE.CylinderGeometry(6.5, 6.5, 1.8, 32);
  const amalakaMesh = new THREE.Mesh(amalakaGeo, sandstoneLight);
  amalakaMesh.position.set(0, 52.8, -28);
  amalakaMesh.castShadow = true;
  root.add(amalakaMesh);

  // Gold Kalasha Finial Spire
  const kalashBaseGeo = new THREE.SphereGeometry(2.4, 20, 20);
  const kalashBase = new THREE.Mesh(kalashBaseGeo, goldFinial);
  kalashBase.position.set(0, 55.2, -28);
  kalashBase.castShadow = true;
  root.add(kalashBase);

  const kalashSpireGeo = new THREE.ConeGeometry(1.2, 4.2, 20);
  const kalashSpire = new THREE.Mesh(kalashSpireGeo, goldFinial);
  kalashSpire.position.set(0, 58.2, -28);
  kalashSpire.castShadow = true;
  root.add(kalashSpire);

  // Mini-Urushringas (Attached Mini-Spires on Shikhara flanks)
  const miniSpirePositions = [
    [-11.5, 25, -28],
    [11.5, 25, -28],
    [0, 25, -39.5],
  ];

  miniSpirePositions.forEach(([mx, my, mz]) => {
    const miniGeo = new THREE.ConeGeometry(3.5, 14, 16);
    const miniMesh = new THREE.Mesh(miniGeo, sandstoneMedium);
    miniMesh.position.set(mx, my, mz);
    miniMesh.castShadow = true;
    root.add(miniMesh);

    // Mini Amalaka & Kalash
    const miniAmalakaGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.6, 16);
    const miniAmalaka = new THREE.Mesh(miniAmalakaGeo, sandstoneLight);
    miniAmalaka.position.set(mx, my + 7.3, mz);
    root.add(miniAmalaka);

    const miniGoldGeo = new THREE.ConeGeometry(0.5, 1.5, 12);
    const miniGold = new THREE.Mesh(miniGoldGeo, goldFinial);
    miniGold.position.set(mx, my + 8.3, mz);
    root.add(miniGold);
  });

  // ── 4. GUDHAMANDAPA (Closed Hall with Tiered Phamsana Roof) ──
  // Position: z = -10
  const gudhaBaseGeo = new THREE.BoxGeometry(28, 10, 18);
  const gudhaBase = new THREE.Mesh(gudhaBaseGeo, sandstoneLight);
  gudhaBase.position.set(0, 10, -10);
  gudhaBase.castShadow = true;
  gudhaBase.receiveShadow = true;
  root.add(gudhaBase);

  // Stepped Pyramidal Roof Tiers
  [
    { w: 29, d: 19, y: 15.5, h: 1.2 },
    { w: 25, d: 16, y: 17, h: 1.4 },
    { w: 21, d: 13, y: 18.6, h: 1.4 },
    { w: 16, d: 10, y: 20.2, h: 1.4 },
    { w: 11, d: 7, y: 21.8, h: 1.4 },
    { w: 6, d: 4, y: 23.4, h: 1.4 },
  ].forEach((tier) => {
    const roofTierGeo = new THREE.BoxGeometry(tier.w, tier.h, tier.d);
    const roofTierMesh = new THREE.Mesh(roofTierGeo, sandstoneMedium);
    roofTierMesh.position.set(0, tier.y, -10);
    roofTierMesh.castShadow = true;
    root.add(roofTierMesh);
  });

  // Gudhamandapa Kalash Top
  const gudhaKalashGeo = new THREE.ConeGeometry(1.2, 3.2, 16);
  const gudhaKalash = new THREE.Mesh(gudhaKalashGeo, goldFinial);
  gudhaKalash.position.set(0, 26, -10);
  gudhaKalash.castShadow = true;
  root.add(gudhaKalash);

  // ── 5. RANGAMANDAPA (Central Grand Assembly Pavilion with Fluted Dome) ──
  // Position: z = 8
  const rangaBaseGeo = new THREE.BoxGeometry(32, 9, 20);
  const rangaBase = new THREE.Mesh(rangaBaseGeo, sandstoneLight);
  rangaBase.position.set(0, 9.5, 8);
  rangaBase.castShadow = true;
  rangaBase.receiveShadow = true;
  root.add(rangaBase);

  // Stepped Pyramidal Tiers
  [
    { w: 33, d: 21, y: 14.5, h: 1.2 },
    { w: 28, d: 17, y: 16, h: 1.4 },
    { w: 23, d: 13, y: 17.5, h: 1.4 },
    { w: 17, d: 9, y: 19, h: 1.4 },
  ].forEach((tier) => {
    const rTierGeo = new THREE.BoxGeometry(tier.w, tier.h, tier.d);
    const rTierMesh = new THREE.Mesh(rTierGeo, sandstoneMedium);
    rTierMesh.position.set(0, tier.y, 8);
    rTierMesh.castShadow = true;
    root.add(rTierMesh);
  });

  // Fluted Central Dome & Kalash
  const rangaDomeGeo = new THREE.SphereGeometry(7, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const rangaDome = new THREE.Mesh(rangaDomeGeo, sandstoneLight);
  rangaDome.position.set(0, 20.2, 8);
  rangaDome.castShadow = true;
  root.add(rangaDome);

  const rangaAmalakaGeo = new THREE.CylinderGeometry(2.8, 2.8, 0.9, 24);
  const rangaAmalaka = new THREE.Mesh(rangaAmalakaGeo, sandstoneMedium);
  rangaAmalaka.position.set(0, 27.2, 8);
  root.add(rangaAmalaka);

  const rangaKalashGeo = new THREE.ConeGeometry(1.1, 3.5, 16);
  const rangaKalash = new THREE.Mesh(rangaKalashGeo, goldFinial);
  rangaKalash.position.set(0, 29.5, 8);
  rangaKalash.castShadow = true;
  root.add(rangaKalash);

  // ── 6. NRITYAMANDAPA / KIRTANMANDAPA (Side Transept Halls) ──
  // Left Transept (X = -20, Z = 8)
  const leftMandapaGeo = new THREE.BoxGeometry(14, 8, 16);
  const leftMandapa = new THREE.Mesh(leftMandapaGeo, sandstoneLight);
  leftMandapa.position.set(-20, 9, 8);
  leftMandapa.castShadow = true;
  root.add(leftMandapa);

  const leftDomeGeo = new THREE.ConeGeometry(6, 6, 16);
  const leftDome = new THREE.Mesh(leftDomeGeo, sandstoneMedium);
  leftDome.position.set(-20, 16, 8);
  leftDome.castShadow = true;
  root.add(leftDome);

  const leftKalash = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.2, 12), goldFinial);
  leftKalash.position.set(-20, 20, 8);
  root.add(leftKalash);

  // Right Transept (X = 20, Z = 8)
  const rightMandapa = new THREE.Mesh(leftMandapaGeo, sandstoneLight);
  rightMandapa.position.set(20, 9, 8);
  rightMandapa.castShadow = true;
  root.add(rightMandapa);

  const rightDome = new THREE.Mesh(leftDomeGeo, sandstoneMedium);
  rightDome.position.set(20, 16, 8);
  rightDome.castShadow = true;
  root.add(rightDome);

  const rightKalash = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.2, 12), goldFinial);
  rightKalash.position.set(20, 20, 8);
  root.add(rightKalash);

  // ── 7. ARDHAMANDAPA & PRAVESH DWAR (Entrance Portico) ──
  // Position: z = 28
  const ardhaBaseGeo = new THREE.BoxGeometry(22, 8, 16);
  const ardhaBase = new THREE.Mesh(ardhaBaseGeo, sandstoneLight);
  ardhaBase.position.set(0, 9, 28);
  ardhaBase.castShadow = true;
  ardhaBase.receiveShadow = true;
  root.add(ardhaBase);

  // Stepped Entrance Shikhara/Phamsana Roof
  [
    { w: 23, d: 17, y: 13.5, h: 1.0 },
    { w: 19, d: 13, y: 14.8, h: 1.2 },
    { w: 14, d: 9, y: 16.2, h: 1.2 },
    { w: 8, d: 5, y: 17.6, h: 1.2 },
  ].forEach((tier) => {
    const aTierGeo = new THREE.BoxGeometry(tier.w, tier.h, tier.d);
    const aTierMesh = new THREE.Mesh(aTierGeo, sandstoneMedium);
    aTierMesh.position.set(0, tier.y, 28);
    aTierMesh.castShadow = true;
    root.add(aTierMesh);
  });

  const ardhaKalash = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.8, 16), goldFinial);
  ardhaKalash.position.set(0, 19.8, 28);
  ardhaKalash.castShadow = true;
  root.add(ardhaKalash);

  // ── 8. COLONNADES & CARVED STONE PILLARS (Stambha) ──
  // Outer perimeter carved pillar rows
  const pillarGeo = new THREE.CylinderGeometry(0.55, 0.65, 5.8, 12);
  const pillarCapitalGeo = new THREE.BoxGeometry(1.5, 0.6, 1.5);
  const pillarBaseGeo = new THREE.BoxGeometry(1.6, 0.6, 1.6);

  const pillarLocations = [];

  // Front Porch Colonnade
  for (let px = -9; px <= 9; px += 3) {
    pillarLocations.push([px, 36]);
    pillarLocations.push([px, 32]);
  }
  // North & South Flank Colonnades
  for (let pz = -22; pz <= 26; pz += 4.5) {
    pillarLocations.push([-17, pz]);
    pillarLocations.push([17, pz]);
  }

  pillarLocations.forEach(([px, pz]) => {
    const pillarGroup = new THREE.Group();
    pillarGroup.position.set(px, 5.1, pz);

    const baseM = new THREE.Mesh(pillarBaseGeo, sandstoneDark);
    baseM.position.y = 0.3;
    baseM.castShadow = true;
    pillarGroup.add(baseM);

    const shaftM = new THREE.Mesh(pillarGeo, sandstoneLight);
    shaftM.position.y = 3.2;
    shaftM.castShadow = true;
    pillarGroup.add(shaftM);

    const capM = new THREE.Mesh(pillarCapitalGeo, sandstoneMedium);
    capM.position.y = 6.4;
    capM.castShadow = true;
    pillarGroup.add(capM);

    root.add(pillarGroup);
  });

  // ── 9. CORNER SUBSIDIARY SHRINES (Panchayatana Layout) ──
  const cornerPositions = [
    [-26, -42],
    [26, -42],
    [-26, 40],
    [26, 40],
  ];

  cornerPositions.forEach(([cx, cz]) => {
    const subShrine = new THREE.Group();
    subShrine.position.set(cx, 5.1, cz);

    // Sanctum
    const cBase = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 7), sandstoneLight);
    cBase.position.y = 2.5;
    cBase.castShadow = true;
    subShrine.add(cBase);

    // Spire
    const cSpire = new THREE.Mesh(new THREE.ConeGeometry(3.6, 9, 16), sandstoneMedium);
    cSpire.position.y = 9.5;
    cSpire.castShadow = true;
    subShrine.add(cSpire);

    // Finial
    const cKalash = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.8, 12), goldFinial);
    cKalash.position.y = 14.8;
    cKalash.castShadow = true;
    subShrine.add(cKalash);

    root.add(subShrine);
  });

  // ── 10. ENTRANCE GRAND TORANA ARCH ──
  const toranaLeft = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9, 1.6), sandstoneDark);
  toranaLeft.position.set(-6, 9.6, 48);
  toranaLeft.castShadow = true;
  root.add(toranaLeft);

  const toranaRight = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9, 1.6), sandstoneDark);
  toranaRight.position.set(6, 9.6, 48);
  toranaRight.castShadow = true;
  root.add(toranaRight);

  const toranaBeam = new THREE.Mesh(new THREE.BoxGeometry(15, 1.8, 2), sandstoneMedium);
  toranaBeam.position.set(0, 14.8, 48);
  toranaBeam.castShadow = true;
  root.add(toranaBeam);

  const toranaCrest = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.5, 16), goldFinial);
  toranaCrest.position.set(0, 17, 48);
  toranaCrest.castShadow = true;
  root.add(toranaCrest);

  return root;
}

// Generate and export GLB
async function exportGLB() {
  const scene = createRamMandirScene();
  const exporter = new GLTFExporter();

  const outputPath = path.resolve(__dirname, 'public/models/ram-mandir.glb');
  console.log(`Exporting Ram Mandir 3D model to ${outputPath}...`);

  exporter.parse(
    scene,
    (gltf) => {
      const buffer = Buffer.from(gltf);
      fs.writeFileSync(outputPath, buffer);
      console.log(`✅ Successfully generated Ram Mandir GLB: ${outputPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
    },
    (err) => {
      console.error('❌ Error exporting GLB:', err);
      process.exit(1);
    },
    { binary: true }
  );
}

exportGLB();
