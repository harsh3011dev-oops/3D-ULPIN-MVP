import React from 'react';
import Header from '../components/Header/Header';
import UploadForm from '../components/UploadForm/UploadForm';
import { Box, ShieldCheck, Cpu } from 'lucide-react';
import './HomePage.css';

export default function HomePage() {
  return (
    <div className="page-layout">
      <Header />

      <main className="home-container">
        {/* Hero Section */}
        <section className="hero-section text-center">
          <div className="hero-badge">
            <Cpu size={14} />
            <span>MapLibre GL + deck.gl 3D Cadastral System</span>
          </div>

          <h1 className="hero-title">
            Transform 2D Land Parcels into <span className="gradient-text">3D Volumetric ULPIN</span>
          </h1>

          <p className="hero-description">
            Assign unique, legal 3D spatial identification numbers to high-rise property units using AI-driven extrusion, MapLibre base maps, deck.gl 3D visualization, and automated collision validation.
          </p>

          <div className="features-strip">
            <div className="feature-item">
              <Box size={16} className="text-blue" />
              <span>deck.gl 3D Volumetric Extrusion</span>
            </div>
            <div className="feature-item">
              <ShieldCheck size={16} className="text-green" />
              <span>Spatial Overlap Validation</span>
            </div>
            <div className="feature-item">
              <Cpu size={16} className="text-cyan" />
              <span>OpenStreetMap / MapLibre GL</span>
            </div>
          </div>
        </section>

        {/* Upload Form Component */}
        <section className="form-section">
          <UploadForm />
        </section>
      </main>
    </div>
  );
}
