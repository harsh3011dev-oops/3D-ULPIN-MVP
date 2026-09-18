import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  FileText,
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Layers,
  Building2,
  X,
} from 'lucide-react';
import { resolvePlace } from '../../utils/placeResolver';
import './PlanParser.css';

interface ParsedResult {
  fileName: string;
  format: string;
  featureCount: number;
  totalAreaSqm: number;
  categories: Record<string, number>;
  rawData: any;
}

interface PlanParserProps {
  onParsed: (result: {
    societyName: string;
    buildingName: string;
    floors: number;
    floorHeight: number;
    lat?: number;
    lon?: number;
    parsedResult: ParsedResult;
  }) => void;
  onBack: () => void;
}

const ACCEPTED_FORMATS = ['.geojson', '.json', '.dxf'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFormatLabel(fileName: string): string {
  if (fileName.endsWith('.geojson')) return 'GeoJSON';
  if (fileName.endsWith('.json')) return 'JSON';
  if (fileName.endsWith('.dxf')) return 'DXF (AutoCAD)';
  return 'Unknown';
}

export default function PlanParser({ onParsed, onBack }: PlanParserProps) {
  const [file, setFile] = useState<File | null>(null);
  const [societyName, setSocietyName] = useState('');
  const [buildingName, setBuildingName] = useState('');
  const [floors, setFloors] = useState('');
  const [floorHeight, setFloorHeight] = useState('3.5');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const processFile = (selectedFile: File) => {
    const ext = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_FORMATS.includes(ext)) {
      setError(`Unsupported format: ${ext}. Please upload .geojson, .json, or .dxf files.`);
      return;
    }
    setFile(selectedFile);
    setError('');
    setParsedResult(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleParse = async () => {
    if (!file) {
      setError('Please upload a floor plan file first.');
      return;
    }

    setParsing(true);
    setError('');

    try {
      const text = await file.text();
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (ext === 'geojson' || ext === 'json') {
        const data = JSON.parse(text);
        const features = data.features || (data.type === 'Feature' ? [data] : []);

        // Count features by category
        const categories: Record<string, number> = {};
        let totalArea = 0;

        for (const feature of features) {
          const cat = feature.properties?.category || feature.properties?.type || feature.properties?.use || 'unit';
          categories[cat] = (categories[cat] || 0) + 1;
          totalArea += feature.properties?.area_sqm || feature.properties?.area || 0;
        }

        // Estimate area if not available from properties
        if (totalArea === 0) {
          totalArea = features.length * 85; // ~85 sqm per unit average
        }

        setParsedResult({
          fileName: file.name,
          format: ext === 'geojson' ? 'GeoJSON' : 'JSON',
          featureCount: features.length,
          totalAreaSqm: parseFloat(totalArea.toFixed(1)),
          categories,
          rawData: data,
        });
      } else if (ext === 'dxf') {
        // DXF will be processed server-side, show placeholder result
        setParsedResult({
          fileName: file.name,
          format: 'DXF (AutoCAD)',
          featureCount: 0, // Will be determined server-side
          totalAreaSqm: 0,
          categories: { 'dxf_entity': 1 },
          rawData: { raw_dxf: true, size: file.size },
        });
      }
    } catch (err: any) {
      setError(`Failed to parse file: ${err.message || 'Invalid format'}`);
    } finally {
      setParsing(false);
    }
  };

  const handleGenerate = async () => {
    if (!parsedResult) return;
    
    setParsing(true);
    let lat = 28.6139; // Default to safe coordinate (Delhi) instead of 0,0 which crashes YOLO
    let lon = 77.2090;

    const query = `${buildingName.trim()} ${societyName.trim()}`.trim();
    if (query) {
      try {
        const place = await resolvePlace(query);
        if (place && place.latitude != null && place.longitude != null) {
          lat = place.latitude;
          lon = place.longitude;
        }
      } catch (e) {
        console.warn("Geocoding failed for plan, using default coordinates");
      }
    }

    setParsing(false);
    onParsed({
      societyName: societyName.trim(),
      buildingName: buildingName.trim() || parsedResult.fileName.split('.')[0] || 'Parsed Building',
      floors: floors ? parseInt(floors) : 1,
      floorHeight: floorHeight ? parseFloat(floorHeight) : 3.5,
      lat,
      lon,
      parsedResult,
    });
  };

  return (
    <div className="plan-parser">
      <div className="flow-nav-bar">
        <button type="button" className="flow-back-link font-mono" onClick={onBack}>
          <ArrowLeft size={14} />
          <span>Back to Methods</span>
        </button>
        <span className="font-mono text-muted">METHOD: 02 PLAN PARSER</span>
      </div>

      {/* Drag & Drop Upload Zone */}
      {!file ? (
        <div
          className={`dropzone-container ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".geojson,.json,.dxf"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <div className="dropzone-icon">
            <Upload size={22} />
          </div>
          <span className="dropzone-title">Drop Floor Plan File Here</span>
          <span className="dropzone-hint">or click to browse your files</span>
          <div className="dropzone-formats font-mono">
            {ACCEPTED_FORMATS.map((fmt) => (
              <span key={fmt} className="format-badge">{fmt.toUpperCase()}</span>
            ))}
          </div>
        </div>
      ) : (
        <motion.div
          className="file-info-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="file-info-icon">
            <FileText size={18} />
          </div>
          <div className="file-info-details">
            <span className="file-info-name">{file.name}</span>
            <div className="file-info-meta font-mono">
              <span>{formatFileSize(file.size)}</span>
              <span className="format-badge active">{getFormatLabel(file.name)}</span>
            </div>
          </div>
          <button
            type="button"
            className="file-remove-btn"
            onClick={() => { setFile(null); setParsedResult(null); }}
          >
            <X size={14} />
          </button>
        </motion.div>
      )}

      {/* Metadata Form */}
      <div className="plan-metadata-form">
        <div className="form-group">
          <label className="font-mono">SOCIETY NAME (OPTIONAL)</label>
          <input
            type="text"
            placeholder="e.g. Green Valley Society"
            value={societyName}
            onChange={(e) => setSocietyName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="font-mono">BUILDING NAME (OPTIONAL)</label>
          <input
            type="text"
            placeholder="e.g. Tower A, Block 1"
            value={buildingName}
            onChange={(e) => { setBuildingName(e.target.value); setError(''); }}
          />
        </div>
        <div className="form-group">
          <label className="font-mono">NUMBER OF FLOORS (OPTIONAL)</label>
          <input
            type="number"
            placeholder="e.g. 14 (Defaults to 1)"
            value={floors}
            onChange={(e) => { setFloors(e.target.value); setError(''); }}
            min={1}
          />
        </div>
        <div className="form-group">
          <label className="font-mono">FLOOR HEIGHT (METRES)</label>
          <input
            type="number"
            placeholder="e.g. 3.5"
            value={floorHeight}
            onChange={(e) => setFloorHeight(e.target.value)}
            step="0.1"
            min={2}
          />
        </div>
      </div>

      {/* Parse Button */}
      {file && !parsedResult && (
        <div className="parse-action-row">
          <button
            type="button"
            className="btn-primary parse-generate-btn"
            disabled={parsing || !file}
            onClick={handleParse}
          >
            {parsing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Parsing Floor Plan...</span>
              </>
            ) : (
              <>
                <Layers size={16} />
                <span>Parse Floor Plan</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="explore-error-alert font-mono">
          <AlertTriangle size={15} color="#DC2626" />
          <span>{error}</span>
        </div>
      )}

      {/* Parsed Results Preview */}
      {parsedResult && (
        <motion.div
          className="parse-results-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="parse-results-header font-mono">
            <CheckCircle size={16} />
            <span>FLOOR PLAN PARSED SUCCESSFULLY</span>
          </div>

          <div className="parse-stats-grid font-mono">
            <div className="parse-stat">
              <span className="parse-stat-value">{parsedResult.featureCount || '—'}</span>
              <span className="parse-stat-label">UNITS FOUND</span>
            </div>
            <div className="parse-stat">
              <span className="parse-stat-value">
                {parsedResult.totalAreaSqm > 0 ? `${parsedResult.totalAreaSqm}` : '—'}
              </span>
              <span className="parse-stat-label">TOTAL AREA (SQM)</span>
            </div>
            <div className="parse-stat">
              <span className="parse-stat-value">{Object.keys(parsedResult.categories).length}</span>
              <span className="parse-stat-label">CATEGORIES</span>
            </div>
          </div>

          {/* Category breakdown */}
          {Object.keys(parsedResult.categories).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(parsedResult.categories).map(([cat, count]) => (
                <span key={cat} className="format-badge active font-mono">
                  {cat}: {count}
                </span>
              ))}
            </div>
          )}

          <div className="parse-action-row">
            <button
              type="button"
              className="btn-primary parse-generate-btn"
              onClick={handleGenerate}
            >
              <Building2 size={16} />
              <span>Generate ULPINs from Floor Plan</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
