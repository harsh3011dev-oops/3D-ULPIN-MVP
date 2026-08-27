import React from 'react';
import Header from '../components/Header/Header';
import UploadForm from '../components/UploadForm/UploadForm';
import { Box, ShieldCheck, Cpu, Map, Hash, Layers } from 'lucide-react';
import './HomePage.css';

const STATS = [
  { value: '3D', label: 'Volumetric ULPIN', color: 'blue' },
  { value: '6', label: 'AI Pipeline Steps', color: 'cyan' },
  { value: 'ISO', label: '19152 LADM', color: 'purple' },
  { value: '0', label: 'Spatial Conflicts', color: 'green' },
];

const FEATURES = [
  { icon: Cpu, title: 'AI Footprint Detection', desc: 'OpenCV + Canny edge detection extracts real building boundaries from aerial imagery.', color: 'blue' },
  { icon: Layers, title: '3D Extrusion Engine', desc: 'Shapely geometry converts 2D parcel footprints into volumetric Building3D objects.', color: 'cyan' },
  { icon: Hash, title: 'Geohash ULPIN', desc: 'Each unit gets a globally unique spatial ID: PARCEL-BLDG-F01-UA01-geohash.', color: 'purple' },
  { icon: ShieldCheck, title: 'Spatial Validation', desc: 'Automated overlap detection and boundary constraint checks across all unit layers.', color: 'green' },
  { icon: Map, title: 'MapLibre GL + deck.gl', desc: 'Dual-engine 3D rendering — geospatial precision meets architectural visualization.', color: 'amber' },
  { icon: Box, title: 'Three.js Studio', desc: 'Hyper-realistic architectural models with PBR materials, shadows, and 360° rotation.', color: 'rose' },
];

export default function HomePage() {
  return (
    <div className="page-layout bg-grid">
      <Header />

      <main className="home-container">

        {/* ── Hero ── */}
        <section className="hero-section">
          <div className="hero-eyebrow">
            <span className="eyebrow-dot blue"></span>
            AI-Powered 3D Cadastral Intelligence
            <span className="eyebrow-dot cyan"></span>
          </div>

          <h1 className="hero-title">
            Assign <span className="gradient-text">Unique 3D Spatial IDs</span><br />
            to Every Property Unit
          </h1>

          <p className="hero-description">
            The 3D ULPIN system transforms 2D land parcel records into fully volumetric,
            AI-extracted cadastral models — with geohash-based identifiers, MapLibre GL
            base maps, deck.gl 3D extrusions, and automated spatial validation.
          </p>

          {/* Stats Row */}
          <div className="stats-row">
            {STATS.map((s, i) => (
              <div key={i} className={`stat-card stat-${s.color}`}>
                <span className="stat-value">{s.value}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Upload Form ── */}
        <section className="form-section">
          <UploadForm />
        </section>

        {/* ── Feature Grid ── */}
        <section className="features-section">
          <div className="features-header">
            <h2 className="section-title">How It Works</h2>
            <p className="section-subtitle">Six-step AI pipeline from aerial imagery to 3D ULPIN</p>
          </div>
          <div className="features-grid">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={i} className={`feature-card feature-${f.color}`}>
                  <div className={`feature-icon-box icon-${f.color}`}>
                    <Icon size={20} />
                  </div>
                  <div className="feature-content">
                    <h3 className="feature-title">{f.title}</h3>
                    <p className="feature-desc">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </main>
    </div>
  );
}
