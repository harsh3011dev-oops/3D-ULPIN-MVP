import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../components/Header/Header';
import { autoDetectBuilding, createBuilding } from '../api/api';
import { AutoDetectBuildingResult } from '../types';
import {
  MapPin,
  Layers,
  ArrowRight,
  ArrowLeft,
  Search,
  Building2,
  CheckCircle,
  Loader2,
  Compass,
  AlertTriangle,
  Sparkles,
  Check
} from 'lucide-react';
import './ExplorePage.css';

interface FormState {
  buildingName: string;
  location: string;
  latitude: string;
  longitude: string;
  height: string;
  floors: string;
}

type EntryMode = 'select' | 'search' | 'manual';

// Fallback presets — clicking triggers a live AI search, no coords hardcoded
const PRESET_LANDMARKS = [
  { name: 'Burj Khalifa', city: 'Dubai' },
  { name: 'Rashtrapati Bhavan', city: 'New Delhi' },
  { name: 'India Gate', city: 'New Delhi' },
  { name: 'Taj Mahal', city: 'Agra' },
];

/** Build an ESRI World Imagery thumbnail URL for a lat/lon point */
function getSatelliteThumbnail(lat: number, lon: number, zoom = 17): string {
  const n = Math.pow(2, zoom);
  const tx = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const ty = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;
}

/**
 * Parses coordinates in various standard and geodetic formats:
 * - Standard directional: "25.19729°N", "55.27450°E", "25.19729° S", "55.27450° W"
 * - Directional suffixes: "25.19729 N", "55.27450 E", "25.19729S", "55.27450W"
 * - DMS notation: "25° 11' 50.2\" N", "55° 16' 28.2\" E"
 * - Decimal: "25.19729", "-55.27450"
 */
export function parseCoordinate(val: string, type?: 'lat' | 'lon'): number {
  if (!val) return NaN;
  const raw = val.trim();
  if (!raw) return NaN;

  // Check DMS pattern: degrees° minutes' seconds" [N/S/E/W]
  const dmsMatch = raw.match(/([0-9.]+)[°\s]+([0-9.]+)?['\s]*([0-9.]+)?["\s]*([NSEWnsew])?/i);
  if (dmsMatch && (raw.includes('°') || raw.includes("'") || raw.includes('"'))) {
    const deg = parseFloat(dmsMatch[1] || '0');
    const min = parseFloat(dmsMatch[2] || '0');
    const sec = parseFloat(dmsMatch[3] || '0');
    const dir = (dmsMatch[4] || '').toUpperCase();

    if (!isNaN(deg)) {
      let dec = deg + (isNaN(min) ? 0 : min / 60) + (isNaN(sec) ? 0 : sec / 3600);
      if (dir === 'S' || dir === 'W') dec = -dec;
      return dec;
    }
  }

  // Check standard directional degree notation: e.g. "25.19729°N" or "25.19729 N" or "-25.19729"
  const clean = raw.replace(/[°º]/g, '').trim();
  const dirMatch = clean.match(/^([+-]?[0-9.]+)\s*([NSEWnsew])?$/i);
  if (dirMatch) {
    let num = parseFloat(dirMatch[1]);
    const dir = (dirMatch[2] || '').toUpperCase();
    if (!isNaN(num)) {
      if (dir === 'S' || dir === 'W') {
        num = -Math.abs(num);
      } else if (dir === 'N' || dir === 'E') {
        num = Math.abs(num);
      }
      return num;
    }
  }

  // Fallback plain float
  const fallback = parseFloat(clean.replace(/[^0-9.-]/g, ''));
  return fallback;
}

function emptyForm(): FormState {
  return {
    buildingName: '',
    location: '',
    latitude: '',
    longitude: '',
    height: '',
    floors: '',
  };
}

export default function ExplorePage() {
  const navigate = useNavigate();
  const [entryMode, setEntryMode] = useState<EntryMode>('select');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Search State
  const [searchName, setSearchName] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [detectedBuilding, setDetectedBuilding] = useState<AutoDetectBuildingResult | null>(null);
  const [satelliteUrl, setSatelliteUrl] = useState<string | null>(null);
  const [presetLoading, setPresetLoading] = useState<string | null>(null);

  // Manual Form State
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(emptyForm());

  const setFormField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const handleLatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const val = e.target.value;
    // Auto-detect combined paste e.g. "25.19729°N, 55.27450°E" or "25.19729, 55.27450"
    if (val.includes(',')) {
      const parts = val.split(',');
      if (parts.length >= 2) {
        setForm((f) => ({
          ...f,
          latitude: parts[0].trim(),
          longitude: parts[1].trim(),
        }));
        return;
      }
    }
    setForm((f) => ({ ...f, latitude: val }));
  };

  const handleLonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const val = e.target.value;
    if (val.includes(',')) {
      const parts = val.split(',');
      if (parts.length >= 2) {
        setForm((f) => ({
          ...f,
          latitude: parts[0].trim(),
          longitude: parts[1].trim(),
        }));
        return;
      }
    }
    setForm((f) => ({ ...f, longitude: val }));
  };

  const handleSearch = async () => {
    if (!searchName.trim() || !searchCity.trim()) {
      setError('Please provide both building name and city.');
      return;
    }
    setLoading(true);
    setError('');
    setDetectedBuilding(null);
    setSatelliteUrl(null);
    try {
      const result = await autoDetectBuilding({
        building_name: searchName.trim(),
        city: searchCity.trim(),
      });
      setDetectedBuilding(result);
      if (result.latitude != null && result.longitude != null) {
        setSatelliteUrl(getSatelliteThumbnail(result.latitude, result.longitude));
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Building lookup failed. You can use manual coordinates instead.');
      setDetectedBuilding(null);
    } finally {
      setLoading(false);
    }
  };

  const loadPresetDynamic = async (preset: { name: string; city: string }) => {
    setPresetLoading(preset.name);
    setError('');
    setDetectedBuilding(null);
    setSatelliteUrl(null);
    setSearchName(preset.name);
    setSearchCity(preset.city);
    setEntryMode('search');
    try {
      const result = await autoDetectBuilding({
        building_name: preset.name,
        city: preset.city,
      });
      setDetectedBuilding(result);
      if (result.latitude != null && result.longitude != null) {
        setSatelliteUrl(getSatelliteThumbnail(result.latitude, result.longitude));
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : `Could not fetch "${preset.name}". Try searching manually.`);
    } finally {
      setPresetLoading(null);
    }
  };

  const handleEditDetected = (field: keyof AutoDetectBuildingResult, value: string) => {
    if (!detectedBuilding) return;
    const numeric = field === 'floors' ? parseInt(value, 10) : parseFloat(value);
    setDetectedBuilding({
      ...detectedBuilding,
      [field]: Number.isNaN(numeric) ? (value === '' ? null : detectedBuilding[field]) : numeric,
    });
  };

  const submitDetectedBuilding = async () => {
    if (!detectedBuilding) return;
    if (detectedBuilding.latitude == null || detectedBuilding.longitude == null) {
      setError('Latitude and longitude coordinates are required.');
      return;
    }
    if (detectedBuilding.height_meters == null || detectedBuilding.height_meters <= 0) {
      setError('Please provide a valid height in meters.');
      return;
    }
    if (detectedBuilding.floors == null || detectedBuilding.floors < 1) {
      setError('Please specify at least 1 floor level.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const parcelId = `AUTO_${detectedBuilding.building_name.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 18)}_${Date.now().toString(36).toUpperCase()}`;
      const res = await createBuilding({
        parcel_id: parcelId,
        building_name: detectedBuilding.building_name,
        address: `${detectedBuilding.building_name}, ${detectedBuilding.city}`,
        latitude: detectedBuilding.latitude,
        longitude: detectedBuilding.longitude,
        height_meters: detectedBuilding.height_meters,
        floor_count: detectedBuilding.floors,
      });
      if (!res.job_id) throw new Error('Pipeline job failed to queue.');
      navigate(`/processing/${res.job_id}`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Could not launch pipeline job.');
    } finally {
      setLoading(false);
    }
  };

  const validateManualStep = (): boolean => {
    if (step === 1) {
      if (!form.buildingName.trim()) { setError('Enter a building or parcel identifier.'); return false; }
      if (!form.location.trim())     { setError('Enter city or location address.'); return false; }
    }
    if (step === 2) {
      const lat = parseCoordinate(form.latitude, 'lat');
      const lon = parseCoordinate(form.longitude, 'lon');
      if (isNaN(lat) || lat < -90 || lat > 90) {
        setError('Enter valid latitude (-90° to 90° or standard format e.g. 25.19729°N).');
        return false;
      }
      if (isNaN(lon) || lon < -180 || lon > 180) {
        setError('Enter valid longitude (-180° to 180° or standard format e.g. 55.27450°E).');
        return false;
      }
    }
    if (step === 3) {
      const h = parseFloat(form.height);
      const f = parseInt(form.floors, 10);
      if (!form.height || isNaN(h) || h <= 0) { setError('Enter height in meters (> 0).'); return false; }
      if (!form.floors || isNaN(f) || f < 1) { setError('Enter at least 1 floor level.'); return false; }
    }
    setError('');
    return true;
  };

  const handleManualGenerate = async () => {
    if (!validateManualStep()) return;
    setLoading(true);
    setError('');
    try {
      const lat = parseCoordinate(form.latitude, 'lat');
      const lon = parseCoordinate(form.longitude, 'lon');
      const parcelId = `PARCEL_${form.buildingName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 18)}_${Date.now().toString(36).toUpperCase()}`;
      const res = await createBuilding({
        parcel_id: parcelId,
        building_name: form.buildingName.trim(),
        address: `${form.buildingName}, ${form.location}`,
        latitude: lat,
        longitude: lon,
        height_meters: parseFloat(form.height),
        floor_count: parseInt(form.floors, 10),
      });
      if (!res.job_id) throw new Error('Pipeline job failed to queue.');
      navigate(`/processing/${res.job_id}`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to submit building.');
    } finally {
      setLoading(false);
    }
  };


  // Parsed coordinates for live HUD indicator
  const parsedLat = parseCoordinate(form.latitude, 'lat');
  const parsedLon = parseCoordinate(form.longitude, 'lon');

  return (
    <div className="explore-page-wrapper">
      <Header />

      <main className="explore-main-container">
        <div className="explore-layout-grid">
          {/* ── LEFT COLUMN: CADASTRAL PREVIEW & SPATIAL TELEMETRY ── */}
          <div className="explore-preview-col">
            <div className="preview-cadastral-card cadastral-panel">
              <div className="preview-header">
                <div className="preview-status font-mono">
                  <span className="live-dot" />
                  <span>CADASTRAL HUD · REAL-TIME TELEMETRY</span>
                </div>
                <span className="chip-neutral font-mono">EPSG:4326</span>
              </div>

              {/* Architectural Wireframe HUD Display */}
              <div className="wireframe-hud-box">
                <div className="hud-grid-overlay" />
                <div className="hud-crosshair-center">
                  <div className="crosshair-ring" />
                  <div className="crosshair-x" />
                </div>

                <div className="hud-corner top-left font-mono">
                  <span>DATUM: WGS84</span>
                  <span>ACCURACY: ±0.05m</span>
                </div>

                <div className="hud-corner top-right font-mono">
                  <span>METHOD: {entryMode.toUpperCase()}</span>
                  <span>STATUS: READY</span>
                </div>

                <div className="hud-corner bottom-left font-mono">
                  <span>
                    LAT: {detectedBuilding?.latitude != null
                      ? `${detectedBuilding.latitude.toFixed(5)}°`
                      : !isNaN(parsedLat)
                      ? `${parsedLat.toFixed(5)}°`
                      : '—'}
                  </span>
                  <span>
                    LON: {detectedBuilding?.longitude != null
                      ? `${detectedBuilding.longitude.toFixed(5)}°`
                      : !isNaN(parsedLon)
                      ? `${parsedLon.toFixed(5)}°`
                      : '—'}
                  </span>
                </div>

                <div className="hud-corner bottom-right font-mono">
                  <span>H: {detectedBuilding?.height_meters != null ? `${detectedBuilding.height_meters}m` : form.height ? `${form.height}m` : '—'}</span>
                  <span>FL: {detectedBuilding?.floors != null ? detectedBuilding.floors : form.floors || '—'}</span>
                </div>
              </div>

              {/* Preset Landmarks Quick Selector */}
              <div className="presets-selector-section">
                <div className="presets-label font-mono">
                  <span>QUICK LANDMARK PRESETS (1-CLICK LOAD)</span>
                </div>
                <div className="presets-grid">
                  {PRESET_LANDMARKS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`preset-tag-btn ${presetLoading === p.name ? 'loading' : ''}`}
                      disabled={presetLoading !== null}
                      onClick={() => loadPresetDynamic(p)}
                    >
                      {presetLoading === p.name
                        ? <Loader2 size={12} className="animate-spin" color="#0D9488" />
                        : <Building2 size={12} color="#0D9488" />}
                      <span>{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Technical Specifications Summary */}
              <div className="preview-specs-footer font-mono">
                <div className="spec-row">
                  <span>TOPOLOGY PROTOCOL</span>
                  <span className="val">ISO 19152 LADM 3D</span>
                </div>
                <div className="spec-row">
                  <span>MESH SYNTHESIS</span>
                  <span className="val">LoD1 / OSM2World</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: SELECTION & INGESTION INTERFACE ── */}
          <div className="explore-interface-col">
            <div className="interface-card cadastral-panel">
              {/* Header */}
              <div className="interface-header">
                <span className="chip-cadastral">INGESTION WORKBENCH</span>
                <h1 className="interface-title font-display">Create a 3D Cadastral Record</h1>
                <p className="interface-desc">
                  Select an ingestion method to auto-detect geometry or manually configure multi-strata boundaries.
                </p>
              </div>

              {/* Mode Selection Panels (when mode is 'select') */}
              {entryMode === 'select' && (
                <div className="mode-selection-rows">
                  <div
                    className="mode-row-card"
                    onClick={() => setEntryMode('search')}
                  >
                    <div className="mode-num font-mono">01</div>
                    <div className="mode-content">
                      <div className="mode-heading">Search Building</div>
                      <div className="mode-sub">
                        Auto-fill coordinates, elevations, and floor levels via AI geospatial lookup.
                      </div>
                    </div>
                    <ArrowRight size={18} className="mode-arrow" />
                  </div>

                  <div
                    className="mode-row-card"
                    onClick={() => { setEntryMode('manual'); setStep(1); }}
                  >
                    <div className="mode-num font-mono">02</div>
                    <div className="mode-content">
                      <div className="mode-heading">Manual Coordinates</div>
                      <div className="mode-sub">
                        Define custom geodetic parcel boundaries, Z-elevations, and floor strata parameters.
                      </div>
                    </div>
                    <ArrowRight size={18} className="mode-arrow" />
                  </div>
                </div>
              )}

              {/* ── SEARCH BUILDING FLOW ── */}
              {entryMode === 'search' && (
                <div className="search-flow-container">
                  <div className="flow-nav-bar">
                    <button
                      type="button"
                      className="flow-back-link font-mono"
                      onClick={() => { setEntryMode('select'); setDetectedBuilding(null); setError(''); }}
                    >
                      <ArrowLeft size={14} />
                      <span>Back to Methods</span>
                    </button>
                    <span className="font-mono text-muted">METHOD: 01 SEARCH</span>
                  </div>

                  <div className="search-form-grid">
                    <div className="form-group">
                      <label className="font-mono">BUILDING / LANDMARK NAME</label>
                      <input
                        type="text"
                        placeholder="e.g. Burj Khalifa, Taj Mahal, Empire State"
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      />
                    </div>

                    <div className="form-group">
                      <label className="font-mono">CITY / LOCATION</label>
                      <input
                        type="text"
                        placeholder="e.g. Dubai, Agra, New York"
                        value={searchCity}
                        onChange={(e) => setSearchCity(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      />
                    </div>
                  </div>

                  <div className="search-action-row">
                    <button
                      type="button"
                      className="btn-primary search-btn"
                      disabled={loading || !searchName.trim() || !searchCity.trim()}
                      onClick={handleSearch}
                    >
                      {loading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Querying Geospatial AI...</span>
                        </>
                      ) : (
                        <>
                          <Search size={16} />
                          <span>Search Landmark</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Detected Building Card */}
                  {detectedBuilding && (
                    <motion.div
                      className="detected-result-card"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="detected-header">
                        <div className="detected-title-block">
                          <CheckCircle size={16} color="#10B981" />
                          <span className="detected-name">{detectedBuilding.building_name}</span>
                          <span className="detected-city font-mono">({detectedBuilding.city})</span>
                        </div>
                        <span className="chip-success font-mono">
                          CONFIDENCE: {detectedBuilding.confidence}%
                        </span>
                      </div>

                      {/* Live Satellite Thumbnail from ESRI World Imagery */}
                      {satelliteUrl && (
                        <div className="satellite-thumbnail-container">
                          <img
                            src={satelliteUrl}
                            alt={`${detectedBuilding.building_name} satellite view`}
                            className="satellite-thumbnail"
                            onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                          />
                          <div className="satellite-overlay-label font-mono">
                            ESRI WORLD IMAGERY · ZOOM 17 · {detectedBuilding.building_name.toUpperCase()}
                          </div>
                        </div>
                      )}

                      <div className="detected-fields-grid">
                        <div className="detected-field">
                          <label className="font-mono">LATITUDE</label>
                          <input
                            type="number"
                            step="any"
                            value={detectedBuilding.latitude ?? ''}
                            onChange={(e) => handleEditDetected('latitude', e.target.value)}
                          />
                        </div>

                        <div className="detected-field">
                          <label className="font-mono">LONGITUDE</label>
                          <input
                            type="number"
                            step="any"
                            value={detectedBuilding.longitude ?? ''}
                            onChange={(e) => handleEditDetected('longitude', e.target.value)}
                          />
                        </div>

                        <div className="detected-field">
                          <label className="font-mono">HEIGHT (METRES)</label>
                          <input
                            type="number"
                            value={detectedBuilding.height_meters ?? ''}
                            onChange={(e) => handleEditDetected('height_meters', e.target.value)}
                          />
                        </div>

                        <div className="detected-field">
                          <label className="font-mono">FLOORS</label>
                          <input
                            type="number"
                            value={detectedBuilding.floors ?? ''}
                            onChange={(e) => handleEditDetected('floors', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="detected-submit-row">
                        <button
                          type="button"
                          className="btn-primary submit-detected-btn"
                          disabled={loading}
                          onClick={submitDetectedBuilding}
                        >
                          {loading ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              <span>Queueing Pipeline...</span>
                            </>
                          ) : (
                            <>
                              <span>Generate 3D ULPIN Model</span>
                              <ArrowRight size={16} />
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* ── MANUAL COORDINATES WIZARD FLOW ── */}
              {entryMode === 'manual' && (
                <div className="manual-flow-container">
                  <div className="flow-nav-bar">
                    <button
                      type="button"
                      className="flow-back-link font-mono"
                      onClick={() => { setEntryMode('select'); setError(''); }}
                    >
                      <ArrowLeft size={14} />
                      <span>Back to Methods</span>
                    </button>
                    <span className="font-mono text-muted">STEP 0{step} / 04</span>
                  </div>

                  {/* Step Progress Dots */}
                  <div className="wizard-steps-track font-mono">
                    {[
                      { s: 1, label: '01 Location' },
                      { s: 2, label: '02 Coordinates' },
                      { s: 3, label: '03 Dimensions' },
                      { s: 4, label: '04 Generate' },
                    ].map((st) => (
                      <div
                        key={st.s}
                        className={`wizard-step-pill ${step === st.s ? 'active' : step > st.s ? 'done' : ''}`}
                      >
                        <span>{st.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Step 1: Location */}
                  {step === 1 && (
                    <div className="step-panel">
                      <div className="form-group">
                        <label className="font-mono">BUILDING / PARCEL NAME</label>
                        <input
                          type="text"
                          placeholder="e.g. Burj Khalifa, Tower Alpha, Parcel 482"
                          value={form.buildingName}
                          onChange={setFormField('buildingName')}
                        />
                      </div>
                      <div className="form-group">
                        <label className="font-mono">CITY / ADDRESS</label>
                        <input
                          type="text"
                          placeholder="e.g. Dubai, Connaught Place, Agra"
                          value={form.location}
                          onChange={setFormField('location')}
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 2: Coordinates with Standard Form & Paste Support */}
                  {step === 2 && (
                    <div className="step-panel">
                      <div className="coord-format-tip font-mono">
                        <Compass size={14} color="#0D9488" />
                        <span>Accepts standard geodetic (<strong>25.19729°N, 55.27450°E</strong>), DMS, or decimal notation.</span>
                      </div>

                      <div className="form-group">
                        <div className="form-label-row font-mono">
                          <label>LATITUDE (NORTH / SOUTH)</label>
                          {!isNaN(parsedLat) && (
                            <span className="parsed-badge">
                              <Check size={11} />
                              <span>WGS84: {parsedLat.toFixed(6)}°</span>
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. 25.19729°N or 25.19729"
                          value={form.latitude}
                          onChange={handleLatChange}
                        />
                      </div>

                      <div className="form-group">
                        <div className="form-label-row font-mono">
                          <label>LONGITUDE (EAST / WEST)</label>
                          {!isNaN(parsedLon) && (
                            <span className="parsed-badge">
                              <Check size={11} />
                              <span>WGS84: {parsedLon.toFixed(6)}°</span>
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. 55.27450°E or 55.27450"
                          value={form.longitude}
                          onChange={handleLonChange}
                        />
                      </div>

                      <div className="paste-helper-hint font-mono">
                        <span>Tip: You can paste a combined pair (e.g. <code>25.19729°N, 55.27450°E</code>) directly into Latitude to auto-fill both.</span>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Dimensions */}
                  {step === 3 && (
                    <div className="step-panel">
                      <div className="form-group">
                        <label className="font-mono">ESTIMATED HEIGHT (METRES)</label>
                        <input
                          type="number"
                          placeholder="e.g. 828 or 45"
                          value={form.height}
                          onChange={setFormField('height')}
                        />
                      </div>
                      <div className="form-group">
                        <label className="font-mono">TOTAL FLOOR LEVELS</label>
                        <input
                          type="number"
                          placeholder="e.g. 163 or 14"
                          value={form.floors}
                          onChange={setFormField('floors')}
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 4: Review & Generate */}
                  {step === 4 && (
                    <div className="step-panel">
                      <div className="review-summary-card">
                        <div className="review-title font-mono">PARCEL SPECIFICATION SUMMARY</div>
                        <div className="review-grid font-mono">
                          <div className="rev-item"><span>NAME:</span> <strong>{form.buildingName}</strong></div>
                          <div className="rev-item"><span>LOCATION:</span> <strong>{form.location}</strong></div>
                          <div className="rev-item">
                            <span>LATITUDE:</span>{' '}
                            <strong>
                              {form.latitude}{' '}
                              <span style={{ color: 'var(--accent-teal)', fontWeight: 600 }}>
                                ({parsedLat.toFixed(5)}°)
                              </span>
                            </strong>
                          </div>
                          <div className="rev-item">
                            <span>LONGITUDE:</span>{' '}
                            <strong>
                              {form.longitude}{' '}
                              <span style={{ color: 'var(--accent-teal)', fontWeight: 600 }}>
                                ({parsedLon.toFixed(5)}°)
                              </span>
                            </strong>
                          </div>
                          <div className="rev-item"><span>HEIGHT:</span> <strong>{form.height} m</strong></div>
                          <div className="rev-item"><span>FLOORS:</span> <strong>{form.floors} Levels</strong></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Wizard Step Controls */}
                  <div className="wizard-actions-bar">
                    {step > 1 && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => { setError(''); setStep(step - 1); }}
                      >
                        <ArrowLeft size={15} />
                        <span>Previous</span>
                      </button>
                    )}

                    {step < 4 ? (
                      <button
                        type="button"
                        className="btn-primary wizard-next-btn"
                        onClick={() => { if (validateManualStep()) setStep(step + 1); }}
                      >
                        <span>Continue</span>
                        <ArrowRight size={15} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary wizard-next-btn"
                        disabled={loading}
                        onClick={handleManualGenerate}
                      >
                        {loading ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Synthesizing 3D Model...</span>
                          </>
                        ) : (
                          <>
                            <span>Generate 3D ULPIN Model</span>
                            <ArrowRight size={16} />
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Error Callout */}
              {error && (
                <div className="explore-error-alert font-mono">
                  <AlertTriangle size={15} color="#DC2626" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
