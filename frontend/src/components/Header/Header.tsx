import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, Upload, Compass } from 'lucide-react';
import './Header.css';

export default function Header() {
  const location = useLocation();

  return (
    <header className="app-header glass-panel border-b border-white/10">
      <div className="header-brand flex items-center gap-3">
        <Link to="/" className="brand-logo flex items-center gap-3 text-white no-underline">
          <div className="logo-icon-wrapper w-9 h-9 rounded-md bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center text-white shadow-glow">
            <Box className="logo-icon w-5.5 h-5.5" />
          </div>
          <div className="brand-text flex flex-col">
            <span className="brand-title font-extrabold text-lg bg-gradient-to-r from-white to-blue-300 bg-clip-text text-transparent">
              3D ULPIN
            </span>
            <span className="brand-tagline text-[0.7rem] text-gray-400 uppercase tracking-wider font-medium">
              deck.gl + MapLibre 3D
            </span>
          </div>
        </Link>
        <span className="badge-mvp bg-blue-500/15 text-blue-400 border border-blue-500/30 text-[0.7rem] font-bold px-2 py-0.5 rounded-full">
          v2.0 TS
        </span>
      </div>

      <nav className="header-nav flex items-center gap-2">
        <Link
          to="/"
          className={`nav-link flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            location.pathname === '/' ? 'text-blue-400 bg-blue-500/15 border border-blue-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Upload size={16} />
          <span>Upload Building</span>
        </Link>
        
        <Link
          to="/map/550e8400-e29b-41d4-a716-446655440000"
          className={`nav-link flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            location.pathname.startsWith('/map') ? 'text-blue-400 bg-blue-500/15 border border-blue-500/30' : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Compass size={16} />
          <span>3D Map Explorer</span>
        </Link>
      </nav>

      <div className="header-actions flex items-center gap-4">
        <div className="system-status-indicator flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold text-emerald-400">
          <span className="status-dot online w-2 h-2 rounded-full bg-emerald-500 shadow-glow animate-pulse"></span>
          <span className="status-label">FastAPI Engine</span>
        </div>
      </div>
    </header>
  );
}
