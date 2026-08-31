import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Box, Upload, Compass, Search } from 'lucide-react';
import './Header.css';

const NAV_ITEMS = [
  { label: 'Home',       icon: Upload,  to: '/' },
  { label: 'Submit AI',  icon: Box,     to: '/upload' },
  { label: 'Explore',    icon: Search,  to: '/explore' },
  { label: '3D Explorer',icon: Compass, to: '/map/bldg-piet-academic' },
];

export default function Header() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const isMap = location.pathname.startsWith('/map');
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

  const activeRoute = isHome ? '/' : isMap ? '/map' : '/';

  return (
    <>
      {/* SVG Gooey filter — hidden, rendered for CSS filter */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden>
        <defs>
          <filter id="gooey">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9"
              result="gooey"
            />
            <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
          </filter>
        </defs>
      </svg>

      <motion.header
        className="app-header"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Brand — Left */}
        <Link to="/" className="header-brand">
          <motion.div
            className="logo-icon-wrapper"
            whileHover={{ scale: 1.08, rotate: 4 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <Box size={18} />
          </motion.div>
          <div className="brand-text">
            <span className="brand-title font-display">3D ULPIN</span>
            <span className="brand-tagline">Cadastral Intelligence</span>
          </div>
          <span className="badge-mvp">MVP</span>
        </Link>

        {/* Center Gooey Nav */}
        <nav
          className="header-nav-gooey"
          onMouseLeave={() => setHoveredNav(null)}
        >
          <div className="gooey-pill-track" style={{ filter: 'url(#gooey)' }}>
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.to === '/' ? isHome : location.pathname.startsWith('/map');
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`gooey-nav-item ${isActive ? 'active' : ''}`}
                  onMouseEnter={() => setHoveredNav(item.to)}
                >
                  {isActive && (
                    <motion.span
                      className="gooey-active-blob"
                      layoutId="gooey-active"
                      transition={{
                        type: 'spring',
                        stiffness: 380,
                        damping: 30,
                      }}
                    />
                  )}
                  <span className="gooey-nav-icon">
                    <Icon size={14} />
                  </span>
                  <span className="gooey-nav-label">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Right — empty spacer to keep brand/nav balanced */}
        <div className="header-actions" />
      </motion.header>
    </>
  );
}
