import React from 'react';
import { Landmark, Building2, ChevronRight, CheckCircle2, Box, Layers, ShieldCheck } from 'lucide-react';
import { CampusBuilding, CampusMetadata } from '../../types';
import './BuildingSelector.css';

interface BuildingSelectorProps {
  campus: CampusMetadata;
  selectedBuildingId: string | null;
  onSelectBuilding: (building: CampusBuilding | null) => void;
  onOpenCertificate?: (building: CampusBuilding) => void;
}

export default function BuildingSelector({
  campus,
  selectedBuildingId,
  onSelectBuilding,
  onOpenCertificate,
}: BuildingSelectorProps) {
  const selectedBuilding = campus.buildings.find((b) => b.id === selectedBuildingId) || null;

  return (
    <div className="campus-building-selector">
      <div className="campus-selector-header">
        <div className="campus-header-title font-mono">
          <Landmark size={15} className="text-amber-400" />
          <span>MULTI-BUILDING CAMPUS COMPLEX</span>
        </div>
        <span className="campus-badge font-mono">{campus.buildingCount} STRUCTURES</span>
      </div>

      {campus.campusDescription && (
        <p className="campus-summary-text">{campus.campusDescription}</p>
      )}

      {/* Buildings Chip Selector */}
      <div className="campus-buildings-list">
        <button
          type="button"
          className={`campus-bld-card ${selectedBuildingId === null ? 'active-bld' : ''}`}
          onClick={() => onSelectBuilding(null)}
        >
          <div className="bld-card-left">
            <span className="bld-icon">🌐</span>
            <div className="bld-info">
              <span className="bld-name">All Campus / Complex</span>
              <span className="bld-sub font-mono">Full Integrated Site View</span>
            </div>
          </div>
          {selectedBuildingId === null && <CheckCircle2 size={16} className="text-teal-400" />}
        </button>

        {campus.buildings.map((b) => {
          const isSelected = selectedBuildingId === b.id;
          return (
            <button
              key={b.id}
              type="button"
              className={`campus-bld-card ${isSelected ? 'active-bld' : ''}`}
              style={isSelected ? { borderColor: b.color || '#38bdf8' } : {}}
              onClick={() => onSelectBuilding(b)}
            >
              <div className="bld-card-left">
                <span className="bld-icon">{b.icon || '🏢'}</span>
                <div className="bld-info">
                  <span className="bld-name">{b.name}</span>
                  <div className="bld-meta-tags font-mono">
                    <span className="tag-type">{b.buildingType || 'Building'}</span>
                    <span className="tag-spec">{b.heightM}m · {b.floors}FL{b.subterraneanFloors ? ` (${b.subterraneanFloors}B)` : ''}</span>
                  </div>
                </div>
              </div>
              {isSelected ? (
                <CheckCircle2 size={16} style={{ color: b.color || '#38bdf8' }} />
              ) : (
                <ChevronRight size={14} className="text-slate-500" />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Sub-Building Detail Inspector */}
      {selectedBuilding && (
        <div className="selected-building-telemetry font-mono">
          <div className="telemetry-banner" style={{ borderLeftColor: selectedBuilding.color || '#38bdf8' }}>
            <div className="telemetry-row">
              <span className="t-label">STRUCTURE</span>
              <span className="t-val">{selectedBuilding.name}</span>
            </div>
            <div className="telemetry-grid">
              <div className="t-cell">
                <span className="tc-label">Visual Height</span>
                <span className="tc-val">{selectedBuilding.heightM}m</span>
              </div>
              <div className="t-cell">
                <span className="tc-label">Levels</span>
                <span className="tc-val">{selectedBuilding.floors} Above{selectedBuilding.subterraneanFloors ? ` + ${selectedBuilding.subterraneanFloors} Sub` : ''}</span>
              </div>
              <div className="t-cell">
                <span className="tc-label">Floor Height</span>
                <span className="tc-val">{selectedBuilding.floorHeightM || 3.8}m</span>
              </div>
              <div className="t-cell">
                <span className="tc-label">Sub-ULPIN</span>
                <span className="tc-val text-cyan-300">BLDG-{selectedBuilding.shortLabel.toUpperCase().replace(/\s+/g, '')}</span>
              </div>
            </div>
            {selectedBuilding.description && (
              <p className="t-desc">{selectedBuilding.description}</p>
            )}

            {onOpenCertificate && (
              <button
                type="button"
                className="btn-inspect-building-cert"
                onClick={() => onOpenCertificate(selectedBuilding)}
              >
                <ShieldCheck size={14} />
                <span>Open Volumetric 3D ULPIN Title Deed</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
