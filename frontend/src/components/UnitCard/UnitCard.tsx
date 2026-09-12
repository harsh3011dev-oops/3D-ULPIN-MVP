import React, { useState } from 'react';
import {
  Copy, Check, Hash, Building2, Ruler, Compass, Layers,
  UserCheck, ShieldCheck, Download, Box, AreaChart, FileText
} from 'lucide-react';
import { Unit, Building } from '../../types';
import CertificateModal from '../CertificateModal/CertificateModal';
import './UnitCard.css';

interface UnitCardProps {
  unit: Unit | null;
  building?: Building | null;
}

export default function UnitCard({ unit, building }: UnitCardProps) {
  const [copied, setCopied] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);

  if (!unit) {
    return (
      <div className="unit-card empty" id="unit-detail-panel">
        <div className="empty-state-content">
          <div className="empty-icon-wrapper">
            <Building2 size={36} className="text-secondary" />
          </div>
          <h4 className="empty-title">Select Volumetric Unit</h4>
          <p className="empty-subtitle">
            Click on any 3D extruded unit in the map viewer to reveal its ULPIN hash, elevation range, owner, and coordinates.
          </p>
          <div className="ulpin-format-hint">
            <Hash size={12} />
            <code className="text-[0.68rem] text-cyan-400/70">PARCEL_ID-BLDG-F01-UA01-geohash</code>
          </div>
        </div>
      </div>
    );
  }

  const handleCopyULPIN = async () => {
    try {
      await navigator.clipboard.writeText(unit.ulpin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Safe field normalization (handles both mock & backend unit shapes) ──
  const floorNum = unit.floor_number ?? unit.floor ?? 1;
  const floorHtM = unit.floor_height_m ?? 3.5;
  const areaSqm = unit.area_sqm ?? (unit.area_sqft ? unit.area_sqft / 10.764 : null);
  const zMin = unit.z_min ?? (floorNum - 1) * floorHtM;
  const zMax = unit.z_max ?? floorNum * floorHtM;
  const centroid = unit.centroid;
  const volumeM3 = (unit as any).volume_m3 ?? (areaSqm != null ? areaSqm * floorHtM : null);

  return (
    <>
      <div className="unit-card" id="unit-detail-panel">
        {/* Header */}
        <div className="unit-card-header">
          <div>
            <div className="unit-level-badge font-mono">
              LEVEL {floorNum} • UNIT {unit.unit_id}
            </div>
            <h4 className="unit-title">{unit.unit_name || `Apartment ${unit.unit_id}`}</h4>
          </div>

          <button
            type="button"
            className={`btn-copy-ulpin ${copied ? 'copied' : ''}`}
            onClick={handleCopyULPIN}
            title="Copy 3D ULPIN code"
            aria-label="Copy 3D ULPIN code"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span className="copy-label font-mono">{copied ? 'Copied' : 'ULPIN'}</span>
          </button>
        </div>

        {/* 3D ULPIN Bar */}
        <div className="ulpin-badge-container">
          <span className="ulpin-badge-label font-mono">3D ULPIN</span>
          <span className="ulpin-badge-value font-mono">{unit.ulpin}</span>
        </div>

        {/* Volumetric Specs */}
        <div className="unit-specs-grid font-mono">
          <div className="spec-card">
            <div className="spec-icon-row">
              <AreaChart size={16} className="text-secondary" />
              <span className="spec-label">Area</span>
            </div>
            <span className="spec-value">
              {areaSqm != null ? `${Number(areaSqm).toFixed(1)} m²` : '—'}
            </span>
          </div>

          <div className="spec-card">
            <div className="spec-icon-row">
              <Box size={16} className="text-secondary" />
              <span className="spec-label">Volume</span>
            </div>
            <span className="spec-value">
              {volumeM3 != null ? `${Number(volumeM3).toFixed(1)} m³` : '—'}
            </span>
          </div>

          <div className="spec-card">
            <div className="spec-icon-row">
              <Ruler size={16} className="text-secondary" />
              <span className="spec-label">Height</span>
            </div>
            <span className="spec-value">{Number(floorHtM).toFixed(1)}m</span>
          </div>

          <div className="spec-card">
            <div className="spec-icon-row">
              <Building2 size={16} className="text-secondary" />
              <span className="spec-label">Elevation</span>
            </div>
            <span className="spec-value">+{Number(zMin).toFixed(1)}–{Number(zMax).toFixed(1)}m</span>
          </div>
        </div>

        {/* Spatial Details */}
        <div className="details-list">
          <div className="detail-row">
            <span className="detail-key">
              <UserCheck size={14} /> Registered Owner
            </span>
            <span className="detail-val">{unit.owner || 'Private Title Holder'}</span>
          </div>

          <div className="detail-row">
            <span className="detail-key">
              <Compass size={14} /> Centroid (Lat, Lng)
            </span>
            <span className="detail-val font-mono">
              {centroid ? `${Number(centroid[0]).toFixed(5)}, ${Number(centroid[1]).toFixed(5)}` : '—'}
            </span>
          </div>

          <div className="detail-row">
            <span className="detail-key">
              <ShieldCheck size={14} /> Usage Type
            </span>
            <span className="detail-val highlight-green">{unit.use_type || 'Residential'}</span>
          </div>
        </div>

        {/* Action Footer: Opens Full Official Government Title Deed Modal */}
        <button
          type="button"
          className="btn-certificate btn-primary"
          onClick={() => setShowCertModal(true)}
          title="Open Official Digital 3D Land Title Deed & Certificate"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <FileText size={16} />
          <span>Digital 3D Title Deed & Certificate</span>
        </button>
      </div>

      {/* Render Official Certificate Modal */}
      {showCertModal && (
        <CertificateModal
          unit={unit}
          building={building ?? null}
          onClose={() => setShowCertModal(false)}
        />
      )}
    </>
  );
}
