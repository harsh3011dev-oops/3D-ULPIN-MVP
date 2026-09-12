import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Box, ArrowUpRight, Activity } from 'lucide-react';
import { subscribeBackendStatus } from '../../utils/backendWarmup';
import './Header.css';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';
  const isExplore = location.pathname === '/explore';

  const [backendStatus, setBackendStatus] = useState<'checking' | 'awake' | 'waking_up' | 'error'>('checking');

  useEffect(() => {
    return subscribeBackendStatus(setBackendStatus);
  }, []);

  return (
    <header className="cadastral-header">
      <div className="header-inner">
        {/* Left: Brand / System Descriptor */}
        <Link to="/" className="header-brand">
          <div className="brand-symbol">
            <Box size={18} strokeWidth={2.2} />
          </div>
          <div className="brand-meta">
            <div className="brand-title">3D ULPIN</div>
            <div className="brand-tag">Cadastral Intelligence</div>
          </div>
        </Link>

        {/* Center: Navigation Links */}
        <nav className="header-nav">
          <Link
            to="/"
            className={`nav-link ${isHome ? 'active' : ''}`}
          >
            <span>Overview</span>
            {isHome && <motion.div className="nav-indicator" layoutId="nav-underline" />}
          </Link>

          {isHome ? (
            <a href="#how-it-works-section" className="nav-link">
              <span>How It Works</span>
            </a>
          ) : (
            <Link to="/#how-it-works-section" className="nav-link">
              <span>How It Works</span>
            </Link>
          )}

          <Link
            to="/explore"
            className={`nav-link ${isExplore ? 'active' : ''}`}
          >
            <span>Explore</span>
            {isExplore && <motion.div className="nav-indicator" layoutId="nav-underline" />}
          </Link>
        </nav>

        {/* Right: CTA Action */}
        <div className="header-actions">
          <button
            type="button"
            className="btn-primary header-cta-btn"
            onClick={() => navigate('/explore')}
          >
            <span>Open 3D Map</span>
            <ArrowUpRight size={15} strokeWidth={2.2} className="cta-arrow" />
          </button>
        </div>
      </div>
    </header>
  );
}
