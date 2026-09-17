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
const modelsDir = path.resolve(__dirname, 'public/models');
if (!fs.existsSync(modelsDir)) {
  fs.mkdirSync(modelsDir, { recursive: true });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. RANI KI VAV (The Queen's Stepwell, Patan, Gujarat)
// Inverted subterranean stepwell descending 28m across 7 terraced levels,
// with ground-level entrance Torana gateway, colonnaded pavilions, and circular well.
// ─────────────────────────────────────────────────────────────────────────────
function createRaniKiVavScene() {
  const root = new THREE.Group();
  root.name = 'Rani_Ki_Vav_LiDAR_Digital_Twin';

  // Materials: Gujarat Maru-Gurjara Sandstone
  const sandstoneMain = new THREE.MeshStandardMaterial({
    color: 0xdfb180, // Golden-ochre weathered sandstone
    roughness: 0.72,
    metalness: 0.05,
    name: 'Maru_Gurjara_Sandstone',
  });
  const sandstoneDark = new THREE.MeshStandardMaterial({
    color: 0xb58252, // Deep shaded carved stone
    roughness: 0.85,
    metalness: 0.02,
    name: 'Sandstone_Subterranean_Base',
  });
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e3a5f, // Sacred stepwell groundwater
    roughness: 0.15,
    metalness: 0.8,
    transparent: true,
    opacity: 0.85,
    name: 'Stepwell_Water',
  });
  const groundPlaza = new THREE.MeshStandardMaterial({
    color: 0x94826b,
    roughness: 0.9,
    metalness: 0.02,
    name: 'Surface_Ground_Plaza',
  });

  // Ground Level Surrounding Rim (Surface ground before descent)
  const rimLeft = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 75), groundPlaza);
  rimLeft.position.set(-14, 0, 0);
  root.add(rimLeft);

  const rimRight = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 75), groundPlaza);
  rimRight.position.set(14, 0, 0);
  root.add(rimRight);

  const rimEast = new THREE.Mesh(new THREE.BoxGeometry(36, 2, 12), groundPlaza);
  rimEast.position.set(0, 0, 41);
  root.add(rimEast);

  const toranaGroup = new THREE.Group();
  toranaGroup.name = "Entrance_Torana_Pavilion";
  root.add(toranaGroup);

  const tiersGroup = new THREE.Group();
  tiersGroup.name = "Subterranean_Pavilion_Tiers";
  root.add(tiersGroup);

  const wellGroup = new THREE.Group();
  wellGroup.name = "Deep_Well_Shaft_Reservoir";
  root.add(wellGroup);

  // Entrance Torana Gateway Pavilion (Ground Level at East)
  const toranaLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 6.0, 12), sandstoneMain);
  toranaLeft.position.set(-5, 4.0, 38);
  toranaLeft.castShadow = true;
  toranaGroup.add(toranaLeft);

  const toranaRight = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 6.0, 12), sandstoneMain);
  toranaRight.position.set(5, 4.0, 38);
  toranaRight.castShadow = true;
  toranaGroup.add(toranaRight);

  const toranaBeam = new THREE.Mesh(new THREE.BoxGeometry(13, 0.8, 1.2), sandstoneDark);
  toranaBeam.position.set(0, 7.0, 38);
  toranaGroup.add(toranaBeam);

  const toranaCrest = new THREE.Mesh(new THREE.CylinderGeometry(0, 1.2, 1.8, 4), sandstoneMain);
  toranaCrest.position.set(0, 8.2, 38);
  toranaCrest.rotation.y = Math.PI / 4;
  toranaGroup.add(toranaCrest);

  // Deep Stepwell Excavation Trench Retaining Walls
  const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(2, 28, 68), sandstoneDark);
  wallLeft.position.set(-10, -14, 0);
  tiersGroup.add(wallLeft);

  const wallRight = new THREE.Mesh(new THREE.BoxGeometry(2, 28, 68), sandstoneDark);
  wallRight.position.set(10, -14, 0);
  tiersGroup.add(wallRight);

  // 7 Subterranean Terraced Pavilion Levels (Descending from East to West)
  const TOTAL_LEVELS = 7;
  for (let lvl = 1; lvl <= TOTAL_LEVELS; lvl++) {
    const depth = lvl * 3.8;
    const zPos = 30 - lvl * 8.5;
    const terraceW = 18;
    const terraceL = 8;

    // Stepped terrace platform
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(terraceW, 0.8, terraceL),
      sandstoneMain
    );
    platform.position.set(0, -depth, zPos);
    platform.castShadow = true;
    platform.receiveShadow = true;
    tiersGroup.add(platform);

    // Pillared Pavilion Arcade (Torana & Carved Pillars across the terrace)
    const pillarCount = 6;
    for (let p = 0; p < pillarCount; p++) {
      const px = -6.5 + (p * 2.6);
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.42, 3.6, 12),
        sandstoneMain
      );
      pillar.position.set(px, -depth + 1.8, zPos);
      pillar.castShadow = true;
      tiersGroup.add(pillar);

      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.35, 0.9),
        sandstoneDark
      );
      cap.position.set(px, -depth + 3.7, zPos);
      tiersGroup.add(cap);
    }

    // Horizontal Beam / Lintel spanning the pillars
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(16.5, 0.5, 1.2),
      sandstoneMain
    );
    lintel.position.set(0, -depth + 3.9, zPos);
    tiersGroup.add(lintel);

    // Stepped lateral stairway flights descending to this terrace
    const stepCount = 8;
    for (let s = 0; s < stepCount; s++) {
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.45, 1.0),
        sandstoneDark
      );
      stepMesh.position.set(0, -depth + 3.8 - (s * 0.45), zPos + 4.2 - (s * 1.0));
      stepMesh.receiveShadow = true;
      tiersGroup.add(stepMesh);
    }
  }

  // Western Deep Cylindrical Well Shaft (The focal reservoir of Rani ki Vav)
  const wellDepth = 30;
  const wellRadius = 5.5;
  const wellWall = new THREE.Mesh(
    new THREE.CylinderGeometry(wellRadius + 1.2, wellRadius + 1.2, wellDepth, 32, 1, true),
    sandstoneDark
  );
  wellWall.position.set(0, -15, -30);
  wellGroup.add(wellWall);

  for (let ring = 1; ring <= 5; ring++) {
    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(wellRadius, 0.4, 8, 32),
      sandstoneMain
    );
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.set(0, -(ring * 5), -30);
    wellGroup.add(ringMesh);
  }

  // Sacred Water Surface at Bottom of Well
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(wellRadius, wellRadius, 0.5, 32),
    waterMaterial
  );
  water.position.set(0, -27.5, -30);
  root.add(water);

  return root;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. AAM KHAS BAGH (Mughal Royal Multi-Building Complex, Sirhind, Punjab)
// Complete Mughal royal garden enclosure featuring 3 historical structures:
// 1. Shahi Hammam (Royal Bathhouse with subterranean hypocaust furnace & dome)
// 2. Daulat Khana-e-Khas (Two-Story Royal Palace Pavilion with arched jharokhas)
// 3. Baradari (Twelve-Arched Garden Pleasure Pavilion)
// Connected by central Mughal Charbagh water canals (Nahr) and fountain basins.
// ─────────────────────────────────────────────────────────────────────────────
function createAamKhasBaghScene() {
  const root = new THREE.Group();
  root.name = 'Aam_Khas_Bagh_Mughal_Complex_LiDAR';

  // Materials: Mughal Baked Brick, Lime Plaster, Water & Sandstone
  const mughalBrick = new THREE.MeshStandardMaterial({
    color: 0xbd5338, // Sirhind red baked terracotta brick
    roughness: 0.78,
    metalness: 0.05,
    name: 'Mughal_Terracotta_Brick',
  });
  const buffPlaster = new THREE.MeshStandardMaterial({
    color: 0xe6cfb3, // Lime plaster finish on vaulted ceilings
    roughness: 0.55,
    metalness: 0.08,
    name: 'Buff_Lime_Plaster',
  });
  const subterraneanStone = new THREE.MeshStandardMaterial({
    color: 0x6e473b, // Underground hypocaust masonry
    roughness: 0.9,
    metalness: 0.02,
    name: 'Hypocaust_Masonry',
  });
  const terracottaPipes = new THREE.MeshStandardMaterial({
    color: 0xd35400, // Vitrified terracotta thermal pipes
    roughness: 0.6,
    metalness: 0.15,
    name: 'Terracotta_Heating_Conduits',
  });
  const marbleBasin = new THREE.MeshStandardMaterial({
    color: 0xf0f3f4, // Marble fountain basins
    roughness: 0.3,
    metalness: 0.1,
    name: 'Marble_Water_Feature',
  });
  const canalWater = new THREE.MeshStandardMaterial({
    color: 0x2471a3,
    roughness: 0.2,
    metalness: 0.75,
    transparent: true,
    opacity: 0.85,
    name: 'Mughal_Canal_Water',
  });
  const gardenPaving = new THREE.MeshStandardMaterial({
    color: 0x937047,
    roughness: 0.85,
    metalness: 0.05,
    name: 'Sandstone_Walkway_Paving',
  });

  // 0. CHARBAGH GARDEN PLAZA & INTERCONNECTING WATER CANAL (NAHR)
  const gardenPlaza = new THREE.Mesh(
    new THREE.BoxGeometry(84, 0.4, 76),
    gardenPaving
  );
  gardenPlaza.position.set(0, -0.2, 0);
  gardenPlaza.receiveShadow = true;
  root.add(gardenPlaza);

  // Central North-South Water Canal connecting Hammam to Daulat Khana
  const nahrNS = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.3, 50),
    canalWater
  );
  nahrNS.position.set(0, 0.05, 0);
  root.add(nahrNS);

  // East-West Branch Canal connecting to Baradari
  const nahrEW = new THREE.Mesh(
    new THREE.BoxGeometry(32, 0.3, 3.6),
    canalWater
  );
  nahrEW.position.set(16, 0.05, 0);
  root.add(nahrEW);

  // Central Octagonal Water Reservoir & Fountain Basin
  const centralPool = new THREE.Mesh(
    new THREE.CylinderGeometry(4.2, 4.2, 0.5, 8),
    marbleBasin
  );
  centralPool.position.set(0, 0.25, 0);
  root.add(centralPool);

  const centralJet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.5, 1.4, 8),
    marbleBasin
  );
  centralJet.position.set(0, 0.9, 0);
  root.add(centralJet);

  // ─────────────────────────────────────────────────────────────
  // BUILDING 1: SHAHI HAMMAM (Royal Bathhouse with Subterranean Hypocaust)
  // Located at North wing (z = -18)
  // ─────────────────────────────────────────────────────────────
  const hammamGroup = new THREE.Group();
  hammamGroup.name = 'Building_1_Shahi_Hammam';
  hammamGroup.position.set(0, 0, -18);

  // Subterranean Hypocaust Base & Support Pillars
  const hypoBase = new THREE.Mesh(new THREE.BoxGeometry(28, 1.0, 24), subterraneanStone);
  hypoBase.position.set(0, -2.0, 0);
  hammamGroup.add(hypoBase);

  for (let x = -10; x <= 10; x += 4.5) {
    for (let z = -8; z <= 8; z += 4.5) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.5, 1.0), subterraneanStone);
      p.position.set(x, -0.9, z);
      hammamGroup.add(p);
    }
  }

  // Terracotta Underfloor Thermal Air Conduits
  const pipe1 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 22, 12), terracottaPipes);
  pipe1.rotation.z = Math.PI / 2;
  pipe1.position.set(0, -1.0, -4);
  hammamGroup.add(pipe1);

  const pipe2 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 22, 12), terracottaPipes);
  pipe2.rotation.z = Math.PI / 2;
  pipe2.position.set(0, -1.0, 4);
  hammamGroup.add(pipe2);

  // Ground Floor Plinth
  const hammamPlinth = new THREE.Mesh(new THREE.BoxGeometry(26, 0.6, 22), buffPlaster);
  hammamPlinth.position.set(0, 0.3, 0);
  hammamGroup.add(hammamPlinth);

  // Central Octagonal Bathhouse Chamber
  const centralHall = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 5.0, 8, 1, true), mughalBrick);
  centralHall.position.set(0, 3.1, 0);
  centralHall.castShadow = true;
  hammamGroup.add(centralHall);

  const domeDrum = new THREE.Mesh(new THREE.CylinderGeometry(7.0, 7.5, 1.0, 16), buffPlaster);
  domeDrum.position.set(0, 6.1, 0);
  hammamGroup.add(domeDrum);

  const centralDome = new THREE.Mesh(new THREE.SphereGeometry(6.2, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), buffPlaster);
  centralDome.position.set(0, 6.6, 0);
  centralDome.castShadow = true;
  hammamGroup.add(centralDome);

  const steamLantern = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, 1.4, 8), mughalBrick);
  steamLantern.position.set(0, 12.8, 0);
  hammamGroup.add(steamLantern);

  // 4 Corner Steam Chambers with cupolas
  const corners = [[-8.5, -6.5], [8.5, -6.5], [-8.5, 6.5], [8.5, 6.5]];
  corners.forEach(([cx, cz]) => {
    const chamber = new THREE.Mesh(new THREE.BoxGeometry(6.5, 4.2, 6.5), mughalBrick);
    chamber.position.set(cx, 2.7, cz);
    hammamGroup.add(chamber);

    const miniDome = new THREE.Mesh(new THREE.SphereGeometry(2.8, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), buffPlaster);
    miniDome.position.set(cx, 4.8, cz);
    hammamGroup.add(miniDome);
  });
  root.add(hammamGroup);

  // ─────────────────────────────────────────────────────────────
  // BUILDING 2: DAULAT KHANA-E-KHAS (Two-Story Royal Palace Pavilion)
  // Located at South wing (z = +20)
  // ─────────────────────────────────────────────────────────────
  const daulatKhana = new THREE.Group();
  daulatKhana.name = 'Building_2_Daulat_Khana_e_Khas';
  daulatKhana.position.set(0, 0, 20);

  // Ground Floor Plinth & Main Hall
  const dkPlinth = new THREE.Mesh(new THREE.BoxGeometry(26, 0.8, 14), mughalBrick);
  dkPlinth.position.set(0, 0.4, 0);
  daulatKhana.add(dkPlinth);

  const dkGroundFloor = new THREE.Mesh(new THREE.BoxGeometry(24, 4.5, 12), mughalBrick);
  dkGroundFloor.position.set(0, 3.05, 0);
  dkGroundFloor.castShadow = true;
  daulatKhana.add(dkGroundFloor);

  // Arched Portico Columns on North Face
  for (let c = -9; c <= 9; c += 4.5) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 4.5, 8), buffPlaster);
    col.position.set(c, 3.05, -6.2);
    daulatKhana.add(col);
  }

  // Inter-floor Chhajja / Eaves
  const chhajja1 = new THREE.Mesh(new THREE.BoxGeometry(25.6, 0.35, 13.6), buffPlaster);
  chhajja1.position.set(0, 5.4, 0);
  daulatKhana.add(chhajja1);

  // Upper Floor (Level 2 Royal Chambers)
  const dkUpperFloor = new THREE.Mesh(new THREE.BoxGeometry(20, 3.8, 10), buffPlaster);
  dkUpperFloor.position.set(0, 7.5, 0);
  dkUpperFloor.castShadow = true;
  daulatKhana.add(dkUpperFloor);

  // Projecting Jharokha Balconies
  [-6, 6].forEach(jx => {
    const jharokha = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.2, 1.8), mughalBrick);
    jharokha.position.set(jx, 7.5, -5.8);
    daulatKhana.add(jharokha);

    const jharokhaRoof = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.2, 4), buffPlaster);
    jharokhaRoof.position.set(jx, 9.2, -5.8);
    jharokhaRoof.rotation.y = Math.PI / 4;
    daulatKhana.add(jharokhaRoof);
  });

  // Rooftop Parapet with Corner Minarets
  const roofParapet = new THREE.Mesh(new THREE.BoxGeometry(20.6, 0.7, 10.6), mughalBrick);
  roofParapet.position.set(0, 9.75, 0);
  daulatKhana.add(roofParapet);

  [[-9.8, -4.8], [9.8, -4.8], [-9.8, 4.8], [9.8, 4.8]].forEach(([mx, mz]) => {
    const minar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 2.8, 8), buffPlaster);
    minar.position.set(mx, 10.8, mz);
    daulatKhana.add(minar);

    const chhatriCap = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.0, 8), mughalBrick);
    chhatriCap.position.set(mx, 12.7, mz);
    daulatKhana.add(chhatriCap);
  });
  root.add(daulatKhana);

  // ─────────────────────────────────────────────────────────────
  // BUILDING 3: BARADARI (Mughal Twelve-Arched Garden Pavilion)
  // Located at East garden terrace (x = +26, z = 0)
  // ─────────────────────────────────────────────────────────────
  const baradari = new THREE.Group();
  baradari.name = 'Building_3_Baradari_Pavilion';
  baradari.position.set(26, 0, 0);

  // Raised Stone Plinth
  const baradariPlinth = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 16), buffPlaster);
  baradariPlinth.position.set(0, 0.6, 0);
  baradari.add(baradariPlinth);

  // Pillared Arcade (12 Open Mughal Arched Bays)
  const bPillars = [
    [-6, -6], [-2, -6], [2, -6], [6, -6],
    [-6, 6], [-2, 6], [2, 6], [6, 6],
    [-6, -2], [-6, 2], [6, -2], [6, 2]
  ];
  bPillars.forEach(([px, pz]) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 4.2, 8), buffPlaster);
    p.position.set(px, 3.3, pz);
    p.castShadow = true;
    baradari.add(p);
  });

  // Vaulted Roof & Projecting Stone Eaves (Chhajja)
  const baradariChhajja = new THREE.Mesh(new THREE.BoxGeometry(17.2, 0.35, 17.2), buffPlaster);
  baradariChhajja.position.set(0, 5.5, 0);
  baradari.add(baradariChhajja);

  const baradariRoof = new THREE.Mesh(new THREE.BoxGeometry(14, 1.0, 14), mughalBrick);
  baradariRoof.position.set(0, 6.1, 0);
  baradari.add(baradariRoof);

  // Central Low Fluted Mughal Dome
  const baradariDome = new THREE.Mesh(new THREE.SphereGeometry(3.6, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), buffPlaster);
  baradariDome.position.set(0, 6.6, 0);
  baradariDome.castShadow = true;
  baradari.add(baradariDome);

  // 4 Corner Chhatris
  [[-6.2, -6.2], [6.2, -6.2], [-6.2, 6.2], [6.2, 6.2]].forEach(([cx, cz]) => {
    const chhatriPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.6, 8), buffPlaster);
    chhatriPillar.position.set(cx, 7.4, cz);
    baradari.add(chhatriPillar);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.9, 8), mughalBrick);
    cap.position.set(cx, 8.6, cz);
    baradari.add(cap);
  });
  root.add(baradari);

  return root;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. THIRUVANANTHAPURAM SMART CITY (TALD LiDAR Urban Multi-Building Campus)
// High-tech multi-structure urban digital twin from Airborne Laser Scanning:
// 1. Tower A (Main Commercial Tower, 8 stories, 32m height with solar PV grid)
// 2. Tower B (IT & Operations Wing, 5 stories, 20m height with stepped terraces)
// 3. Wing C (Civic Innovation & Research Hub, 3 stories, 12m height with living roof)
// 4. Elevated Glass Skybridge (Connecting Tower A & Tower B at 4th floor)
// 5. Shared Urban Podium Concourse with drop-off roundabout, EV stations & plaza.
// ─────────────────────────────────────────────────────────────────────────────
function createSmartCityScene() {
  const root = new THREE.Group();
  root.name = 'Thiruvananthapuram_TALD_SmartCity_MultiBuilding_Campus';

  // Materials: High-Tech Smart City Architecture
  const concreteFacade = new THREE.MeshStandardMaterial({
    color: 0x334155, // Architectural slate concrete
    roughness: 0.65,
    metalness: 0.15,
    name: 'Smart_Concrete_Structure',
  });
  const curtainGlassBlue = new THREE.MeshStandardMaterial({
    color: 0x0284c7, // Low-E Blue Smart City Glazing (Tower A)
    roughness: 0.1,
    metalness: 0.85,
    transparent: true,
    opacity: 0.84,
    name: 'Curtain_Wall_Glazing_Blue',
  });
  const curtainGlassTeal = new THREE.MeshStandardMaterial({
    color: 0x0d9488, // Low-E Teal Glazing (Tower B & Skybridge)
    roughness: 0.1,
    metalness: 0.85,
    transparent: true,
    opacity: 0.84,
    name: 'Curtain_Wall_Glazing_Teal',
  });
  const solarPanelMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a, // Photovoltaic silicon array
    roughness: 0.2,
    metalness: 0.88,
    name: 'Solar_PV_Array',
  });
  const steelFrame = new THREE.MeshStandardMaterial({
    color: 0x94a3b8, // Brushed aluminum mullions & skybridge truss
    roughness: 0.35,
    metalness: 0.75,
    name: 'Structural_Steel',
  });
  const podiumStone = new THREE.MeshStandardMaterial({
    color: 0x1e293b, // Dark basalt concourse plaza
    roughness: 0.8,
    metalness: 0.1,
    name: 'Podium_Concourse',
  });
  const greenRoof = new THREE.MeshStandardMaterial({
    color: 0x2d6a4f, // Living eco-roof vegetation
    roughness: 0.85,
    metalness: 0.05,
    name: 'Living_Eco_Roof',
  });
  const roadAsphalt = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.9,
    metalness: 0.05,
    name: 'Campus_Roadway',
  });

  // 0. CAMPUS PODIUM CONCOURSE & ROADWAY (Shared Campus Ground Base)
  const campusBase = new THREE.Mesh(
    new THREE.BoxGeometry(86, 1.0, 78),
    podiumStone
  );
  campusBase.position.set(0, 0.5, 0);
  campusBase.receiveShadow = true;
  root.add(campusBase);

  // Internal Circular Access Roadway / Drop-off
  const roadway = new THREE.Mesh(
    new THREE.RingGeometry(12, 17, 32),
    roadAsphalt
  );
  roadway.rotation.x = -Math.PI / 2;
  roadway.position.set(0, 1.02, 18);
  roadway.receiveShadow = true;
  root.add(roadway);

  // Central Landscaped Planter within Drop-off Roundabout
  const centralPlanter = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 10.5, 0.4, 32),
    greenRoof
  );
  centralPlanter.position.set(0, 1.2, 18);
  root.add(centralPlanter);

  // ─────────────────────────────────────────────────────────────
  // BUILDING 1: TOWER A (Main Commercial Tower - 8 Stories, 32m Height)
  // Located at center-west: (x: -12, z: -8)
  // ─────────────────────────────────────────────────────────────
  const towerA = new THREE.Group();
  towerA.name = 'Tower_A_Commercial_HighRise';
  towerA.position.set(-12, 0, -8);

  // Ground & Podium Base (Levels 1-2)
  const podiumA = new THREE.Mesh(new THREE.BoxGeometry(32, 7.5, 26), podiumStone);
  podiumA.position.set(0, 4.75, 0);
  podiumA.castShadow = true;
  towerA.add(podiumA);

  const atriumA = new THREE.Mesh(new THREE.BoxGeometry(32.4, 4.5, 12), curtainGlassBlue);
  atriumA.position.set(0, 4.25, 7.5);
  towerA.add(atriumA);

  // Mid-Tier Tower (Levels 3-6)
  const midTowerA = new THREE.Mesh(new THREE.BoxGeometry(26, 14.0, 22), curtainGlassBlue);
  midTowerA.position.set(0, 15.5, 0);
  midTowerA.castShadow = true;
  towerA.add(midTowerA);

  // Concrete Structural Floor Slabs for Levels 3-6
  for (let fl = 1; fl <= 4; fl++) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(26.8, 0.45, 22.8), concreteFacade);
    slab.position.set(0, 8.5 + fl * 3.5, 0);
    towerA.add(slab);
  }

  // Upper Executive Tier & Penthouse (Levels 7-8)
  const upperTowerA = new THREE.Mesh(new THREE.BoxGeometry(18, 7.0, 16), curtainGlassBlue);
  upperTowerA.position.set(0, 26.0, 0);
  upperTowerA.castShadow = true;
  towerA.add(upperTowerA);

  const upperSlabA = new THREE.Mesh(new THREE.BoxGeometry(18.6, 0.5, 16.6), concreteFacade);
  upperSlabA.position.set(0, 29.5, 0);
  towerA.add(upperSlabA);

  // Rooftop Solar Photovoltaic Canopy (5-deg tilt)
  const solarCanopy = new THREE.Mesh(new THREE.BoxGeometry(17, 0.25, 15), solarPanelMat);
  solarCanopy.position.set(0, 31.2, 0);
  solarCanopy.rotation.x = -0.08;
  solarCanopy.castShadow = true;
  towerA.add(solarCanopy);

  // Telecommunications & Air Quality Sensor Mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 5.5, 8), steelFrame);
  mast.position.set(5, 34.0, -4);
  towerA.add(mast);
  root.add(towerA);

  // ─────────────────────────────────────────────────────────────
  // BUILDING 2: TOWER B (IT & Operations Wing - 5 Stories, 20m Height)
  // Located at east: (x: +22, z: -8)
  // ─────────────────────────────────────────────────────────────
  const towerB = new THREE.Group();
  towerB.name = 'Tower_B_IT_Operations_Wing';
  towerB.position.set(22, 0, -8);

  // 5-Story Glass & Concrete Block
  const blockB = new THREE.Mesh(new THREE.BoxGeometry(22, 17.5, 20), curtainGlassTeal);
  blockB.position.set(0, 9.75, 0);
  blockB.castShadow = true;
  towerB.add(blockB);

  // Floor Plates (Levels 1 to 5)
  for (let fl = 0; fl <= 5; fl++) {
    const slabB = new THREE.Mesh(new THREE.BoxGeometry(22.8, 0.4, 20.8), concreteFacade);
    slabB.position.set(0, 1.0 + fl * 3.5, 0);
    towerB.add(slabB);
  }

  // Rooftop HVAC & Mechanical Equipment Enclosures
  const hvacUnit1 = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 4), steelFrame);
  hvacUnit1.position.set(-4, 19.6, -3);
  towerB.add(hvacUnit1);

  const hvacUnit2 = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 4), steelFrame);
  hvacUnit2.position.set(4, 19.6, -3);
  towerB.add(hvacUnit2);

  // Rooftop Terrace Pergola
  const pergola = new THREE.Mesh(new THREE.BoxGeometry(10, 0.3, 7), steelFrame);
  pergola.position.set(0, 20.5, 4);
  towerB.add(pergola);

  for (let px = -4; px <= 4; px += 8) {
    for (let pz = 1; pz <= 7; pz += 6) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.0, 8), steelFrame);
      pole.position.set(px, 19.5, pz);
      towerB.add(pole);
    }
  }
  root.add(towerB);

  // ─────────────────────────────────────────────────────────────
  // ELEVATED ENCLOSED SKYBRIDGE (Connecting Tower A & Tower B at Level 4)
  // Spanning between x = 1.0 and x = 11.0, at height y = 14m
  // ─────────────────────────────────────────────────────────────
  const skybridge = new THREE.Group();
  skybridge.name = 'Elevated_Skybridge_L4';
  skybridge.position.set(5.0, 14.0, -8);

  const bridgeGlass = new THREE.Mesh(new THREE.BoxGeometry(10.0, 3.2, 3.6), curtainGlassTeal);
  bridgeGlass.castShadow = true;
  skybridge.add(bridgeGlass);

  const bridgeFloor = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.3, 3.8), concreteFacade);
  bridgeFloor.position.set(0, -1.6, 0);
  skybridge.add(bridgeFloor);

  const bridgeRoof = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.3, 3.8), steelFrame);
  bridgeRoof.position.set(0, 1.6, 0);
  skybridge.add(bridgeRoof);
  root.add(skybridge);

  // ─────────────────────────────────────────────────────────────
  // BUILDING 3: WING C (Civic Innovation & Research Hub - 3 Stories, 12m Height)
  // Located at south-west foreground: (x: -10, z: +22)
  // ─────────────────────────────────────────────────────────────
  const wingC = new THREE.Group();
  wingC.name = 'Wing_C_Innovation_Research_Hub';
  wingC.position.set(-10, 0, 22);

  // Ground & Mid Floor (Levels 1-2)
  const baseC = new THREE.Mesh(new THREE.BoxGeometry(20, 7.0, 16), curtainGlassBlue);
  baseC.position.set(0, 4.5, 0);
  baseC.castShadow = true;
  wingC.add(baseC);

  // Cantilevered Upper Floor (Level 3)
  const upperC = new THREE.Mesh(new THREE.BoxGeometry(22, 3.5, 17), concreteFacade);
  upperC.position.set(1.0, 9.75, 0);
  upperC.castShadow = true;
  wingC.add(upperC);

  // Living Eco-Green Roof on Wing C
  const greenEcoRoof = new THREE.Mesh(new THREE.BoxGeometry(21.2, 0.35, 16.2), greenRoof);
  greenEcoRoof.position.set(1.0, 11.7, 0);
  wingC.add(greenEcoRoof);

  // Rooftop Garden Planters on Eco-Roof
  const planterC = new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, 5), podiumStone);
  planterC.position.set(1.0, 12.1, 0);
  wingC.add(planterC);
  root.add(wingC);

  // ─────────────────────────────────────────────────────────────
  // SMART CITY LIGHTING & EV CHARGING POSTS
  // ─────────────────────────────────────────────────────────────
  const lampPositions = [
    [-28, 1.0, -26], [28, 1.0, -26],
    [-28, 1.0, 32], [28, 1.0, 32],
    [0, 1.0, -24], [18, 1.0, 24]
  ];
  lampPositions.forEach(([lx, ly, lz]) => {
    const lampPost = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 4.0, 8), steelFrame);
    lampPost.position.set(lx, ly + 2.0, lz);
    root.add(lampPost);

    const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.4), steelFrame);
    lampHead.position.set(lx, ly + 4.0, lz);
    root.add(lampHead);
  });

  return root;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT ALL THREE GLB ASSETS
// ─────────────────────────────────────────────────────────────────────────────
async function generateAll() {
  const exporter = new GLTFExporter();

  const configs = [
    {
      scene: createRaniKiVavScene(),
      filename: 'rani-ki-vav.glb',
      label: "Rani ki Vav (The Queen's Stepwell & Entrance Torana)",
    },
    {
      scene: createAamKhasBaghScene(),
      filename: 'aam-khas-bagh.glb',
      label: 'Aam Khas Bagh (Mughal Royal Complex: Hammam, Daulat Khana, Baradari)',
    },
    {
      scene: createSmartCityScene(),
      filename: 'tald-smart-city.glb',
      label: 'Thiruvananthapuram Smart City (TALD Multi-Building Campus & Skybridge)',
    },
  ];

  for (const item of configs) {
    const outPath = path.join(modelsDir, item.filename);
    console.log(`Generating 3D model for ${item.label}...`);

    await new Promise((resolve, reject) => {
      exporter.parse(
        item.scene,
        (gltf) => {
          const buffer = Buffer.from(gltf);
          fs.writeFileSync(outPath, buffer);
          console.log(`✅ Exported ${item.filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
          resolve(true);
        },
        (err) => {
          console.error(`❌ Failed exporting ${item.filename}:`, err);
          reject(err);
        },
        { binary: true }
      );
    });
  }

  console.log('🎉 All LiDAR multi-building 3D models generated successfully!');
}

generateAll().catch(console.error);
