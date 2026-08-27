import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header/Header';
import Map3D from '../components/Map3D/Map3D';
import UnitCard from '../components/UnitCard/UnitCard';
import ValidationAlert from '../components/ValidationAlert/ValidationAlert';
import FloorSelector from '../components/FloorSelector/FloorSelector';
import { getBuilding, getValidation } from '../api/api';
import { Building, SpatialValidation, Unit } from '../types';
import { Building2, MapPin, Loader2, Navigation } from 'lucide-react';
import './MapPage.css';

const LOCATIONS_LIST = [
  { id: '550e8400-e29b-41d4-a716-446655440000', label: 'Dwarka Sector 14 (Delhi)' },
  { id: 'bldg-gurugram-108', label: 'Cyber City (Gurugram)' },
  { id: 'bldg-mumbai-502', label: 'BKC Center (Mumbai)' },
];

export default function MapPage() {
  const { buildingId } = useParams<{ buildingId: string }>();
  const navigate = useNavigate();

  const [building, setBuilding] = useState<Building | null>(null);
  const [validation, setValidation] = useState<SpatialValidation | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setSelectedUnit(null);
      setSelectedFloor(null);
      try {
        const id = buildingId || '550e8400-e29b-41d4-a716-446655440000';
        const [bData, vData] = await Promise.all([
          getBuilding(id),
          getValidation(id)
        ]);
        setBuilding(bData);
        setValidation(vData);
      } catch (err) {
        console.error("Failed loading 3D building dataset:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [buildingId]);

  const handleLocationSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const targetId = e.target.value;
    navigate(`/map/${targetId}`);
  };

  if (loading || !building) {
    return (
      <div className="page-layout">
        <Header />
        <div className="loading-stage">
          <Loader2 size={40} className="icon-spin text-blue-500" />
          <p className="loading-text">Loading deck.gl + MapLibre GL 3D Cadastral Models...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-layout">
      <Header />

      <div className="map-page-body">
        {/* Main 3D Viewport Stage */}
        <section className="viewport-stage">
          <Map3D
            building={building}
            selectedUnit={selectedUnit}
            onUnitClick={(unit) => setSelectedUnit(unit)}
            selectedFloor={selectedFloor}
          />
        </section>

        {/* Right Sidebar Control Panel */}
        <aside className="map-sidebar">
          {/* Location Switcher Dropdown */}
          <div className="location-switcher-card glass-panel p-3 flex items-center justify-between gap-2 border-blue-500/30">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wide">
              <Navigation size={15} />
              <span>Location:</span>
            </div>
            <select
              className="bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-md border border-white/10 outline-none cursor-pointer hover:border-blue-400 transition-all"
              value={buildingId || '550e8400-e29b-41d4-a716-446655440000'}
              onChange={handleLocationSwitch}
            >
              {LOCATIONS_LIST.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.label}
                </option>
              ))}
            </select>
          </div>

          {/* Building Metadata Banner */}
          <div className="building-summary-panel glass-panel">
            <div className="summary-header">
              <div className="summary-icon">
                <Building2 size={20} />
              </div>
              <div className="summary-text">
                <h3 className="building-name">{building?.building_name || 'Cadastral Building'}</h3>
                <p className="building-address">
                  <MapPin size={12} />
                  <span>{building?.address || 'Plot 42, Sector 14, Dwarka, Delhi'}</span>
                </p>
              </div>
            </div>

            <div className="building-stats-strip">
              <div className="stat-badge">
                <span className="stat-lbl">Parcel</span>
                <span className="stat-val font-mono text-[0.72rem]">{building?.parcel_id || 'PARCEL_001'}</span>
              </div>
              <div className="stat-badge">
                <span className="stat-lbl">Floors</span>
                <span className="stat-val">{building?.floor_count || 4} Floors</span>
              </div>
              <div className="stat-badge">
                <span className="stat-lbl">3D Units</span>
                <span className="stat-val">{building?.total_units || building?.units?.length || 14} Units</span>
              </div>
            </div>
          </div>

          {/* Validation Alert Status */}
          <ValidationAlert validation={validation || building?.validation} />

          {/* Floor Level Slice Filter */}
          <FloorSelector
            totalFloors={building?.floor_count || 4}
            selectedFloor={selectedFloor}
            onSelectFloor={(floorNum) => setSelectedFloor(floorNum)}
          />

          {/* Selected Unit Details & ULPIN Card */}
          <UnitCard unit={selectedUnit} />
        </aside>
      </div>
    </div>
  );
}
