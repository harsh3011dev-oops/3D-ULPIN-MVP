import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header/Header';
import Map3D from '../components/Map3D/Map3D';
import FloorSelector from '../components/FloorSelector/FloorSelector';
import UnitCard from '../components/UnitCard/UnitCard';
import ValidationAlert from '../components/ValidationAlert/ValidationAlert';
import UndergroundPanel from '../components/UndergroundPanel/UndergroundPanel';
import CertificateModal from '../components/CertificateModal/CertificateModal';
import { getBuilding } from '../api/api';
import { Building, Unit } from '../types';
import { getBuildingCenter } from '../utils/footprintUtils';
import {
  Building2, MapPin, Layers,
  ShieldCheck, Activity, Loader2, AlertTriangle
} from 'lucide-react';
import './MapPage.css';

export default function MapPage() {
  const { buildingId: building_id } = useParams<{ buildingId: string }>();

  const [building, setBuilding]           = useState<Building | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [selectedUnit, setSelectedUnit]   = useState<Unit | null>(null);
  const [isLoading, setIsLoading]         = useState(true);
  const [loadError, setLoadError]         = useState<string | null>(null);
  const [showGlobalCert, setShowGlobalCert] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    async function loadData() {
      if (!building_id) {
        setIsLoading(false);
        setLoadError('No building ID provided.');
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      try {
        const data = await getBuilding(building_id);
        if (data) {
          setBuilding(data);
          if (data.units?.length > 0) setSelectedUnit(data.units[0]);
        } else {
          setLoadError(`Building "${building_id}" not found.`);
        }
      } catch (err: any) {
        const msg = err?.response?.data?.detail || err?.message || 'Failed to load building data.';
        setLoadError(msg);
        console.error('MapPage loadData error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [building_id]);

  const [isRightOpen, setIsRightOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth > 900);

  // Auto handle window resize for desktop site toggle on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 900) {
        setIsRightOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="map-page">
      <Header />

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          flex: 1, gap: 16, height: 'calc(100vh - 60px)', color: 'var(--text-secondary)' }}>
          <Loader2 size={40} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-teal)' }} />
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>Loading 3D Spatial Building…</p>
        </div>
      )}

      {!isLoading && loadError && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          flex: 1, gap: 16, height: 'calc(100vh - 60px)' }}>
          <AlertTriangle size={40} style={{ color: 'var(--accent-red)' }} />
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{loadError}</p>
          <button className="btn-primary" style={{ padding: '10px 24px' }}
            onClick={() => navigate('/explore')}>Try New Building</button>
        </div>
      )}

      {!isLoading && !loadError && (
      <div className={`map-content-area ${!isRightOpen ? 'right-closed' : ''}`}>

        {/* ── Mobile/Desktop Backdrop Overlay when drawer is open ── */}
        {isRightOpen && (
          <div
            className="sidebar-backdrop-overlay"
            onClick={() => setIsRightOpen(false)}
          />
        )}

        {/* ── 3D Viewport (Full Width) ── */}
        <div className="map-viewport">
          <Map3D
            building={building}
            selectedFloor={selectedFloor}
            selectedUnit={selectedUnit}
            onUnitClick={(unit) => {
              setSelectedUnit(unit);
              const fn = unit.floor_number ?? unit.floor;
              if (fn != null) {
                setSelectedFloor(fn);
              }
            }}
            isRightOpen={isRightOpen}
            onToggleRight={() => setIsRightOpen(!isRightOpen)}
          />
        </div>

        {/* ── Right Sidebar ── */}
        <aside className={`map-right-sidebar ${isRightOpen ? 'is-open' : ''}`}>
          {/* Header Action */}
          <div className="location-target-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.8px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              3D Cadastral Record
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => navigate('/explore')}
                style={{
                  background: 'rgba(13, 148, 136, 0.18)',
                  border: '1px solid rgba(13, 148, 136, 0.4)',
                  borderRadius: 'var(--radius-xs)',
                  color: '#2DD4BF',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                + New Model
              </button>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setIsRightOpen(false)}
                aria-label="Close Record"
              >✕</button>
            </div>
          </div>

          {/* Building Meta */}
          {building && (
            <div className="building-meta">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 4, flexShrink: 0,
                  background: 'var(--accent-teal-soft)', color: 'var(--accent-teal)',
                  border: '1px solid rgba(13, 148, 136, 0.25)',
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
                  <Activity size={10} /> {building.height || 10.5}m
                </span>
                <span className="bstat-chip">
                  <Layers size={10} /> 4 Strata (1B + {building.floor_count || 3}F)
                </span>
                <span className="bstat-chip">
                  <ShieldCheck size={10} /> {building.units?.length || 4} units
                </span>
              </div>
            </div>
          )}

          {/* Cadastral Stratum: Basement Library Record */}
          {building && (
            <div style={{ padding: '0 14px 10px' }}>
              <div style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.28)',
                boxShadow: 'var(--shadow-xs)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#818cf8', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                    <Layers size={13} />
                    <span>Basement Cadastral Stratum</span>
                  </div>
                  <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(99, 102, 241, 0.2)', color: '#c7d2fe', fontWeight: 700 }}>
                    B1 Active
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.74rem', marginBottom: 6 }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Basement Levels: </span>
                    <strong style={{ color: 'var(--text-primary)' }}>{building.basement_count ?? building.assessment?.basement_levels ?? 1}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Basement Use: </span>
                    <strong style={{ color: '#38bdf8' }}>{building.basement_use || building.assessment?.basement_use || 'Library'}</strong>
                  </div>
                </div>
                <div style={{ fontSize: '0.70rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(99, 102, 241, 0.15)', paddingTop: 6 }}>
                  <span>Basement Source: </span>
                  <span style={{ color: '#a5b4fc', fontWeight: 600 }}>
                    {building.basement_source || building.assessment?.basement_source || 'User-provided / Verified project input'}
                  </span>
                </div>
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
              <FloorSelector
                totalFloors={building.floor_count || 3}
                basementFloors={building.basement_count ?? building.assessment?.basement_levels ?? 1}
                selectedFloor={selectedFloor}
                onSelectFloor={(floor) => {
                  setSelectedFloor(floor);
                  if (floor === null) {
                    if (building.units?.length > 0) setSelectedUnit(building.units[0]);
                  } else {
                    const matchedUnit = building.units?.find(
                      (u) => (u.floor_number ?? u.floor) === floor
                    );
                    if (matchedUnit) {
                      setSelectedUnit(matchedUnit);
                    } else if (floor < 0) {
                      // Mock/Fallback B1 unit if not in array
                      setSelectedUnit({
                        unit_id: `${building.building_id || 'admin'}-B1-LIB`,
                        ulpin: `${building.building_id || 'ULPIN'}-B1-LIB-001`,
                        floor: -1,
                        unit_name: 'Basement Library',
                        unit_number: 'B1-LIB',
                        use_type: building.basement_use || 'Library',
                        area_sqm: 850,
                        status: 'Verified',
                        owner: 'Institutional Cadastre'
                      });
                    }
                  }
                }}
              />
            </div>
          )}

          {/* Underground Infrastructure Panel (Utilities only: Water, Telecom, Power, Gas, Ducts) */}
          {building && (
            <div style={{ padding: '0 10px 10px' }}>
              <UndergroundPanel
                data={building.underground || {
                  basement_levels: 0,
                  parking_spaces: 0,
                  total_volume_m3: 3200,
                  max_depth_m: 6.5,
                  utilities_mapped: 4,
                  underground_ulpins: 4,
                  validation_score: 99.2,
                  validation_issues: [],
                  ulpin_details: [],
                  utilities: [
                    { ulpin: 'UTIL-WTR-01', type: 'water', title: 'Municipal Water Main (300mm)', depth_m: 4.2, diameter_mm: 300, capacity: 1000, conflicts: 0 },
                    { ulpin: 'UTIL-TEL-02', type: 'telecom', title: 'High-Speed Fiber Cable Duct', depth_m: 2.8, diameter_mm: 150, capacity: 500, conflicts: 0 },
                    { ulpin: 'UTIL-PWR-03', type: 'power', title: 'Underground 11kV Power Grid', depth_m: 5.5, diameter_mm: 200, capacity: 11000, conflicts: 0 },
                    { ulpin: 'UTIL-GAS-04', type: 'gas', title: 'City PNG Gas Pipeline Network', depth_m: 3.1, diameter_mm: 250, capacity: 800, conflicts: 0 }
                  ]
                }}
                buildingName={building.building_name || building.address}
              />
            </div>
          )}

          {/* Unit Cards & Structural Integrity */}
          <div className="unit-list-area">
            {selectedUnit && <UnitCard unit={selectedUnit} building={building} />}

            {/* Structural Score */}
            <div style={{
              padding: '14px 16px', borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-card)', border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-xs)', display: 'flex',
              alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem',
                  color: 'var(--text-muted)', textTransform: 'uppercase',
                  letterSpacing: '0.8px', marginBottom: 4 }}>
                  Structural Integrity
                </div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '1.5rem',
                  fontWeight: 800, color: 'var(--text-primary)' }}>
                  {(building?.validation?.confidence_score ?? 0).toFixed(1)}<span style={{ fontSize: '0.85rem', fontWeight: 400,
                    color: 'var(--text-muted)' }}>%</span>
                </div>
              </div>
              <svg width="44" height="44" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="16" strokeWidth="4" fill="none"
                  stroke="var(--bg-secondary)" />
                <circle cx="20" cy="20" r="16" strokeWidth="4" fill="none"
                  stroke="var(--accent-teal)" strokeDasharray="100.53"
                  strokeDashoffset={100.53 - ((building?.validation?.confidence_score ?? 0) / 100) * 100.53} strokeLinecap="round"
                  style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
              </svg>
            </div>
          </div>
        </aside>

      </div>
      )}

      {/* Global 3D Title Deed Certificate Modal (from Demo Tour or Toolbar) */}
      {showGlobalCert && (
        <CertificateModal
          unit={selectedUnit || (building?.units?.[0] ?? {
            unit_id: 'UA-001',
            floor: selectedFloor || 1,
            floor_number: selectedFloor || 1,
            ulpin: `ULPIN-DEL-${building?.building_id || '789012'}-F${String(selectedFloor || 1).padStart(2, '0')}-U101`,
            owner: 'Ministry of Housing & Urban Affairs (Govt of India)',
            status: 'Registered',
            use_type: 'Residential Volumetric Unit',
            area_sqm: 125.4,
            floor_height_m: 3.5,
            z_min: ((selectedFloor || 1) - 1) * 3.5,
            z_max: (selectedFloor || 1) * 3.5,
            centroid: [building?.latitude || 28.6139, building?.longitude || 77.2090]
          })}
          building={building}
          onClose={() => setShowGlobalCert(false)}
        />
      )}
    </div>
  );
}
