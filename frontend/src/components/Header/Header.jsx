import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, Layers, ShieldCheck, Upload, Compass } from 'lucide-react';
import './Header.css';

export default function Header() {
  const location = useLocation();

  return (
    <header className="app-header glass-panel">
      <div className="header-brand">
        <Link to="/" className="brand-logo">
          <div className="logo-icon-wrapper">
            <Box className="logo-icon" />
          </div>
          <div className="brand-text">
            <span className="brand-title">3D ULPIN</span>
            <span className="brand-tagline">AI Cadastral System</span>
          </div>
        </Link>
        <span className="badge-mvp">MVP v1.0</span>
      </div>

      <nav className="header-nav">
        <Link
          to="/"
          className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
        >
          <Upload size={16} />
          <span>Upload Building</span>
        </Link>
        
        <Link
          to="/map/550e8400-e29b-41d4-a716-446655440000"
          className={`nav-link ${location.pathname.startsWith('/map') ? 'active' : ''}`}
        >
          <Compass size={16} />
          <span>3D Map Explorer</span>
        </Link>
      </nav>

      <div className="header-actions">
        <div className="system-status-indicator" title="Backend Integration Ready">
          <span className="status-dot online"></span>
          <span className="status-label">FastAPI Engine</span>
        </div>
      </div>
    </header>
  );
}
