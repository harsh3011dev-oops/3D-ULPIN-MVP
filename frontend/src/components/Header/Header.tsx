import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, Upload, Compass, Globe, Cpu } from 'lucide-react';
import './Header.css';

export default function Header() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isMap = location.pathname.startsWith('/map');

  return (
    <header className="app-header">
      {/* Brand */}
      <div className="header-brand">
        <Link to="/" className="brand-logo">
          <div className="logo-icon-wrapper">
            <Box size={20} />
          </div>
          <div className="brand-text">
            <span className="brand-title">3D ULPIN</span>
            <span className="brand-tagline">Cadastral Intelligence</span>
          </div>
        </Link>
        <span className="badge-mvp">MVP</span>
      </div>

      {/* Nav */}
      <nav className="header-nav">
        <Link to="/" className={`nav-link ${isHome ? 'active' : ''}`}>
          <Upload size={15} />
          <span>Submit Building</span>
        </Link>
        <Link to="/map/bldg-tajmahal-007" className={`nav-link ${isMap ? 'active' : ''}`}>
          <Compass size={15} />
          <span>3D Explorer</span>
        </Link>
      </nav>

      {/* Status */}
      <div className="header-actions">
        <div className="tech-chip">
          <Globe size={12} />
          <span>MapLibre</span>
        </div>
        <div className="tech-chip cyan">
          <Cpu size={12} />
          <span>deck.gl</span>
        </div>
        <div className="system-status-indicator">
          <span className="status-dot"></span>
          <span>AI Engine</span>
        </div>
      </div>
    </header>
  );
}
