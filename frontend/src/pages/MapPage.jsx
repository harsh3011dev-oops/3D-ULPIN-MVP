import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Header from '../components/Header/Header';
import Map3D from '../components/Map3D/Map3D';
import UnitCard from '../components/UnitCard/UnitCard';
import ValidationAlert from '../components/ValidationAlert/ValidationAlert';
import FloorSelector from '../components/FloorSelector/FloorSelector';
import { getBuilding, getValidation } from '../api/api';
import { Building2, Layers, MapPin, Loader2 } from 'lucide-react';
import './MapPage.css';

export default function MapPage() {
  const { buildingId } = useParams();
  const [building, setBuilding] = useState(null);
  const [validation, setValidation] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [bData, vData] = await Promise.all([
          getBuilding(buildingId),
          getValidation(buildingId)
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

  if (loading) {
    return (
      <div className="page-layout">
        <Header />
        <div className="loading-stage">
          <Loader2 size={40} className="icon-spin text-blue" />
          <p className="loading-text">Loading 3D Volumetric Cadastral Models...</p>
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
                <span className="stat-val font-mono">{building?.parcel_id || 'PARCEL_001'}</span>
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
