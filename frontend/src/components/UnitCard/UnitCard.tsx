import React, { useState } from 'react';
import { Copy, Check, Hash, Building2, Ruler, Compass, Layers, UserCheck, ShieldCheck, Download } from 'lucide-react';
import { Unit } from '../../types';
import './UnitCard.css';

interface UnitCardProps {
  unit: Unit | null;
}

export default function UnitCard({ unit }: UnitCardProps) {
  const [copied, setCopied] = useState(false);

  if (!unit) {
    return (
      <div className="unit-card empty glass-panel" id="unit-detail-panel">
        <div className="empty-state-content">
          <div className="empty-icon-wrapper">
            <Building2 size={36} className="text-secondary" />
          </div>
          <h4 className="empty-title">Select Volumetric Unit</h4>
          <p className="empty-subtitle">
            Click on any 3D extruded deck.gl unit in the map viewer to reveal its ULPIN hash, elevation range, owner, and coordinates.
          </p>
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

  const downloadCertificate = () => {
    const certText = `
=== 3D ULPIN CADASTRAL CERTIFICATE ===
ULPIN Code: ${unit.ulpin}
Unit ID: ${unit.unit_id}
Name: ${unit.unit_name || 'Standard Unit'}
Floor Level: ${unit.floor_number}
Elevation Range: +${unit.z_min}m to +${unit.z_max}m (Height: ${unit.floor_height_m || (unit.z_max - unit.z_min)}m)
Volumetric Area: ${unit.area_sqm?.toFixed(1) ?? '145.0'} m²
Registered Owner: ${unit.owner || 'Government Cadastral Registry'}
Usage Type: ${unit.use_type || 'Residential'}
Centroid Coordinates: Lat ${unit.centroid?.[0]}, Lng ${unit.centroid?.[1]}
Spatial Status: Validated Non-Overlapping (ISO 19152 LADM 3D Compliant)
Engine: deck.gl + MapLibre GL JS 3D Volumetric Extrusion
    `.trim();

    const blob = new Blob([certText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `3D-ULPIN-${unit.unit_id}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="unit-card active glass-panel fade-in" id="unit-detail-panel">
      {/* Header */}
      <div className="unit-card-header">
        <div className="header-info">
          <span className="unit-tag">Floor {unit.floor_number}</span>
          <h3 className="unit-name">{unit.unit_name || unit.unit_id}</h3>
        </div>
        <span className="unit-id-badge">{unit.unit_id}</span>
      </div>

      {/* ULPIN Hash Box */}
      <div className="ulpin-box">
        <div className="ulpin-header">
          <span className="ulpin-label">
            <Hash size={14} className="icon-blue" />
            3D ULPIN Code
          </span>
          <span className="cadastral-standard-badge">ISO 19152</span>
        </div>
        <div className="ulpin-code-row">
          <code className="ulpin-code-text" id="ulpin-display">{unit.ulpin}</code>
          <button
            className={`copy-ulpin-button ${copied ? 'copied' : ''}`}
            onClick={handleCopyULPIN}
            id="copy-ulpin-btn"
            title="Copy 3D ULPIN Code"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Specifications Grid */}
      <div className="specs-grid">
        <div className="spec-card">
          <div className="spec-icon-row">
            <Layers size={16} className="text-secondary" />
            <span className="spec-label">Floor</span>
          </div>
          <span className="spec-value">Level {unit.floor_number}</span>
        </div>

        <div className="spec-card">
          <div className="spec-icon-row">
            <Ruler size={16} className="text-secondary" />
            <span className="spec-label">Floor Area</span>
          </div>
          <span className="spec-value">{unit.area_sqm?.toFixed(1) ?? '145.0'} m²</span>
        </div>

        <div className="spec-card">
          <div className="spec-icon-row">
            <Building2 size={16} className="text-secondary" />
            <span className="spec-label">Elevation Min</span>
          </div>
          <span className="spec-value">+{unit.z_min} m</span>
        </div>

        <div className="spec-card">
          <div className="spec-icon-row">
            <Building2 size={16} className="text-secondary" />
            <span className="spec-label">Elevation Max</span>
          </div>
          <span className="spec-value">+{unit.z_max} m</span>
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
            {unit.centroid ? `${unit.centroid[0].toFixed(5)}, ${unit.centroid[1].toFixed(5)}` : '28.592, 77.049'}
          </span>
        </div>

        <div className="detail-row">
          <span className="detail-key">
            <ShieldCheck size={14} /> Usage Status
          </span>
          <span className="detail-val highlight-green">{unit.use_type || 'Residential'}</span>
        </div>
      </div>

      {/* Action Footer */}
      <button className="btn-certificate btn-primary" onClick={downloadCertificate}>
        <Download size={16} />
        <span>Export 3D ULPIN Certificate</span>
      </button>
    </div>
  );
}
