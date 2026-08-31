import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Image, Layers, MapPin, Sparkles, ArrowRight } from 'lucide-react';
import { createBuilding } from '../../api/api';
import { CreateBuildingPayload } from '../../types';
import './UploadForm.css';

interface Preset {
  id: string;
  name: string;
  parcel_id: string;
  aerial_image_url: string;
  height_meters: number;
  floor_count: number;
  coords: string;
}

const PRESETS: Preset[] = [
  {
    id: "preset-piet-academic",
    name: "PIET Main Academic Block (Panipat)",
    parcel_id: "PARCEL_PIET_ACADEMIC_01",
    aerial_image_url: "https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=800",
    height_meters: 18.0,
    floor_count: 5,
    coords: "[[76.9938, 29.2382], [76.9948, 29.2382], [76.9948, 29.2390], [76.9938, 29.2390]]"
  },
  {
    id: "preset-piet-engineering",
    name: "PIET Engineering & AI Hub",
    parcel_id: "PARCEL_PIET_ENGG_02",
    aerial_image_url: "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?q=80&w=800",
    height_meters: 22.0,
    floor_count: 6,
    coords: "[[76.9949, 29.2385], [76.9959, 29.2385], [76.9959, 29.2394], [76.9949, 29.2394]]"
  },
  {
    id: "preset-piet-audi",
    name: "PIET Innovation & Auditorium",
    parcel_id: "PARCEL_PIET_AUDI_03",
    aerial_image_url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=800",
    height_meters: 15.0,
    floor_count: 3,
    coords: "[[76.9932, 29.2375], [76.9942, 29.2375], [76.9942, 29.2381], [76.9932, 29.2381]]"
  },
  {
    id: "preset-piet-hostel",
    name: "PIET Campus Student Residency",
    parcel_id: "PARCEL_PIET_HOSTEL_04",
    aerial_image_url: "https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=800",
    height_meters: 28.0,
    floor_count: 8,
    coords: "[[76.9952, 29.2395], [76.9962, 29.2395], [76.9962, 29.2403], [76.9952, 29.2403]]"
  }
];

export default function UploadForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    parcel_id: PRESETS[0].parcel_id,
    aerial_image_url: PRESETS[0].aerial_image_url,
    height_meters: PRESETS[0].height_meters,
    floor_count: PRESETS[0].floor_count,
    coords_json: PRESETS[0].coords
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const applyPreset = (preset: Preset) => {
    setFormData({
      parcel_id: preset.parcel_id,
      aerial_image_url: preset.aerial_image_url,
      height_meters: preset.height_meters,
      floor_count: preset.floor_count,
      coords_json: preset.coords
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let parsedCoords: number[][];
      try {
        parsedCoords = JSON.parse(formData.coords_json);
      } catch {
        parsedCoords = [[78.0416, 27.1746], [78.0426, 27.1746], [78.0426, 27.1756], [78.0416, 27.1746]];
      }

      const payload: CreateBuildingPayload = {
        parcel_id: formData.parcel_id,
        aerial_image_url: formData.aerial_image_url,
        height_meters: Number(formData.height_meters),
        floor_count: Number(formData.floor_count),
        parcel_boundary: {
          type: 'Polygon',
          coordinates: [parsedCoords]
        }
      };

      const res = await createBuilding(payload);
      navigate(`/processing/${res.job_id || 'job-001'}`);
    } catch (err: any) {
      setError(err.message || 'Failed to submit building. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-form-card glass-panel fade-in">
      <div className="form-header">
        <div className="header-icon-box">
          <Sparkles size={22} />
        </div>
        <div>
          <h2 className="form-title font-display">Submit Building for 3D ULPIN Generation</h2>
          <p className="form-subtitle">
            Convert 2D aerial imagery and cadastral plot records into a 3D Volumetric deck.gl + MapLibre model.
          </p>
        </div>
      </div>

      {/* Preset Quick Selectors */}
      <div className="presets-section">
        <span className="presets-label">Load Pilot Demonstration Preset:</span>
        <div className="presets-row">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`preset-pill ${formData.parcel_id === preset.parcel_id ? 'active' : ''}`}
              onClick={() => applyPreset(preset)}
            >
              <MapPin size={14} />
              <span>{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="form-error-banner">{error}</div>}

      <form onSubmit={handleSubmit} className="actual-form">
        <div className="form-grid">
          {/* Parcel ID */}
          <div className="form-group">
            <label htmlFor="parcel_id">
              <Building2 size={15} /> Parcel ID
            </label>
            <input
              id="parcel_id"
              name="parcel_id"
              type="text"
              placeholder="e.g. PARCEL_777_TAJMAHAL_AGRA"
              value={formData.parcel_id}
              onChange={handleChange}
              required
            />
          </div>

          {/* Aerial Image URL */}
          <div className="form-group">
            <label htmlFor="aerial_image_url">
              <Image size={15} /> Aerial Satellite Image URL
            </label>
            <input
              id="aerial_image_url"
              name="aerial_image_url"
              type="url"
              placeholder="https://storage.example.com/aerial.jpg"
              value={formData.aerial_image_url}
              onChange={handleChange}
              required
            />
          </div>

          {/* Height */}
          <div className="form-group">
            <label htmlFor="height_meters">Building Height (Meters)</label>
            <input
              id="height_meters"
              name="height_meters"
              type="number"
              step="0.5"
              min="3"
              max="500"
              placeholder="e.g. 73.0"
              value={formData.height_meters}
              onChange={handleChange}
              required
            />
          </div>

          {/* Floor Count */}
          <div className="form-group">
            <label htmlFor="floor_count">
              <Layers size={15} /> Total Floors
            </label>
            <input
              id="floor_count"
              name="floor_count"
              type="number"
              min="1"
              max="150"
              placeholder="e.g. 6"
              value={formData.floor_count}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        {/* Boundary GeoJSON Coordinates */}
        <div className="form-group full-width">
          <label htmlFor="coords_json">Parcel Boundary Coordinates (GeoJSON Ring)</label>
          <input
            id="coords_json"
            name="coords_json"
            type="text"
            className="font-mono"
            value={formData.coords_json}
            onChange={handleChange}
            required
          />
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          className="btn-primary submit-building-button"
          disabled={loading}
          id="submit-building-btn"
        >
          <span>{loading ? 'Processing deck.gl Pipeline...' : '🚀 Generate 3D ULPIN Model'}</span>
          <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
}
