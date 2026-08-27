import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import Header from '../components/Header/Header';
import { Search, MapPin, Building2, Layers, Compass, ArrowRight, CheckCircle } from 'lucide-react';
import './ExplorePage.css';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

const DEMO_LOCATIONS = [
  {
    id: 'bldg-tajmahal-007',
    name: 'Taj Mahal Monument',
    city: 'Agra, Uttar Pradesh',
    details: '6 Floors • 73.0m Height',
    badge: 'Heritage Zone',
    icon: '🕌',
  },
  {
    id: 'bldg-gurugram-108',
    name: 'Cyber City IT Hub Tower 4',
    city: 'Gurugram, Haryana',
    details: '12 Floors • 45.0m Height',
    badge: 'Commercial IT',
    icon: '🏢',
  },
  {
    id: 'bldg-mumbai-502',
    name: 'BKC IFSC Financial Tower',
    city: 'Mumbai, Maharashtra',
    details: '24 Floors • 96.0m Height',
    badge: 'IFSC Financial',
    icon: '🏙️',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Dwarka Sector 14 Complex',
    city: 'New Delhi, Delhi',
    details: '4 Floors • 14.0m Height',
    badge: 'Residential Cadastre',
    icon: '🏛️',
  },
];

export default function ExplorePage() {
  const navigate = useNavigate();
  const [searchMode, setSearchMode] = useState<'address' | 'coords' | 'bldg_floor'>('address');

  // Input states
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [bldgName, setBldgName] = useState('');
  const [floorNum, setFloorNum] = useState('');

  const [error, setError] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (searchMode === 'address') {
      if (!address.trim()) {
        setError('Please enter a target address or click a demo location below.');
        return;
      }
      const addrLower = address.toLowerCase();
      if (addrLower.includes('taj') || addrLower.includes('agra')) {
        navigate('/map/bldg-tajmahal-007');
      } else if (addrLower.includes('dwarka') || addrLower.includes('delhi')) {
        navigate('/map/550e8400-e29b-41d4-a716-446655440000');
      } else if (addrLower.includes('cyber') || addrLower.includes('gurugram')) {
        navigate('/map/bldg-gurugram-108');
      } else if (addrLower.includes('bkc') || addrLower.includes('mumbai')) {
        navigate('/map/bldg-mumbai-502');
      } else {
        navigate('/map/bldg-gurugram-108');
      }
    } else if (searchMode === 'coords') {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      if (isNaN(latNum) || isNaN(lngNum)) {
        setError('Please enter valid numeric latitude and longitude.');
        return;
      }
      if (Math.abs(latNum - 27.175) < 0.1) {
        navigate('/map/bldg-tajmahal-007');
      } else if (Math.abs(latNum - 28.59) < 0.1) {
        navigate('/map/550e8400-e29b-41d4-a716-446655440000');
      } else if (Math.abs(latNum - 19.06) < 0.1) {
        navigate('/map/bldg-mumbai-502');
      } else {
        navigate('/map/bldg-gurugram-108');
      }
    } else {
      if (!bldgName.trim()) {
        setError('Please enter a building designation.');
        return;
      }
      const bldgLower = bldgName.toLowerCase();
      if (bldgLower.includes('taj') || bldgLower.includes('agra')) {
        navigate('/map/bldg-tajmahal-007');
      } else if (bldgLower.includes('dwarka') || bldgLower.includes('delhi')) {
        navigate('/map/550e8400-e29b-41d4-a716-446655440000');
      } else if (bldgLower.includes('bkc') || bldgLower.includes('mumbai')) {
        navigate('/map/bldg-mumbai-502');
      } else {
        navigate('/map/bldg-gurugram-108');
      }
    }
  };

  return (
    <div className="explore-page">
      <Header />

      <main className="explore-container">
        <motion.div
          className="explore-card-wrapper"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div className="explore-header" variants={itemVariants}>
            <div className="explore-icon-box">
              <Compass size={24} />
            </div>
            <h1 className="explore-title font-display">Cadastral Search Studio</h1>
            <p className="explore-subtitle">
              Access featured demo locations or query by address, coordinates, and building designation.
            </p>
          </motion.div>

          {/* Quick Demo Locations Selector */}
          <motion.div className="demo-locations-section" variants={itemVariants}>
            <div className="demo-section-label font-mono">FEATURED DEMO LOCATIONS</div>
            <div className="demo-grid">
              {DEMO_LOCATIONS.map((loc) => (
                <div
                  key={loc.id}
                  className="demo-card"
                  onClick={() => navigate(`/map/${loc.id}`)}
                >
                  <div className="demo-card-top">
                    <span className="demo-icon">{loc.icon}</span>
                    <span className="demo-badge">{loc.badge}</span>
                  </div>
                  <div className="demo-name font-display">{loc.name}</div>
                  <div className="demo-city">{loc.city}</div>
                  <div className="demo-details font-mono">{loc.details}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Mode Switcher */}
          <motion.div className="mode-tabs" variants={itemVariants}>
            <button
              type="button"
              className={`mode-tab-btn ${searchMode === 'address' ? 'active' : ''}`}
              onClick={() => { setSearchMode('address'); setError(''); }}
            >
              <MapPin size={15} />
              <span>Address Lookup</span>
            </button>
            <button
              type="button"
              className={`mode-tab-btn ${searchMode === 'coords' ? 'active' : ''}`}
              onClick={() => { setSearchMode('coords'); setError(''); }}
            >
              <Layers size={15} />
              <span>Coordinates</span>
            </button>
            <button
              type="button"
              className={`mode-tab-btn ${searchMode === 'bldg_floor' ? 'active' : ''}`}
              onClick={() => { setSearchMode('bldg_floor'); setError(''); }}
            >
              <Building2 size={15} />
              <span>Building & Floor</span>
            </button>
          </motion.div>

          {/* Form */}
          <motion.form className="explore-form" onSubmit={handleSearch} variants={itemVariants}>
            {error && (
              <div className="form-error-banner">
                <span>{error}</span>
              </div>
            )}

            <div className="form-inputs-container">
              {searchMode === 'address' && (
                <div className="form-group full-width">
                  <label htmlFor="address-input">
                    <MapPin size={13} />
                    Target Address / Land Parcel Location
                  </label>
                  <input
                    id="address-input"
                    type="text"
                    placeholder="e.g. Bandra Kurla Complex, Mumbai or Taj Mahal, Agra"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              )}

              {searchMode === 'coords' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="lat-input">Latitude (e.g. 27.1750)</label>
                    <input
                      id="lat-input"
                      type="text"
                      placeholder="Latitude (N)"
                      value={lat}
                      onChange={(e) => setLat(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="lng-input">Longitude (e.g. 78.0422)</label>
                    <input
                      id="lng-input"
                      type="text"
                      placeholder="Longitude (E)"
                      value={lng}
                      onChange={(e) => setLng(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {searchMode === 'bldg_floor' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label htmlFor="bldg-name-input">Building Name</label>
                    <input
                      id="bldg-name-input"
                      type="text"
                      placeholder="e.g. Cyber City IT Hub"
                      value={bldgName}
                      onChange={(e) => setBldgName(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="floor-num-input">Floor Level (Optional)</label>
                    <input
                      id="floor-num-input"
                      type="text"
                      placeholder="e.g. G, 4, 12"
                      value={floorNum}
                      onChange={(e) => setFloorNum(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className="submit-explore-button btn-primary">
              <span>Retrieve Spatial Registry</span>
              <ArrowRight size={16} />
            </button>
          </motion.form>
        </motion.div>
      </main>
    </div>
  );
}
