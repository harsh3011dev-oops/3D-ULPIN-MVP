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
// Inverted temple stepwell: 65m length, 20m width, 28m depth.
// 7 terraced subterranean strata with pillared pavilions, stair sequences, and well.
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

  const rimEast = new THREE.Mesh(new THREE.BoxGeometry(36, 2, 10), groundPlaza);
  rimEast.position.set(0, 0, 40);
  root.add(rimEast);

  // Deep Stepwell Excavation Trench Retaining Walls
  const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(2, 28, 68), sandstoneDark);
  wallLeft.position.set(-10, -14, 0);
  root.add(wallLeft);

  const wallRight = new THREE.Mesh(new THREE.BoxGeometry(2, 28, 68), sandstoneDark);
  wallRight.position.set(10, -14, 0);
  root.add(wallRight);

  // 7 Subterranean Terraced Pavilion Levels (Descending from East to West)
  const TOTAL_LEVELS = 7;
  for (let lvl = 1; lvl <= TOTAL_LEVELS; lvl++) {
    const depth = lvl * 3.8; // Descending depth
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
    root.add(platform);

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
      root.add(pillar);

      // Capital / Bracket atop pillar
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.35, 0.9),
        sandstoneDark
      );
      cap.position.set(px, -depth + 3.7, zPos);
      root.add(cap);
    }

    // Horizontal Beam / Lintel spanning the pillars
    const lintel = new THREE.Mesh(
      new THREE.BoxGeometry(16.5, 0.5, 1.2),
      sandstoneMain
    );
    lintel.position.set(0, -depth + 3.9, zPos);
    root.add(lintel);

    // Stepped lateral stairway flights descending to this terrace
    const stepCount = 8;
    for (let s = 0; s < stepCount; s++) {
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(6, 0.45, 1.0),
        sandstoneDark
      );
      stepMesh.position.set(0, -depth + 3.8 - (s * 0.45), zPos + 4.2 - (s * 1.0));
      stepMesh.receiveShadow = true;
      root.add(stepMesh);
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
  root.add(wellWall);

  // Cylindrical inner tiers of the well
  for (let ring = 1; ring <= 5; ring++) {
    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(wellRadius, 0.4, 8, 32),
      sandstoneMain
    );
    ringMesh.rotation.x = Math.PI / 2;
    ringMesh.position.set(0, -(ring * 5), -30);
    root.add(ringMesh);
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
// 2. AAM KHAS BAGH (Mughal Hammam & Subterranean Channels, Sirhind, Punjab)
// 16th-century Mughal royal bathhouse: central octagonal vaulted hall,
// subterranean hypocaust terracotta heating channels, rooftop steam vents & domes.
// ─────────────────────────────────────────────────────────────────────────────
function createAamKhasBaghScene() {
  const root = new THREE.Group();
  root.name = 'Aam_Khas_Bagh_LiDAR_Digital_Twin';

  // Materials: Mughal Sirhind Teracotta Bricks, Plaster & Domes
  const mughalBrick = new THREE.MeshStandardMaterial({
    color: 0xbd5338, // Rich baked Mughal terracotta brick
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
    color: 0x6e473b, // Dark underground hypocaust flue masonry
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
    color: 0xf0f3f4, // Central ablution fountain
    roughness: 0.3,
    metalness: 0.1,
    name: 'Hammam_Fountain_Marble',
  });

  // 1. SUBTERRANEAN HYPOCAUST HEATING SYSTEM (Beneath 0.0m floor level)
  const hypoBase = new THREE.Mesh(
    new THREE.BoxGeometry(36, 1.2, 36),
    subterraneanStone
  );
  hypoBase.position.set(0, -2.2, 0);
  root.add(hypoBase);

  // Hypocaust Support Pillars (Suspended bathhouse floor over hot-air channels)
  for (let x = -14; x <= 14; x += 4.5) {
    for (let z = -14; z <= 14; z += 4.5) {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.6, 1.2),
        subterraneanStone
      );
      pillar.position.set(x, -1.0, z);
      root.add(pillar);
    }
  }

  // Terracotta Underfloor Thermal Air Conduits (Laser-scanned heating channels)
  const conduit1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 30, 16),
    terracottaPipes
  );
  conduit1.rotation.z = Math.PI / 2;
  conduit1.position.set(0, -1.1, -6);
  root.add(conduit1);

  const conduit2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.4, 30, 16),
    terracottaPipes
  );
  conduit2.rotation.z = Math.PI / 2;
  conduit2.position.set(0, -1.1, 6);
  root.add(conduit2);

  // 2. MAIN GROUND BATHHOUSE PLINTH & FLOORING
  const mainFloor = new THREE.Mesh(
    new THREE.BoxGeometry(34, 0.6, 34),
    buffPlaster
  );
  mainFloor.position.set(0, 0.3, 0);
  mainFloor.receiveShadow = true;
  root.add(mainFloor);

  // Central Octagonal Ablution Basin / Fountain
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(3.2, 3.2, 0.7, 8),
    marbleBasin
  );
  fountain.position.set(0, 0.7, 0);
  root.add(fountain);

  // 3. MAIN OCTAGONAL BATHHOUSE HALL (Hammam Chambers)
  // Central Hall Walls
  const centralWall = new THREE.Mesh(
    new THREE.CylinderGeometry(9.2, 9.2, 5.5, 8, 1, true),
    mughalBrick
  );
  centralWall.position.set(0, 3.35, 0);
  centralWall.castShadow = true;
  centralWall.receiveShadow = true;
  root.add(centralWall);

  // Vaulted Roof Drum & Central Mughal Dome
  const domeDrum = new THREE.Mesh(
    new THREE.CylinderGeometry(8.6, 9.2, 1.2, 16),
    buffPlaster
  );
  domeDrum.position.set(0, 6.7, 0);
  root.add(domeDrum);

  const centralDome = new THREE.Mesh(
    new THREE.SphereGeometry(7.2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    buffPlaster
  );
  centralDome.position.set(0, 7.3, 0);
  centralDome.castShadow = true;
  root.add(centralDome);

  // Rooftop Central Steam Lantern / Finial
  const finial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 1.2, 1.6, 8),
    mughalBrick
  );
  finial.position.set(0, 14.8, 0);
  root.add(finial);

  // 4 Corner Steam Chambers (Secondary Domes)
  const cornerCoords = [
    [-11, -11],
    [11, -11],
    [-11, 11],
    [11, 11],
  ];
  cornerCoords.forEach(([cx, cz]) => {
    const chamber = new THREE.Mesh(
      new THREE.BoxGeometry(8, 4.8, 8),
      mughalBrick
    );
    chamber.position.set(cx, 3.0, cz);
    chamber.castShadow = true;
    root.add(chamber);

    const miniDome = new THREE.Mesh(
      new THREE.SphereGeometry(3.5, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      buffPlaster
    );
    miniDome.position.set(cx, 5.4, cz);
    miniDome.castShadow = true;
    root.add(miniDome);
  });

  return root;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. THIRUVANANTHAPURAM SMART CITY (TALD LiDAR Urban Digital Twin)
// Modern 8-story Smart City commercial campus: stepped glass/steel tower,
// podium, underground utility corridors, rooftop solar panel arrays.
// ─────────────────────────────────────────────────────────────────────────────
function createSmartCityScene() {
  const root = new THREE.Group();
  root.name = 'Thiruvananthapuram_TALD_LiDAR_Twin';

  // Materials: Modern Smart City Architecture
  const concreteFacade = new THREE.MeshStandardMaterial({
    color: 0x334155, // Architectural slate concrete
    roughness: 0.65,
    metalness: 0.15,
    name: 'Smart_Concrete_Structure',
  });
  const curtainGlass = new THREE.MeshStandardMaterial({
    color: 0x0284c7, // Low-E Blue Smart City Glazing
    roughness: 0.1,
    metalness: 0.85,
    transparent: true,
    opacity: 0.82,
    name: 'Curtain_Wall_Glazing',
  });
  const solarPanelMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a, // Photovoltaic silicon array
    roughness: 0.2,
    metalness: 0.88,
    name: 'Solar_PV_Array',
  });
  const steelFrame = new THREE.MeshStandardMaterial({
    color: 0x94a3b8, // Brushed aluminum mullions
    roughness: 0.35,
    metalness: 0.7,
    name: 'Structural_Steel',
  });
  const podiumStone = new THREE.MeshStandardMaterial({
    color: 0x1e293b, // Ground concourse
    roughness: 0.8,
    metalness: 0.1,
    name: 'Podium_Concourse',
  });

  // 1. Ground Concourse & 2-Story Podium Base (Levels 1-2)
  const podium = new THREE.Mesh(
    new THREE.BoxGeometry(42, 8.0, 36),
    podiumStone
  );
  podium.position.set(0, 4.0, 0);
  podium.castShadow = true;
  podium.receiveShadow = true;
  root.add(podium);

  // Ground Floor Double-Height Glazing Atrium
  const atrium = new THREE.Mesh(
    new THREE.BoxGeometry(42.4, 5.0, 16),
    curtainGlass
  );
  atrium.position.set(0, 3.5, 10.2);
  root.add(atrium);

  // 2. Mid-Tier Tower (Levels 3-6)
  const midTower = new THREE.Mesh(
    new THREE.BoxGeometry(32, 14.0, 26),
    curtainGlass
  );
  midTower.position.set(0, 15.0, 0);
  midTower.castShadow = true;
  root.add(midTower);

  // Structural Floor Slabs (Levels 3, 4, 5, 6)
  for (let fl = 1; fl <= 4; fl++) {
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(32.8, 0.4, 26.8),
      concreteFacade
    );
    slab.position.set(0, 8.0 + fl * 3.5, 0);
    root.add(slab);
  }

  // 3. Upper Tower & Penthouse Tier (Levels 7-8)
  const upperTower = new THREE.Mesh(
    new THREE.BoxGeometry(22, 7.5, 20),
    curtainGlass
  );
  upperTower.position.set(0, 25.75, 0);
  upperTower.castShadow = true;
  root.add(upperTower);

  const upperSlab = new THREE.Mesh(
    new THREE.BoxGeometry(22.6, 0.5, 20.6),
    concreteFacade
  );
  upperSlab.position.set(0, 29.75, 0);
  root.add(upperSlab);

  // 4. Rooftop Solar Panel Canopy (Smart City Green Energy)
  const solarCanopy = new THREE.Mesh(
    new THREE.BoxGeometry(20, 0.2, 18),
    solarPanelMat
  );
  solarCanopy.position.set(0, 31.5, 0);
  solarCanopy.rotation.x = -0.08; // 5 degree tilt toward South
  solarCanopy.castShadow = true;
  root.add(solarCanopy);

  // Rooftop Telemetry Antenna & Sensor Mast
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.35, 6.0, 8),
    steelFrame
  );
  mast.position.set(6, 34.5, -5);
  root.add(mast);

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
      label: "Rani ki Vav (The Queen's Stepwell)",
    },
    {
      scene: createAamKhasBaghScene(),
      filename: 'aam-khas-bagh.glb',
      label: 'Aam Khas Bagh (Hammam & Subterranean Conduits)',
    },
    {
      scene: createSmartCityScene(),
      filename: 'tald-smart-city.glb',
      label: 'Thiruvananthapuram Smart City (TALD LiDAR)',
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

  console.log('🎉 All LiDAR 3D models generated successfully!');
}

generateAll().catch(console.error);
