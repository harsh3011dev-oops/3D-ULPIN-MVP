import React from 'react';
import { motion, Variants } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header/Header';
import { ShieldCheck, Compass, ArrowRight, Layers, Box, Cpu } from 'lucide-react';
import './HomePage.css';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 25 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="page-layout bg-grid">
      {/* ── Background Orbs Canvas ── */}
      <div className="home-bg-canvas" aria-hidden="true">
        <motion.div
          className="bg-orb orb-lavender"
          animate={{ x: [0, 40, -30, 0], y: [0, -30, 20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="bg-orb orb-rose"
          animate={{ x: [0, -30, 30, 0], y: [0, 25, -15, 0] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
      </div>

      <Header />

      <main className="home-centered-container">
        <motion.section
          className="hero-section-centered"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Badge Chips Row */}
          <motion.div className="hero-chips-row" variants={itemVariants}>
            <span className="version-chip font-mono">v2.4.0-rc1</span>
            <span className="ladm-chip chip-lavender">
              <ShieldCheck size={13} />
              LADM COMPLIANT (ISO 19152)
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1 className="hero-centered-title font-display" variants={itemVariants}>
            Intelligence for the <br />
            <span className="gradient-text font-display">Vertical Frontier</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p className="hero-centered-subtitle" variants={itemVariants}>
            Welcome to the 3D ULPIN Cadastral System. This platform automates the transformation of
            standard 2D parcel bounds into topologically extruded, multi-strata 3D volumetric records,
            minting persistent geohash-based Spatial Identifiers compliant with international LADM specifications.
          </motion.p>

          {/* Start CTA Button */}
          <motion.div className="hero-cta-wrapper" variants={itemVariants}>
            <button
              type="button"
              className="btn-primary start-explorer-btn"
              onClick={() => navigate('/explore')}
            >
              <span>Start Cadastral Explorer</span>
              <ArrowRight size={18} />
            </button>
          </motion.div>

          {/* Core Feature Highlights */}
          <motion.div className="features-highlight-grid" variants={containerVariants}>
            <motion.div className="feature-card glass-panel" variants={itemVariants}>
              <div className="feature-icon"><Box size={18} /></div>
              <h3 className="feature-title font-display">Volumetric Extrusion</h3>
              <p className="feature-desc">Procedurally project floor strata heights and generate LoD1 volumetric Building3D geometries.</p>
            </motion.div>

            <motion.div className="feature-card glass-panel" variants={itemVariants}>
              <div className="feature-icon"><Layers size={18} /></div>
              <h3 className="feature-title font-display">Multi-Strata Division</h3>
              <p className="feature-desc">Slice structural envelopes into precise, isolated vertical property units with unique ownership tags.</p>
            </motion.div>

            <motion.div className="feature-card glass-panel" variants={itemVariants}>
              <div className="feature-icon"><Cpu size={18} /></div>
              <h3 className="feature-title font-display">ULPIN Minting Engine</h3>
              <p className="feature-desc">Generate persistent, space-filling geohash keys mapped directly to coordinates, elevations, and levels.</p>
            </motion.div>
          </motion.div>
        </motion.section>
      </main>
    </div>
  );
}
