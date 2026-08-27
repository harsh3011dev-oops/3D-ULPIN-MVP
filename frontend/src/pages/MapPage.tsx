import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../components/Header/Header';
import Map3D from '../components/Map3D/Map3D';
import FloorSelector from '../components/FloorSelector/FloorSelector';
import UnitCard from '../components/UnitCard/UnitCard';
import ValidationAlert from '../components/ValidationAlert/ValidationAlert';
import { getBuilding } from '../api/api';
import { PRESETS } from '../mocks/mockBuilding';
import { Building, Unit } from '../types';
import {
  Building2,
  MapPin,
  Layers,
  BarChart3,
  Search,
  FileCheck,
  ShieldCheck,
  Activity
} from 'lucide-react';
import './MapPage.css';

export default function MapPage() {
  const { buildingId } = useParams<{ buildingId: string }>();

  const [building, setBuilding] = useState<Building | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [activePresetKey, setActivePresetKey] = useState<string>('cyber-city');
  const [activeTab, setActiveTab] = useState<'layer' | 'analytics' | 'registry' | 'audit'>('layer');

  useEffect(() => {
    async function loadData() {
      const idToFetch = buildingId || 'bldg-gurugram-108';
      const data = await getBuilding(idToFetch);
      if (data) {
        setBuilding(data);
        if (data.units && data.units.length > 0) {
          setSelectedUnit(data.units[0]);
        }
      }
    }
    loadData();
  }, [buildingId]);

  const handleLocationSwitch = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value;
    setActivePresetKey(key);
    const presetObj = PRESETS[key];
    if (presetObj) {
      const data = await getBuilding(presetObj.building.building_id);
      if (data) {
        setBuilding(data);
        if (data.units && data.units.length > 0) {
          setSelectedUnit(data.units[0]);
        }
      }
    }
  };

  const firstCoord = building?.footprint?.coordinates?.[0]?.[0];
  const currentLat = firstCoord ? firstCoord[1].toFixed(4) : '28.4942';
  const currentLng = firstCoord ? firstCoord[0].toFixed(4) : '77.0886';
  const currentAlt = building?.height ? `${building.height}M AMSL` : '45.0M AMSL';

  return (
    <div className="page-layout">
      <Header />

      <div className="map-page-wrapper">

        {/* ── Left Toolkit Sidebar (From Zip 1 Design) ── */}
        <aside className="geospatial-toolkit-sidebar">
          <div className="sidebar-section-label font-mono">GEOSPATIAL TOOLKIT</div>
          
          <nav className="toolkit-nav">
            <button
              className={`toolkit-nav-btn ${activeTab === 'layer' ? 'active' : ''}`}
              onClick={() => setActiveTab('layer')}
            >
              <Layers size={16} />
              <span>Layer Stack</span>
            </button>

            <button
              className={`toolkit-nav-btn ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => setActiveTab('analytics')}
            >
              <BarChart3 size={16} />
              <span>Analytics</span>
            </button>

            <button
              className={`toolkit-nav-btn ${activeTab === 'registry' ? 'active' : ''}`}
              onClick={() => setActiveTab('registry')}
            >
              <Search size={16} />
              <span>Parcel Registry</span>
            </button>

            <button
              className={`toolkit-nav-btn ${activeTab === 'audit' ? 'active' : ''}`}
              onClick={() => setActiveTab('audit')}
            >
              <FileCheck size={16} />
              <span>Permit Audit</span>
            </button>
          </nav>

          {/* Coordinate Badge */}
          <div className="sidebar-coords-box font-mono">
            <div>LAT: {currentLat} N</div>
            <div>LON: {currentLng} E</div>
            <div>ALT: {currentAlt}</div>
          </div>
        </aside>

        {/* ── Center 3D Viewport Stage ── */}
        <div className="map-stage-container">
          <Map3D
            building={building}
            selectedFloor={selectedFloor}
            selectedUnit={selectedUnit}
            onUnitClick={(unit) => setSelectedUnit(unit)}
          />
        </div>

        {/* ── Right Data & Analysis Sidebar ── */}
        <aside className="map-sidebar">

          {/* Location Switcher */}
          <div className="location-switcher-card glass-panel">
            <label className="switcher-lbl font-mono">LOCATION TARGET</label>
            <select
              className="location-switcher-select"
              value={activePresetKey}
              onChange={handleLocationSwitch}
            >
              <option value="cyber-city">🏢 Gurugram Cyber City (12F / 45m)</option>
              <option value="bkc-mumbai">🏙️ BKC Mumbai IFSC Tower (24F / 96m)</option>
              <option value="delhi-dwarka">🏛️ Delhi Dwarka Complex (4F / 14m)</option>
              <option value="taj-mahal">🕌 Taj Mahal Agra (6F / 73m)</option>
            </select>
          </div>

          {/* Building Overview Summary */}
          {building && (
            <div className="building-summary-panel glass-panel">
              <div className="summary-header">
                <div className="summary-icon">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="building-name">{building.building_name || 'Cadastral Building'}</h3>
                  <p className="building-address">
                    <MapPin size={12} />
                    {building.address || 'Parcel Coordinates Loaded'}
                  </p>
                </div>
              </div>

              <div className="building-stats-strip">
                <div className="stat-badge">
                  <span className="stat-lbl">Height</span>
                  <span className="stat-val">{building.height}m</span>
                </div>
                <div className="stat-badge">
                  <span className="stat-lbl">Floors</span>
                  <span className="stat-val">{building.floor_count}F</span>
                </div>
                <div className="stat-badge">
                  <span className="stat-lbl">Units</span>
                  <span className="stat-val">{building.units?.length || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Spatial Validation Alert */}
          {building?.validation && (
            <ValidationAlert validation={building.validation} />
          )}

          {/* Floor Isolator */}
          {building && (
            <FloorSelector
              totalFloors={building.floor_count}
              selectedFloor={selectedFloor}
              onSelectFloor={(floor) => setSelectedFloor(floor)}
            />
          )}

          {/* Selected Unit Specs & Copy ULPIN Panel */}
          {selectedUnit && (
            <UnitCard unit={selectedUnit} />
          )}

          {/* Structural Integrity Score Panel (Zip 1 Design) */}
          <div className="structural-score-card glass-panel">
            <div className="score-text-group">
              <span className="score-lbl font-mono">STRUCTURAL INTEGRITY SCORE</span>
              <span className="score-val">
                98.4<span className="score-pct">%</span>
              </span>
            </div>
            {/* SVG Donut Chart */}
            <svg className="score-donut" width="44" height="44" viewBox="0 0 40 40">
              <circle className="donut-bg" cx="20" cy="20" r="16" strokeWidth="4" fill="none" />
              <circle
                className="donut-fill"
                cx="20"
                cy="20"
                r="16"
                strokeWidth="4"
                fill="none"
                strokeDasharray="100.53"
                strokeDashoffset="1.6"
                strokeLinecap="round"
              />
            </svg>
          </div>

        </aside>

      </div>
    </div>
  );
}
