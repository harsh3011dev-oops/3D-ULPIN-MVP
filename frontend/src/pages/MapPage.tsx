import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../components/Header/Header';
import Map3D from '../components/Map3D/Map3D';
import FloorSelector from '../components/FloorSelector/FloorSelector';
import UnitCard from '../components/UnitCard/UnitCard';
import ValidationAlert from '../components/ValidationAlert/ValidationAlert';
import { getBuilding } from '../api/api';
import { PRESETS } from '../mocks/mockBuilding';
import { Building, Unit } from '../types';
import {
  Building2, MapPin, Layers, BarChart3, Search,
  FileCheck, ShieldCheck, Activity
} from 'lucide-react';
import './MapPage.css';

const SIDEBAR_NAV = [
  { id: 'layer',     label: 'Layer Stack',     icon: Layers },
  { id: 'analytics', label: 'Analytics',       icon: BarChart3 },
  { id: 'registry',  label: 'Parcel Registry', icon: Search },
  { id: 'audit',     label: 'Permit Audit',    icon: FileCheck },
];

export default function MapPage() {
  const { buildingId } = useParams<{ buildingId: string }>();

  const [building, setBuilding]           = useState<Building | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [selectedUnit, setSelectedUnit]   = useState<Unit | null>(null);
  const [activePresetKey, setActivePresetKey] = useState<string>('piet-academic');
  const [activeTab, setActiveTab]         = useState('layer');

  const navigate = useNavigate();

  useEffect(() => {
    async function loadData() {
      const idToFetch = buildingId || 'bldg-piet-academic';
      const data = await getBuilding(idToFetch);
      if (data) {
        setBuilding(data);
        if (data.units?.length > 0) setSelectedUnit(data.units[0]);

        if (idToFetch.includes('engineering') || idToFetch.includes('engg')) setActivePresetKey('piet-engineering');
        else if (idToFetch.includes('auditorium') || idToFetch.includes('audi')) setActivePresetKey('piet-auditorium');
        else if (idToFetch.includes('hostel')) setActivePresetKey('piet-hostel');
        else setActivePresetKey('piet-academic');
      }
    }
    loadData();
  }, [buildingId]);

  const handleLocationSwitch = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    setActivePresetKey(key);
    setSelectedFloor(null);
    const presetObj = PRESETS[key];
    if (presetObj) {
      navigate(`/map/${presetObj.building.building_id}`);
    }
  };

  // Dynamic coordinate calculation from building footprint or unit centroids
  const getCoordinates = () => {
    if (!building) return { lat: '29.2382', lng: '76.9938' };
    const fp = building.footprint?.coordinates?.[0];
    if (fp && fp.length > 0) {
      const avgLng = fp.reduce((sum: number, p: number[]) => sum + (p[0] || 0), 0) / fp.length;
      const avgLat = fp.reduce((sum: number, p: number[]) => sum + (p[1] || 0), 0) / fp.length;
      return { lat: avgLat.toFixed(4), lng: avgLng.toFixed(4) };
    }
    const u = building.units?.[0];
    if (u?.centroid) {
      return { lat: Number(u.centroid[0]).toFixed(4), lng: Number(u.centroid[1]).toFixed(4) };
    }
    return { lat: '29.2382', lng: '76.9938' };
  };

  const { lat: currentLat, lng: currentLng } = getCoordinates();

  return (
    <div className="map-page">
      <Header />

      <div className="map-content-area">

        {/* ── Left Sidebar ── */}
        <motion.aside
          className="map-left-sidebar"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <div className="sidebar-section-label">Spatial Toolkit</div>

          {SIDEBAR_NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`sidebar-nav-item ${activeTab === id ? 'active' : ''}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}

          {/* Dynamic Coord badge */}
          <div style={{
            marginTop: 'auto', padding: '12px 10px',
            borderTop: '1px solid var(--border-subtle)',
            fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
            color: 'var(--text-muted)', lineHeight: 1.8
          }}>
            <div style={{ color: 'var(--accent-lavender)', fontWeight: 700, marginBottom: 4 }}>COORDINATES</div>
            <div>LAT: {currentLat}° N</div>
            <div>LON: {currentLng}° E</div>
          </div>
        </motion.aside>

        {/* ── 3D Viewport ── */}
        <div className="map-viewport">
          <Map3D
            building={building}
            selectedFloor={selectedFloor}
            selectedUnit={selectedUnit}
            onUnitClick={(unit) => {
              setSelectedUnit(unit);
              if (unit.floor_number != null) {
                setSelectedFloor(unit.floor_number);
              }
            }}
          />
        </div>

        {/* ── Right Sidebar ── */}
        <motion.aside
          className="map-right-sidebar"
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}
        >
          {/* Header Action */}
          <div className="location-target-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 6px' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              3D Cadastral Record
            </div>
            <button
              type="button"
              onClick={() => navigate('/explore')}
              style={{
                background: 'var(--accent-lavender-soft)',
                border: '1px solid rgba(124,111,224,0.25)',
                borderRadius: 'var(--radius-full)',
                color: '#7c6fe0',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '4px 10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              + New Model
            </button>
          </div>

          {/* Building Meta */}
          {building && (
            <div className="building-meta">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: 'var(--accent-lavender-soft)', color: 'var(--accent-lavender)',
                  border: '1.5px solid rgba(124,111,224,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Building2 size={16} />
                </div>
                <h3 className="building-name font-display">
                  {building.building_name || 'Cadastral Building'}
                </h3>
              </div>
              <p className="building-address" style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                <MapPin size={11} style={{ flexShrink: 0, marginTop: 2 }} />
                {building.address || 'Parcel Coordinates Loaded'}
              </p>
              <div className="building-stats-row">
                <span className="bstat-chip">
                  <Activity size={10} /> {building.height}m
                </span>
                <span className="bstat-chip">
                  <Layers size={10} /> {building.floor_count}F
                </span>
                <span className="bstat-chip">
                  <ShieldCheck size={10} /> {building.units?.length || 0} units
                </span>
              </div>
            </div>
          )}

          {/* Validation */}
          {building?.validation && (
            <div style={{ padding: '0 14px 10px' }}>
              <ValidationAlert validation={building.validation} />
            </div>
          )}

          {/* Floor Isolator */}
          {building && (
            <div className="floor-isolator-section">
              <div className="section-title">Floor Isolator</div>
              <FloorSelector
                totalFloors={building.floor_count}
                selectedFloor={selectedFloor}
                onSelectFloor={(floor) => setSelectedFloor(floor)}
              />
            </div>
          )}

          {/* Unit Cards */}
          <div className="unit-list-area">
            {selectedUnit && <UnitCard unit={selectedUnit} />}

            {/* Structural Score */}
            <div style={{
              marginTop: 8, padding: '14px 16px', borderRadius: 'var(--radius-md)',
              background: '#ffffff', border: '1.5px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem',
                  color: 'var(--text-muted)', textTransform: 'uppercase',
                  letterSpacing: '0.8px', marginBottom: 4 }}>
                  Structural Integrity
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem',
                  fontWeight: 800, color: 'var(--primary)' }}>
                  98.4<span style={{ fontSize: '0.85rem', fontWeight: 400,
                    color: 'var(--text-muted)' }}>%</span>
                </div>
              </div>
              <svg width="44" height="44" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="16" strokeWidth="4" fill="none"
                  stroke="var(--surface-container)" />
                <circle cx="20" cy="20" r="16" strokeWidth="4" fill="none"
                  stroke="var(--accent-sage)" strokeDasharray="100.53"
                  strokeDashoffset="1.6" strokeLinecap="round"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
              </svg>
            </div>
          </div>
        </motion.aside>

      </div>
    </div>
  );
}
