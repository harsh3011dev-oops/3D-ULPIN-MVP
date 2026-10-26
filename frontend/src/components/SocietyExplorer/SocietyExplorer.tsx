import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Search,
  ArrowLeft,
  ArrowRight,
  Loader2,
  MapPin,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle,
} from 'lucide-react';
import { autoDetectBuilding, processSociety } from '../../api/api';
import { SocietyProcessResponse } from '../../types';
import { resolvePlace } from '../../utils/placeResolver';
import './SocietyExplorer.css';

export interface DiscoveredBuilding {
  id: string;
  name: string;
  type: string;
  height: number;
  heightSource?: string;
  floors: number;
  floorSource?: string;
  lat: number;
  lon: number;
  areaSqm?: number;
  unitsPerFloor: number;
  city?: string;
}

interface SocietyExplorerProps {
  onBuildingSelect: (building: DiscoveredBuilding) => void;
  onGenerateSociety: (buildings: DiscoveredBuilding[]) => void;
  onBack: () => void;
}

/** Build an ESRI World Imagery thumbnail URL for a lat/lon point */
function getSatelliteThumbnail(lat: number, lon: number, zoom = 17): string {
  const n = Math.pow(2, zoom);
  const tx = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const ty = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${ty}/${tx}`;
}

// Overpass API endpoints with fallbacks
const OVERPASS_ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
];

/**
 * Query OpenStreetMap Overpass API for REAL buildings near a coordinate.
 * Returns actual building data from OSM — names, heights, levels, coordinates.
 */
async function fetchRealBuildingsFromOSM(
  lat: number,
  lon: number,
  radius: number = 500,
  societyName: string
): Promise<DiscoveredBuilding[]> {
  const query = `
    [out:json][timeout:15];
    (
      way["building"](around:${radius},${lat},${lon});
      relation["building"](around:${radius},${lat},${lon});
    );
    out center tags;
  `;

  let data: any = null;

  // Try each Overpass endpoint with fallback
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (res.ok) {
        data = await res.json();
        break;
      }
    } catch {
      continue;
    }
  }

  if (!data || !data.elements || data.elements.length === 0) {
    return [];
  }

  const buildings: DiscoveredBuilding[] = [];
  let idx = 0;

  for (const el of data.elements) {
    const tags = el.tags || {};
    const buildingType = tags['building'] || 'yes';

    // Skip minor structures like walls, fences, garages unless they have names
    if (['wall', 'fence', 'gate', 'shed', 'roof', 'ruins'].includes(buildingType) && !tags['name']) {
      continue;
    }

    // Get center point
    const bLat = el.center?.lat ?? el.lat ?? lat;
    const bLon = el.center?.lon ?? el.lon ?? lon;

    // Parse height and levels from OSM tags
    const rawHeight = parseFloat(tags['height'] || tags['building:height'] || '0');
    const rawLevels = parseInt(tags['building:levels'] || tags['levels'] || '0', 10);
    
    // Estimate if missing: 1 level ≈ 3.2m
    const floors = rawLevels > 0 ? rawLevels : (rawHeight > 0 ? Math.round(rawHeight / 3.2) : 0);
    const height = rawHeight > 0 ? rawHeight : (floors > 0 ? floors * 3.2 : 0);

    // Build a name
    const name = tags['name'] || tags['addr:housename'] || tags['official_name'] || '';
    const houseNumber = tags['addr:housenumber'] || '';
    const street = tags['addr:street'] || '';
    const addr = [houseNumber, street].filter(Boolean).join(' ');

    let displayName = name || addr || `Building ${idx + 1}`;
    
    // Determine building type label
    let typeLabel = 'Building';
    const bt = buildingType.toLowerCase();
    if (bt === 'residential' || bt === 'apartments') typeLabel = 'Residential';
    else if (bt === 'commercial' || bt === 'office') typeLabel = 'Commercial';
    else if (bt === 'university' || bt === 'college' || bt === 'school') typeLabel = 'Educational';
    else if (bt === 'hospital' || bt === 'clinic') typeLabel = 'Medical';
    else if (bt === 'industrial' || bt === 'warehouse') typeLabel = 'Industrial';
    else if (bt === 'retail' || bt === 'shop' || bt === 'supermarket') typeLabel = 'Retail';
    else if (bt === 'mosque' || bt === 'temple' || bt === 'church') typeLabel = 'Religious';
    else if (bt === 'hotel') typeLabel = 'Hotel';
    else if (bt === 'dormitory' || bt === 'hostel') typeLabel = 'Hostel';
    else if (bt === 'sports_centre' || bt === 'stadium') typeLabel = 'Sports';
    else if (bt === 'civic' || bt === 'government') typeLabel = 'Government';
    else if (bt === 'yes' && tags['amenity']) typeLabel = tags['amenity'].charAt(0).toUpperCase() + tags['amenity'].slice(1);

    // Estimate units per floor from building type
    let unitsPerFloor = 0;
    if (['residential', 'apartments'].includes(bt)) unitsPerFloor = 4;
    else if (['dormitory', 'hostel', 'hotel'].includes(bt)) unitsPerFloor = 8;
    else if (['commercial', 'office'].includes(bt)) unitsPerFloor = 6;

    buildings.push({
      id: `osm_${el.type}_${el.id}`,
      name: displayName,
      type: typeLabel,
      height: parseFloat(height.toFixed(1)),
      floors: floors || 1,
      lat: bLat,
      lon: bLon,
      unitsPerFloor,
    });

    idx++;
  }

  // Sort: named buildings first, then by height descending
  buildings.sort((a, b) => {
    const aHasName = !a.name.startsWith('Building ');
    const bHasName = !b.name.startsWith('Building ');
    if (aHasName && !bHasName) return -1;
    if (!aHasName && bHasName) return 1;
    return b.height - a.height;
  });

  return buildings;
}

function generateProceduralSocietyBuildings(societyName: string, lat: number, lon: number): DiscoveredBuilding[] {
  const clean = societyName.trim() || 'Society Campus';
  const dLat = 0.00045;
  const dLon = 0.00045;
  const now = Date.now();

  return [
    {
      id: `synth_tw_a_${now}`,
      name: `${clean} - Tower A (High-Rise)`,
      type: 'Residential',
      height: 57.6,
      floors: 18,
      lat: parseFloat((lat + dLat).toFixed(6)),
      lon: parseFloat((lon + dLon).toFixed(6)),
      unitsPerFloor: 4,
    },
    {
      id: `synth_tw_b_${now}`,
      name: `${clean} - Tower B (High-Rise)`,
      type: 'Residential',
      height: 57.6,
      floors: 18,
      lat: parseFloat((lat + dLat).toFixed(6)),
      lon: parseFloat((lon - dLon).toFixed(6)),
      unitsPerFloor: 4,
    },
    {
      id: `synth_tw_c_${now}`,
      name: `${clean} - Tower C (Mid-Rise)`,
      type: 'Residential',
      height: 38.4,
      floors: 12,
      lat: parseFloat((lat - dLat).toFixed(6)),
      lon: parseFloat((lon + dLon).toFixed(6)),
      unitsPerFloor: 4,
    },
    {
      id: `synth_club_${now}`,
      name: `${clean} - Clubhouse & Sports Complex`,
      type: 'Commercial',
      height: 9.6,
      floors: 3,
      lat: parseFloat((lat - dLat).toFixed(6)),
      lon: parseFloat((lon - dLon).toFixed(6)),
      unitsPerFloor: 2,
    },
    {
      id: `synth_gate_${now}`,
      name: `${clean} - Commercial Plaza & Security Gate`,
      type: 'Retail',
      height: 12.8,
      floors: 4,
      lat: parseFloat(lat.toFixed(6)),
      lon: parseFloat((lon + dLon * 1.5).toFixed(6)),
      unitsPerFloor: 6,
    },
  ];
}

export default function SocietyExplorer({ onBuildingSelect, onGenerateSociety, onBack }: SocietyExplorerProps) {
  const [societyName, setSocietyName] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [discoveredBuildings, setDiscoveredBuildings] = useState<DiscoveredBuilding[]>([]);
  const [societyInfo, setSocietyInfo] = useState<{ name: string; lat: number; lon: number } | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [satelliteUrl, setSatelliteUrl] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<string>('');
  const [societyResponse, setSocietyResponse] = useState<SocietyProcessResponse | null>(null);

  const handleScanSociety = async () => {
    if (!societyName.trim()) {
      setError('Please enter a society or campus name.');
      return;
    }
    if (!city.trim()) {
      setError('Please enter the city or location.');
      return;
    }

    setLoading(true);
    setError('');
    setDiscoveredBuildings([]);
    setSocietyInfo(null);
    setSatelliteUrl(null);
    setDataSource('');
    setSocietyResponse(null);

    let baseLat: number | null = null;
    let baseLon: number | null = null;

    // Step 1: Get campus center coordinates
    try {
      const data = await autoDetectBuilding({
        building_name: societyName.trim(),
        city: city.trim(),
      });
      if (data.latitude != null && data.longitude != null) {
        baseLat = data.latitude;
        baseLon = data.longitude;
      }
    } catch {
      // Try resolvePlace fallback
    }

    if (baseLat == null || baseLon == null) {
      try {
        const place = await resolvePlace(societyName.trim(), city.trim());
        if (place && place.latitude != null && place.longitude != null) {
          baseLat = place.latitude;
          baseLon = place.longitude;
        }
      } catch {
        // Fallback to default
      }
    }

    if (baseLat == null || baseLon == null) {
      baseLat = 28.6139;
      baseLon = 77.2090;
    }

    setSocietyInfo({ name: societyName, lat: baseLat, lon: baseLon });
    setSatelliteUrl(getSatelliteThumbnail(baseLat, baseLon, 16));

    // Step 2: Call the backend multi-building pipeline API
    try {
      const deltaLat = 0.0025; // ~270m extent
      const deltaLon = 0.0025 / Math.cos((baseLat * Math.PI) / 180);
      const boundary = {
        type: "Polygon",
        coordinates: [[
          [Number((baseLon - deltaLon).toFixed(7)), Number((baseLat - deltaLat).toFixed(7))],
          [Number((baseLon + deltaLon).toFixed(7)), Number((baseLat - deltaLat).toFixed(7))],
          [Number((baseLon + deltaLon).toFixed(7)), Number((baseLat + deltaLat).toFixed(7))],
          [Number((baseLon - deltaLon).toFixed(7)), Number((baseLat + deltaLat).toFixed(7))],
          [Number((baseLon - deltaLon).toFixed(7)), Number((baseLat - deltaLat).toFixed(7))]
        ]]
      };

      const slug = societyName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 20);
      const socResp = await processSociety({
        society_id: `SOC_${slug}`,
        parcel_id: `PARCEL_${slug}`,
        society_name: societyName,
        boundary: boundary,
        detection_mode: 'hybrid',
        max_buildings: 20
      });

      if (socResp && socResp.buildings && socResp.buildings.length > 0) {
        const mapped: DiscoveredBuilding[] = socResp.buildings.map((b) => {
          const coords = b.footprint?.coordinates?.[0] || [];
          let latSum = 0;
          let lonSum = 0;
          coords.forEach((pt: number[]) => { lonSum += pt[0]; latSum += pt[1]; });
          const cLat = coords.length > 0 ? latSum / coords.length : baseLat!;
          const cLon = coords.length > 0 ? lonSum / coords.length : baseLon!;

          return {
            id: b.internal_building_id,
            name: b.building_name || b.internal_building_id,
            type: b.detector_provenance?.tags?.building || 'Apartment / Strata Unit',
            height: b.height?.value_meters || 15.0,
            heightSource: b.height?.source || 'estimated',
            floors: b.floor_count || 4,
            floorSource: b.floor_count_source || 'estimated',
            lat: cLat,
            lon: cLon,
            areaSqm: b.area_sqm,
            unitsPerFloor: b.units && b.floor_count ? Math.round(b.units.length / b.floor_count) : 4,
            city: city.trim()
          };
        });
        setDiscoveredBuildings(mapped);
        setSocietyResponse(socResp);
        setDataSource(`3D-ULPIN AI Multi-Building Engine · ${socResp.buildings.length} validated buildings · Ground Coverage ${socResp.ground_coverage_pct}%`);
      } else {
        const warn = (socResp?.warnings || []).join(', ') || 'No building footprints detected within this society boundary.';
        setError(warn);
      }
    } catch (apiErr: any) {
      console.warn('Backend processSociety error:', apiErr);
      const errMsg = apiErr?.response?.data?.detail || apiErr?.message || 'Society scan failed. Please verify location or try again.';
      setError(`Detection note: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="society-explorer">
      <div className="flow-nav-bar">
        <button type="button" className="flow-back-link font-mono" onClick={onBack}>
          <ArrowLeft size={14} />
          <span>Back to Methods</span>
        </button>
        <span className="font-mono text-muted">METHOD: 01 SOCIETY SCAN</span>
      </div>

      {/* Search Form */}
      <div className="society-search-form">
        <div className="form-group">
          <label className="font-mono">SOCIETY / CAMPUS NAME</label>
          <input
            type="text"
            placeholder="e.g. Lodha World One, DLF Cyber City"
            value={societyName}
            onChange={(e) => { setSocietyName(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleScanSociety()}
          />
        </div>
        <div className="form-group">
          <label className="font-mono">CITY / LOCATION</label>
          <input
            type="text"
            placeholder="e.g. Mumbai, Gurgaon, Pune"
            value={city}
            onChange={(e) => { setCity(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleScanSociety()}
          />
        </div>
      </div>

      <div className="society-action-row">
        <button
          type="button"
          className="btn-primary society-scan-btn"
          disabled={loading || !societyName.trim() || !city.trim()}
          onClick={handleScanSociety}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Scanning Society Campus...</span>
            </>
          ) : (
            <>
              <Search size={16} />
              <span>Scan Society & Discover Buildings</span>
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="explore-error-alert font-mono">
          <span>⚠ {error}</span>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {discoveredBuildings.length > 0 && societyInfo && (
          <motion.div
            className="society-results-area"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {/* Results Header */}
            <div className="society-results-header">
              <div className="society-results-title">
                <CheckCircle size={16} />
                <span className="font-mono">{societyInfo.name.toUpperCase()} — CAMPUS SCAN COMPLETE</span>
              </div>
              <span className="society-results-count font-mono">
                {discoveredBuildings.length} BUILDINGS DETECTED
              </span>
            </div>

            {/* Society Telemetry Panel */}
            {societyResponse && (
              <div className="society-telemetry-panel font-mono">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      SOCIETY ID: {societyResponse.society_id}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      [CRS: {societyResponse.crs}]
                    </span>
                  </div>
                  <div>
                    <span className="ulpin-status-badge">
                      OFFICIAL ULPIN: {societyResponse.official_ulpin ? societyResponse.official_ulpin : 'NULL (PENDING OFFICIAL SURVEY)'}
                    </span>
                  </div>
                </div>

                <div className="telemetry-grid">
                  <div className="telemetry-metric">
                    <span className="telemetry-label">GROUND COVERAGE</span>
                    <span className="telemetry-value">{societyResponse.ground_coverage_pct?.toFixed(1)}%</span>
                  </div>
                  <div className="telemetry-metric">
                    <span className="telemetry-label">TOTAL FOOTPRINT AREA</span>
                    <span className="telemetry-value">{societyResponse.total_footprint_area_sqm?.toFixed(1)} m²</span>
                  </div>
                  <div className="telemetry-metric">
                    <span className="telemetry-label">EST. BUILT-UP AREA</span>
                    <span className="telemetry-value">{societyResponse.total_built_up_area_sqm?.toFixed(1)} m²</span>
                  </div>
                </div>
              </div>
            )}

            {/* Satellite Banner */}
            {satelliteUrl && (
              <div className="society-satellite-banner">
                <img
                  src={satelliteUrl}
                  alt={`${societyInfo.name} satellite`}
                  className="society-satellite-img"
                  onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                />
                <div className="society-satellite-overlay font-mono">
                  ESRI WORLD IMAGERY · ZOOM 16 · {societyInfo.name.toUpperCase()} CAMPUS
                </div>
              </div>
            )}

            {/* Society Generation Action */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              style={{ marginBottom: '16px' }}
            >
              <button
                type="button"
                className="btn-primary"
                style={{ width: '100%', padding: '14px', fontSize: '0.9rem', display: 'flex', gap: '8px', justifyContent: 'center' }}
                onClick={() => onGenerateSociety(discoveredBuildings)}
              >
                <Layers size={18} />
                <span>GENERATE 3D MODELS FOR ENTIRE SOCIETY ({discoveredBuildings.length} BUILDINGS)</span>
              </button>
            </motion.div>

            {/* Building Cards Grid */}
            <motion.div className="buildings-grid">
              {discoveredBuildings.map((bldg, idx) => (
                <motion.div
                  key={bldg.id}
                  className="building-card"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08, duration: 0.3 }}
                >
                  <div className="building-card-header">
                    <div className="building-card-icon">
                      <Building2 size={18} />
                    </div>
                    <div className="building-card-info">
                      <span className="building-card-name">{bldg.name.split(' - ').pop()}</span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span className="building-card-type font-mono">{bldg.type}</span>
                        <span className="font-mono" style={{ fontSize: '0.62rem', color: 'var(--accent-teal)' }}>ID: {bldg.id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="building-card-metrics font-mono">
                    <div className="building-metric">
                      <span className="building-metric-label">HEIGHT</span>
                      <span className="building-metric-value">
                        {bldg.height}m <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>({bldg.heightSource || 'est'})</span>
                      </span>
                    </div>
                    <div className="building-metric">
                      <span className="building-metric-label">FLOORS</span>
                      <span className="building-metric-value">{bldg.floors} FL</span>
                    </div>
                    <div className="building-metric">
                      <span className="building-metric-label">FOOTPRINT AREA</span>
                      <span className="building-metric-value">{bldg.areaSqm ? `${bldg.areaSqm.toFixed(1)} m²` : '—'}</span>
                    </div>
                    <div className="building-metric">
                      <span className="building-metric-label">COORDINATES</span>
                      <span className="building-metric-value">{bldg.lat.toFixed(4)}°, {bldg.lon.toFixed(4)}°</span>
                    </div>
                  </div>

                  {/* Floor Breakdown Accordion */}
                  {bldg.floors > 0 && (
                    <>
                      <button
                        type="button"
                        className="floor-breakdown-toggle font-mono"
                        onClick={() => setExpandedCard(expandedCard === bldg.id ? null : bldg.id)}
                      >
                        <span>
                          <Layers size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                          ULPIN Floor Breakdown ({bldg.floors} Floors × {bldg.unitsPerFloor || '—'} Units)
                        </span>
                        {expandedCard === bldg.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      <AnimatePresence>
                        {expandedCard === bldg.id && (
                          <motion.div
                            className="floor-breakdown-list"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            {Array.from({ length: Math.min(bldg.floors, 8) }, (_, i) => (
                              <div key={i} className="floor-breakdown-item font-mono">
                                <span className="floor-label-tag">
                                  {i === 0 ? 'GF' : `F${i}`}
                                </span>
                                <span className="floor-units-tag">
                                  {bldg.unitsPerFloor > 0 ? `${bldg.unitsPerFloor} Units` : 'Common Area'}
                                </span>
                              </div>
                            ))}
                            {bldg.floors > 8 && (
                              <div className="floor-breakdown-item font-mono" style={{ fontStyle: 'italic' }}>
                                <span>... +{bldg.floors - 8} more floors</span>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}

                  <button
                    type="button"
                    className="building-generate-btn"
                    onClick={() => onBuildingSelect(bldg)}
                  >
                    <span>Generate 3D ULPIN</span>
                    <ArrowRight size={14} />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
