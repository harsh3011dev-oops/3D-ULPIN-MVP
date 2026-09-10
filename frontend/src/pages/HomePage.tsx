import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header/Header';
import GlobalArchitecturalBackground3D, { SectionState } from '../components/Cadastral3D/GlobalArchitecturalBackground3D';
import {
  ArrowRight,
  ShieldCheck,
  Layers,
  Box,
  CheckCircle2,
  MapPin,
  Maximize2,
  Sparkles,
  ChevronRight,
  Globe2
} from 'lucide-react';
import './HomePage.css';

const HOW_IT_WORKS_STEPS = [
  {
    key: 'land',
    step: '01',
    label: 'LAND',
    title: 'Geodetic Parcel Boundary',
    desc: 'WGS84 2D surface polygon indexed to national geodetic datum.',
  },
  {
    key: 'building',
    step: '02',
    label: 'BUILDING',
    title: 'Volumetric Envelope',
    desc: 'Metric extrusion computing topological height limits and total volume.',
  },
  {
    key: 'floor',
    step: '03',
    label: 'FLOOR',
    title: 'Multi-Strata Division',
    desc: 'Vertical elevation slicing defining discrete floor levels.',
  },
  {
    key: 'unit',
    step: '04',
    label: 'UNIT',
    title: 'Isolated Spatial Unit',
    desc: 'Independent 3D bounding volume with certified interior airspace.',
  },
  {
    key: 'ulpin',
    step: '05',
    label: '3D ULPIN',
    title: 'Unique 3D Identifier',
    desc: 'Immutable ISO 19152 compliant spatial key minted with geohash + level.',
  },
];

const CORE_CAPABILITIES = [
  {
    id: '01',
    icon: Maximize2,
    title: '3D Property Mapping',
    desc: 'Converts flat 2D deed polygons into certified 3D volumes (LoD1/2) with accurate Z-elevation limits and m³ capacity.',
    badge: 'Volumetric Cadastre',
  },
  {
    id: '02',
    icon: Layers,
    title: 'Vertical Property Registration',
    desc: 'Enables individual strata title deeds for high-rise units, assigning distinct ownership and usage rights per vertical floor.',
    badge: 'Strata Subdivision',
  },
  {
    id: '03',
    icon: ShieldCheck,
    title: 'Spatial Clash Validation',
    desc: 'Automated 3D intersection detection prevents property boundary encroachment and guarantees clean spatial rights.',
    badge: '0% Overlap Clash',
  },
  {
    id: '04',
    icon: MapPin,
    title: 'Unique 3D ULPIN Keys',
    desc: 'Synthesizes immutable 14-to-24 character geohash keys encoding state, parcel centroid, vertical floor, and unit index.',
    badge: 'ISO 19152 LADM',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<SectionState>('hero');
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);

  const heroRef = useRef<HTMLElement>(null);
  const howRef = useRef<HTMLElement>(null);
  const capRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLElement>(null);

  // Section visibility tracking via IntersectionObserver
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-30% 0px -30% 0px',
      threshold: 0.1,
    };

    const handleIntersect: IntersectionObserverCallback = (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          if (id === 'hero-section') setActiveSection('hero');
          else if (id === 'how-it-works-section') setActiveSection('how-it-works');
          else if (id === 'capabilities-section') setActiveSection('capabilities');
          else if (id === 'cta-section') setActiveSection('cta');
        }
      });
    };

    const observer = new IntersectionObserver(handleIntersect, observerOptions);

    if (heroRef.current) observer.observe(heroRef.current);
    if (howRef.current) observer.observe(howRef.current);
    if (capRef.current) observer.observe(capRef.current);
    if (ctaRef.current) observer.observe(ctaRef.current);

    return () => observer.disconnect();
  }, []);

  // Real-time scroll progress tracking for How It Works stages (Land -> Building -> Floor -> Unit -> ULPIN)
  useEffect(() => {
    const handleScroll = () => {
      if (!howRef.current) return;
      const rect = howRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;

      if (rect.top <= viewportHeight * 0.75 && rect.bottom >= viewportHeight * 0.25) {
        const totalRange = rect.height + viewportHeight * 0.5;
        const currentProgress = (viewportHeight * 0.75 - rect.top) / totalRange;
        const clampedProgress = Math.max(0, Math.min(0.99, currentProgress));
        const stepIdx = Math.floor(clampedProgress * HOW_IT_WORKS_STEPS.length);
        setActiveStepIndex(stepIdx);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="homepage-root">
      {/* ── PERSISTENT GLOBAL 3D ARCHITECTURAL BACKGROUND ── */}
      <GlobalArchitecturalBackground3D
        activeSection={activeSection}
        activeStepIndex={activeStepIndex}
      />

      {/* ── STICKY NAVIGATION BAR ── */}
      <Header />

      {/* ── SECTION 1: HERO (WIDE 3D INDIA VISTA) ── */}
      <section id="hero-section" ref={heroRef} className="hp-section hp-hero-section">
        <div className="hp-container">
          <motion.div
            className="hero-content-card"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="hero-badge-row">
              <span className="cad-chip">
                <ShieldCheck size={13} strokeWidth={2.2} />
                <span>3D CADASTRAL INTELLIGENCE</span>
              </span>
              <span className="cad-chip-mono">
                <Globe2 size={12} color="#0D9488" style={{ marginRight: 4 }} />
                DIGITAL TWIN INDIA
              </span>
            </div>

            <h1 className="hero-title font-display">
              Land records were flat.<br />
              <span className="hero-highlight">Property isn't.</span>
            </h1>

            <p className="hero-subtitle">
              Traditional deed systems index real estate across two-dimensional surfaces. 
              <strong> 3D ULPIN</strong> reconstructs structural topologies into certified volumetric parcels, 
              minting persistent spatial identifiers for every vertical floor stratum and isolated unit.
            </p>

            <div className="hero-actions">
              <button
                type="button"
                className="btn-primary hero-btn-main"
                onClick={() => navigate('/explore')}
              >
                <span>Explore 3D Map</span>
                <ArrowRight size={16} strokeWidth={2.2} />
              </button>

              <a href="#how-it-works-section" className="btn-secondary hero-btn-sub">
                <span>How It Works</span>
                <ChevronRight size={14} />
              </a>
            </div>

            {/* Quick Metrics */}
            <div className="hero-micro-metrics font-mono">
              <div className="micro-metric">
                <span className="metric-k">DIMENSIONALITY</span>
                <span className="metric-v">3D Volumetric (LoD1/2)</span>
              </div>
              <div className="metric-divider" />
              <div className="micro-metric">
                <span className="metric-k">PRECISION</span>
                <span className="metric-v">Sub-meter Geodetic</span>
              </div>
              <div className="metric-divider" />
              <div className="micro-metric">
                <span className="metric-k">VALIDATION</span>
                <span className="metric-v">0% Boundary Clash</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── SECTION 2: HOW 3D ULPIN WORKS (COMPACT 5-STEP SEQUENCE) ── */}
      <section id="how-it-works-section" ref={howRef} className="hp-section hp-how-section">
        <div className="hp-container">
          <div className="section-header-compact">
            <span className="section-eyebrow font-mono">STEP-BY-STEP TOPOLOGY</span>
            <h2 className="section-heading">How 3D ULPIN Resolves Space</h2>
            <p className="section-subheading">
              A continuous 5-stage transformation from 2D parcel ground deeds to certified vertical title units.
            </p>
          </div>

          <div className="how-steps-sequence">
            {HOW_IT_WORKS_STEPS.map((item, idx) => {
              const isActive = activeStepIndex === idx;
              return (
                <div
                  key={item.key}
                  className={`how-step-card ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveStepIndex(idx)}
                  onMouseEnter={() => setActiveStepIndex(idx)}
                >
                  <div className="step-card-top font-mono">
                    <span className="step-number">{item.step}</span>
                    <span className="step-badge">{item.label}</span>
                  </div>
                  <h3 className="step-title">{item.title}</h3>
                  <p className="step-desc">{item.desc}</p>
                  <div className="step-active-indicator" />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SECTION 3: CORE CAPABILITIES (4 CONCISE CARDS) ── */}
      <section id="capabilities-section" ref={capRef} className="hp-section hp-capabilities-section">
        <div className="hp-container">
          <div className="section-header-compact">
            <span className="section-eyebrow font-mono">ENGINEERING EXCELLENCE</span>
            <h2 className="section-heading">Core System Capabilities</h2>
            <p className="section-subheading">
              Built for national land registries, municipal GIS departments, and modern property administration.
            </p>
          </div>

          <div className="capabilities-grid">
            {CORE_CAPABILITIES.map((cap) => {
              const IconComp = cap.icon;
              return (
                <div key={cap.id} className="capability-card">
                  <div className="cap-card-header">
                    <div className="cap-icon-box">
                      <IconComp size={20} strokeWidth={2} />
                    </div>
                    <span className="cap-badge font-mono">{cap.badge}</span>
                  </div>
                  <h3 className="cap-title">{cap.title}</h3>
                  <p className="cap-desc">{cap.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: FINAL CTA (ONE NATION. A SPATIAL FUTURE.) ── */}
      <section id="cta-section" ref={ctaRef} className="hp-section hp-cta-section">
        <div className="hp-container">
          <div className="cta-banner-card">
            <div className="cta-banner-left">
              <span className="cta-tag font-mono">
                <Sparkles size={13} color="#22D3EE" />
                <span>SPATIAL CADASTRE · BHARAT 3D</span>
              </span>
              <h2 className="cta-banner-title font-display">
                One nation. A spatial future.
              </h2>
              <p className="cta-banner-desc">
                Reconstruct structural topologies across landmark urban centers and state registries. Query coordinates, inspect exploded strata levels, and mint verified 3D ULPINs.
              </p>
            </div>

            <div className="cta-banner-right">
              <button
                type="button"
                className="btn-primary cta-launch-btn"
                onClick={() => navigate('/explore')}
              >
                <span>Launch 3D Explorer</span>
                <ArrowRight size={16} strokeWidth={2.2} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── STREAMLINED FOOTER ── */}
      <footer className="hp-footer">
        <div className="hp-container hp-footer-inner font-mono">
          <div className="footer-left">
            <Box size={15} color="#0D9488" />
            <span className="footer-title">3D ULPIN PLATFORM</span>
            <span className="footer-muted">· ISO 19152 LADM Compliant</span>
          </div>

          <div className="footer-right">
            <span>EPSG:4326 / WGS84</span>
            <span className="footer-dot">•</span>
            <span>LoD1/LoD2 Geometry</span>
            <span className="footer-dot">•</span>
            <span className="footer-status">SYSTEM OPERATIONAL</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
