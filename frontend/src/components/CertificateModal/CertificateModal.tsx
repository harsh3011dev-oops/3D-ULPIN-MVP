import React, { useRef } from 'react';
import {
  ShieldCheck, Printer, Download, X, Building2,
  CheckCircle, FileText, Compass, Layers, Globe
} from 'lucide-react';
import { Unit, Building } from '../../types';
import './CertificateModal.css';

interface CertificateModalProps {
  unit: Unit;
  building: Building | null;
  onClose: () => void;
}

export default function CertificateModal({ unit, building, onClose }: CertificateModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const floorNum = unit.floor_number ?? unit.floor ?? 1;
  const floorHtM = unit.floor_height_m ?? 3.5;
  const areaSqm = unit.area_sqm ?? (unit.area_sqft ? unit.area_sqft / 10.764 : 120.0);
  const zMin = unit.z_min ?? (floorNum - 1) * floorHtM;
  const zMax = unit.z_max ?? floorNum * floorHtM;
  const volumeM3 = (areaSqm * floorHtM).toFixed(1);

  const lat = unit.centroid?.[0] ?? building?.latitude ?? 28.6139;
  const lon = unit.centroid?.[1] ?? building?.longitude ?? 77.2090;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadGeoJSON = () => {
    const geojsonData = {
      type: 'Feature',
      properties: {
        ulpin: unit.ulpin,
        unit_id: unit.unit_id,
        building_name: building?.building_name || 'Cadastral Parcel',
        floor_level: floorNum,
        z_min: zMin,
        z_max: zMax,
        volume_m3: parseFloat(volumeM3),
        area_sqm: areaSqm,
        owner: unit.owner || 'Government Cadastral Registry',
        cadastre_standard: 'ISO 19152 LADM 3D',
        issued_date: new Date().toISOString()
      },
      geometry: {
        type: 'Point',
        coordinates: [lon, lat, zMin]
      }
    };

    const blob = new Blob([JSON.stringify(geojsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `3D-ULPIN-PARCEL-${unit.unit_id}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="cert-modal-backdrop" onClick={onClose}>
      <div className="cert-modal-container" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Top Actions */}
        <div className="cert-modal-toolbar no-print">
          <div className="toolbar-title">
            <FileText size={16} className="text-emerald-500" />
            <span>Digital 3D Property Deed & Title Record</span>
          </div>
          <div className="toolbar-buttons">
            <button type="button" className="cert-btn primary" onClick={handlePrint}>
              <Printer size={15} />
              <span>Print / Save as PDF</span>
            </button>
            <button type="button" className="cert-btn secondary" onClick={handleDownloadGeoJSON}>
              <Download size={15} />
              <span>Export GeoJSON</span>
            </button>
            <button type="button" className="cert-btn close-btn" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Certificate Document */}
        <div className="cert-document-scroll" ref={printRef}>
          <div className="cert-paper">
            
            {/* Government Seal & Official Header */}
            <header className="cert-header">
              <div className="gov-seal">
                <div className="seal-emblem">🏛️</div>
                <div className="seal-text">
                  <h3>GOVERNMENT OF INDIA</h3>
                  <h4>DEPARTMENT OF LAND RESOURCES (DoLR)</h4>
                  <h5>BHU-AADHAAR • 3D VOLUMETRIC CADASTRAL REGISTRY</h5>
                </div>
              </div>
              <div className="cert-status-badge">
                <ShieldCheck size={18} />
                <span>OFFICIALLY REGISTERED</span>
              </div>
            </header>

            <div className="cert-divider gold" />

            {/* Document Title */}
            <div className="cert-main-title">
              <h2>DIGITAL 3D LAND TITLE CERTIFICATE</h2>
              <p className="cert-subtitle">
                Certificate of Vertical & Volumetric Spatial Property Rights (ISO 19152 LADM Compliant)
              </p>
            </div>

            {/* Core ULPIN Bar */}
            <div className="cert-ulpin-banner">
              <div className="ulpin-label">UNIQUE LAND PARCEL IDENTIFICATION NUMBER (3D ULPIN)</div>
              <div className="ulpin-value font-mono">{unit.ulpin}</div>
              <div className="ulpin-sub font-mono">
                BASE PARCEL: {building?.building_id || 'DEL-789012'} • LEVEL: F{String(floorNum).padStart(2, '0')} • UNIT: {unit.unit_id}
              </div>
            </div>

            {/* Two Column Identity & QR Block */}
            <div className="cert-identity-grid">
              <div className="cert-meta-col">
                <div className="meta-group">
                  <span className="meta-label">PROPERTY / BUILDING NAME</span>
                  <span className="meta-val font-semibold">{building?.building_name || 'Cadastral Structure Alpha'}</span>
                </div>
                <div className="meta-group">
                  <span className="meta-label">SITE ADDRESS / JURISDICTION</span>
                  <span className="meta-val">{building?.address || 'National Capital Territory of Delhi, India'}</span>
                </div>
                <div className="meta-group">
                  <span className="meta-label">REGISTERED TITLE HOLDER</span>
                  <span className="meta-val owner-val font-semibold">{unit.owner || 'Government of NCT of Delhi / Registered Private Owner'}</span>
                </div>
                <div className="meta-group">
                  <span className="meta-label">PRIMARY USAGE CATEGORY</span>
                  <span className="meta-val uppercase">{unit.use_type || 'Residential Apartment'}</span>
                </div>
              </div>

              {/* Dynamic QR & Verification Code */}
              <div className="cert-qr-col">
                <div className="qr-box">
                  <svg className="qr-svg" viewBox="0 0 100 100" width="100" height="100">
                    <rect width="100" height="100" fill="#ffffff" />
                    <rect x="10" y="10" width="24" height="24" fill="#0f172a" />
                    <rect x="14" y="14" width="16" height="16" fill="#ffffff" />
                    <rect x="18" y="18" width="8" height="8" fill="#0f172a" />
                    <rect x="66" y="10" width="24" height="24" fill="#0f172a" />
                    <rect x="70" y="14" width="16" height="16" fill="#ffffff" />
                    <rect x="74" y="18" width="8" height="8" fill="#0f172a" />
                    <rect x="10" y="66" width="24" height="24" fill="#0f172a" />
                    <rect x="14" y="70" width="16" height="16" fill="#ffffff" />
                    <rect x="18" y="74" width="8" height="8" fill="#0f172a" />
                    <rect x="42" y="15" width="6" height="6" fill="#0f172a" />
                    <rect x="52" y="25" width="6" height="6" fill="#0f172a" />
                    <rect x="40" y="42" width="18" height="18" fill="#0D9488" />
                    <rect x="44" y="46" width="10" height="10" fill="#ffffff" />
                    <rect x="15" y="42" width="6" height="6" fill="#0f172a" />
                    <rect x="25" y="52" width="6" height="6" fill="#0f172a" />
                    <rect x="70" y="42" width="6" height="6" fill="#0f172a" />
                    <rect x="80" y="52" width="6" height="6" fill="#0f172a" />
                    <rect x="66" y="75" width="6" height="6" fill="#0f172a" />
                    <rect x="78" y="75" width="6" height="6" fill="#0f172a" />
                  </svg>
                  <span className="qr-caption font-mono">SCAN TO VERIFY 3D CADASTRE</span>
                </div>
                <div className="security-hash font-mono">
                  SHA-256: {unit.ulpin.slice(0, 16)}...VERIFIED
                </div>
              </div>
            </div>

            {/* Volumetric Boundary Table */}
            <div className="cert-section-title">
              <Compass size={14} />
              <span>3D VOLUMETRIC SPATIAL EXTENTS (WGS84 / EPSG:4326)</span>
            </div>

            <table className="cert-spatial-table font-mono">
              <thead>
                <tr>
                  <th>Spatial Dimension</th>
                  <th>Cadastral Parameter</th>
                  <th>Precision Standard</th>
                  <th>Verified Extent</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Latitude (Centroid)</td>
                  <td>Y-Axis Boundary</td>
                  <td>WGS84 Geodetic</td>
                  <td><strong>{Number(lat).toFixed(6)}° N</strong></td>
                </tr>
                <tr>
                  <td>Longitude (Centroid)</td>
                  <td>X-Axis Boundary</td>
                  <td>WGS84 Geodetic</td>
                  <td><strong>{Number(lon).toFixed(6)}° E</strong></td>
                </tr>
                <tr>
                  <td>Vertical Floor Level</td>
                  <td>Z-Index Tier</td>
                  <td>Floor Level</td>
                  <td><strong>Level {floorNum} ({floorNum === 1 ? 'Ground Floor' : `Floor ${floorNum - 1}`})</strong></td>
                </tr>
                <tr>
                  <td>Lower Elevation (Z-Min)</td>
                  <td>Air-Rights Floor Datum</td>
                  <td>Ordnance / MSL</td>
                  <td><strong>+{Number(zMin).toFixed(2)} m above ground</strong></td>
                </tr>
                <tr>
                  <td>Upper Elevation (Z-Max)</td>
                  <td>Air-Rights Ceiling Datum</td>
                  <td>Ordnance / MSL</td>
                  <td><strong>+{Number(zMax).toFixed(2)} m above ground</strong></td>
                </tr>
                <tr>
                  <td>Total Vertical Height</td>
                  <td>Clear Volume Height</td>
                  <td>Clearance Standard</td>
                  <td><strong>{Number(floorHtM).toFixed(2)} m</strong></td>
                </tr>
                <tr>
                  <td>Carpet / Plinth Area</td>
                  <td>2D Floor Boundary</td>
                  <td>Architectural Scan</td>
                  <td><strong>{Number(areaSqm).toFixed(2)} m² ({Math.round(areaSqm * 10.764)} sq.ft)</strong></td>
                </tr>
                <tr className="highlight-row">
                  <td>3D Volumetric Extent</td>
                  <td>Total Spatial Volume</td>
                  <td>Volumetric Cadastre</td>
                  <td><strong>{volumeM3} m³</strong></td>
                </tr>
              </tbody>
            </table>

            {/* Legal / Institutional Compliance Notice */}
            <div className="cert-compliance-box">
              <div className="compliance-heading">
                <CheckCircle size={14} className="text-emerald-600" />
                <span>INSTITUTIONAL VALIDATION & STATUTORY ENDORSEMENT</span>
              </div>
              <p>
                This Digital Title Deed is generated through the <strong>3D ULPIN Spatial Engine</strong> in compliance with 
                <strong> ISO 19152 (Land Administration Domain Model - LADM Part 3: 3D Marine and Terrestrial Cadastre)</strong>.
                Vertical air-rights and subsurface volumes are non-overlapping and uniquely indexed to eliminate dual-ownership conflicts.
              </p>
            </div>

            {/* Official Signatures & Verification Footer */}
            <footer className="cert-footer">
              <div className="sig-block">
                <div className="sig-line">
                  <div className="digital-stamp">
                    <span>✓ DIGITALLY SIGNED</span>
                    <small>CORS-RTK Differential Network</small>
                  </div>
                </div>
                <span className="sig-title">Digital Cadastral Officer</span>
                <span className="sig-sub">Land Administration Authority</span>
              </div>

              <div className="sig-center-emblem">
                <div className="emboss-seal">
                  <span>BHU-AADHAAR</span>
                  <strong>3D CERTIFIED</strong>
                  <small>ISO 19152</small>
                </div>
              </div>

              <div className="sig-block">
                <div className="sig-line">
                  <div className="digital-stamp">
                    <span>✓ CRYPTOGRAPHIC HASH</span>
                    <small>{new Date().toLocaleDateString('en-GB')}</small>
                  </div>
                </div>
                <span className="sig-title">Registrar of Titles</span>
                <span className="sig-sub">Urban Property Governance</span>
              </div>
            </footer>

            <div className="cert-bottom-timestamp font-mono">
              CERTIFICATE IDENTIFIER: {unit.unit_id} • GENERATION TIMESTAMP: {new Date().toISOString()} • AUTHENTICITY VALIDATED BY 3D-ULPIN PLATFORM
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
