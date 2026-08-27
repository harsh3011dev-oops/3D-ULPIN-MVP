import React from 'react';
import Header from '../components/Header/Header';
import UploadForm from '../components/UploadForm/UploadForm';
import { ShieldCheck, Cpu, Layers, Tag, Scale, Satellite, Box } from 'lucide-react';
import './HomePage.css';

const STATS = [
  { label: 'Engine State', value: '3D Extrusion Ready', color: 'blue' },
  { label: 'Pipeline Depth', value: '6 AI Steps', color: 'cyan' },
  { label: 'Standard', value: 'ISO 19152 LADM', color: 'purple' },
  { label: 'Integrity', value: '0 Conflict Records', color: 'green' },
];

const PIPELINE_ARCH = [
  { icon: 'satellite_alt', title: '1. Footprint Detection', desc: 'Extract vector outline from raster image.' },
  { icon: 'view_in_ar', title: '2. 3D Extrusion', desc: 'Generate LoD1 volumetric Building3D model.' },
  { icon: 'layers', title: '3. Floor Division', desc: 'Slice volume into logical elevation strata.' },
  { icon: 'grid_on', title: '4. Unit Subdivision', desc: 'Define individual property cadastral bounds.' },
  { icon: 'tag', title: '5. ULPIN Generation', desc: 'Mint persistent geohash-based 3D spatial IDs.' },
  { icon: 'rule', title: '6. Spatial Validation', desc: 'Check overlaps & 3D topology constraint rules.' },
];

export default function HomePage() {
  return (
    <div className="page-layout bg-grid">
      <Header />

      <main className="home-container">

        {/* ── Top Hero Banner (From Zip 2 Design) ── */}
        <section className="hero-banner-stitch">
          <div className="banner-glow-1"></div>
          <div className="banner-glow-2"></div>
          <div className="hero-banner-content">
            <div className="hero-banner-text">
              <div className="banner-chips-row">
                <span className="version-chip">v2.4.0-rc1</span>
                <span className="ladm-chip font-mono">
                  <ShieldCheck size={13} />
                  LADM COMPLIANT (ISO 19152)
                </span>
              </div>
              <h1 className="hero-banner-title">
                Intelligence for the <span className="gradient-text">Vertical Frontier</span>
              </h1>
              <p className="hero-banner-subtitle">
                Initialize automated 3D Cadastral pipelines. Ingest 2D land parcel boundaries, extrude topological volumes, and assign persistent Universal Land Parcel Identification Numbers per spatial unit.
              </p>
            </div>

            {/* 4 Stat Cards */}
            <div className="banner-stats-grid">
              {STATS.map((s, i) => (
                <div key={i} className={`stat-box stat-box-${s.color}`}>
                  <span className="stat-box-lbl">{s.label}</span>
                  <span className="stat-box-val">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Console & Architecture Split Layout ── */}
        <div className="ingestion-layout-grid">
          {/* Main Console Form */}
          <div className="console-main-col">
            <UploadForm />
          </div>

          {/* Right Sidebar Architecture Widget */}
          <aside className="architecture-sidebar-col">
            {/* Preview Spatial Engine Card */}
            <div className="preview-engine-card">
              <div className="preview-overlay-bg"></div>
              <div className="preview-card-content">
                <span className="preview-tag">
                  <span className="material-symbols-outlined text-[15px]">visibility</span>
                  PREVIEW ENGINE
                </span>
                <div className="preview-text-group">
                  <span className="preview-title">Spatial Telemetry</span>
                  <span className="preview-status">MapLibre GL + deck.gl Active</span>
                </div>
              </div>
            </div>

            {/* Pipeline Architecture Widget */}
            <div className="pipeline-arch-card glass-panel">
              <div className="arch-card-header">
                <span className="material-symbols-outlined text-primary text-[18px]">memory</span>
                <h3 className="arch-card-title">Pipeline Architecture</h3>
              </div>
              <div className="arch-steps-list">
                {PIPELINE_ARCH.map((step, idx) => (
                  <div key={idx} className="arch-step-item">
                    <div className="arch-step-icon">
                      <span className="material-symbols-outlined text-[18px]">{step.icon}</span>
                    </div>
                    <div className="arch-step-info">
                      <span className="arch-step-name">{step.title}</span>
                      <span className="arch-step-desc">{step.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

      </main>
    </div>
  );
}
