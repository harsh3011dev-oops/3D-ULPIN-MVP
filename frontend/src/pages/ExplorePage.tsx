import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import Header from '../components/Header/Header';
import { createBuilding } from '../api/api';
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
    id: 'bldg-piet-academic',
    name: 'PIET Main Academic Block',
    city: 'GT Road, Samalkha, Panipat',
    details: '5 Floors • 18.0m Height',
    badge: 'Academic Cadastre',
    icon: '🏛️',
  },
  {
    id: 'bldg-piet-engineering',
    name: 'PIET Engineering & AI Hub',
    city: 'CSE & Robotics Zone, PIET',
    details: '6 Floors • 22.0m Height',
    badge: 'Engineering Labs',
    icon: '🏢',
  },
  {
    id: 'bldg-piet-auditorium',
    name: 'PIET Innovation & Auditorium',
    city: 'Incubation Centre, PIET',
    details: '3 Floors • 15.0m Height',
    badge: 'Convention & AI Hub',
    icon: '⚡',
  },
  {
    id: 'bldg-piet-hostel',
    name: 'PIET Student Residency Block',
    city: 'Hostel Enclave, PIET Campus',
    details: '8 Floors • 28.0m Height',
    badge: 'Residential Cadastre',
    icon: '🏠',
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
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (searchMode === 'address') {
      if (!address.trim()) {
        setError('Please enter a target address or click a demo location below.');
        return;
      }
      const addrLower = address.toLowerCase();
      if (addrLower.includes('academic') || addrLower.includes('main block') || addrLower.includes('piet') || addrLower.includes('panipat')) {
        navigate('/map/bldg-piet-academic');
      } else if (addrLower.includes('engineer') || addrLower.includes('cse') || addrLower.includes('robotics') || addrLower.includes('ai hub')) {
        navigate('/map/bldg-piet-engineering');
      } else if (addrLower.includes('audi') || addrLower.includes('innovation') || addrLower.includes('incubat') || addrLower.includes('convention')) {
        navigate('/map/bldg-piet-auditorium');
      } else if (addrLower.includes('hostel') || addrLower.includes('residenc') || addrLower.includes('student')) {
        navigate('/map/bldg-piet-hostel');
      } else {
        try {
          setLoading(true);
          const cleanId = 'PARCEL_PIET_' + address.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 15);
          const res = await createBuilding({
            parcel_id: cleanId,
            address: address,
            height_meters: 18.0,
            floor_count: 5
          });
          navigate(`/processing/${res.job_id || 'job-001'}`);
        } catch {
          navigate('/map/bldg-piet-academic');
        } finally {
          setLoading(false);
        }
      }
    } else if (searchMode === 'coords') {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      if (isNaN(latNum) || isNaN(lngNum)) {
        setError('Please enter valid numeric latitude and longitude.');
        return;
      }
      // PIET campus coords ~29.238, 76.994
      if (Math.abs(latNum - 29.238) < 0.005 && Math.abs(lngNum - 76.994) < 0.005) {
        navigate('/map/bldg-piet-academic');
      } else if (Math.abs(latNum - 29.239) < 0.005) {
        navigate('/map/bldg-piet-engineering');
      } else {
        try {
          setLoading(true);
          const cleanId = `PARCEL_PIET_GPS_${Math.round(latNum * 1000)}_${Math.round(lngNum * 1000)}`;
          const res = await createBuilding({
            parcel_id: cleanId,
            latitude: latNum,
            longitude: lngNum,
            height_meters: 18.0,
            floor_count: 5
          });
          navigate(`/processing/${res.job_id || 'job-001'}`);
        } catch {
          navigate('/map/bldg-piet-academic');
        } finally {
          setLoading(false);
        }
      }
    } else {
      if (!bldgName.trim()) {
        setError('Please enter a building designation.');
        return;
      }
      const bldgLower = bldgName.toLowerCase();
      if (bldgLower.includes('academic') || bldgLower.includes('piet') || bldgLower.includes('main')) {
        navigate('/map/bldg-piet-academic');
      } else if (bldgLower.includes('engineer') || bldgLower.includes('cse') || bldgLower.includes('robotics')) {
        navigate('/map/bldg-piet-engineering');
      } else if (bldgLower.includes('audi') || bldgLower.includes('innovation') || bldgLower.includes('convention')) {
        navigate('/map/bldg-piet-auditorium');
      } else if (bldgLower.includes('hostel') || bldgLower.includes('residenc')) {
        navigate('/map/bldg-piet-hostel');
      } else {
        try {
          setLoading(true);
          const cleanId = 'PARCEL_PIET_' + bldgName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 15);
          const res = await createBuilding({
            parcel_id: cleanId,
            address: bldgName,
            height_meters: 18.0,
            floor_count: 5
          });
          navigate(`/processing/${res.job_id || 'job-001'}`);
        } catch {
          navigate('/map/bldg-piet-academic');
        } finally {
          setLoading(false);
        }
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
