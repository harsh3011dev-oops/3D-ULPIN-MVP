import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '../components/Header/Header';
import { createBuilding } from '../api/api';
import {
  MapPin, Layers, ArrowRight, ArrowLeft,
  Building2, Satellite, Ruler, CheckCircle, Loader2, ChevronRight
} from 'lucide-react';
import './ExplorePage.css';

/* ── Types ── */
interface FormState {
  buildingName: string;
  location: string;
  latitude: string;
  longitude: string;
  height: string;
  floors: string;
}

const STEPS = [
  { id: 1, label: 'Location',  icon: MapPin },
  { id: 2, label: 'Satellite', icon: Satellite },
  { id: 3, label: 'Dimensions',icon: Ruler },
  { id: 4, label: 'Generate',  icon: CheckCircle },
];

const slide = {
  enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { duration: 0.35, ease: 'easeOut' as const } },
  exit:   (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0, transition: { duration: 0.25 } }),
};

export default function ExplorePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<FormState>({
    buildingName: '',
    location: '',
    latitude: '',
    longitude: '',
    height: '',
    floors: '',
  });

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setForm(f => ({ ...f, [key]: e.target.value }));
  };

  /* satellite preview URL (OpenStreetMap static tile via a proxy-free approach) */
  const satUrl = form.latitude && form.longitude
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${form.latitude},${form.longitude}&zoom=18&size=600x300&maptype=satellite`
    : null;

  // Use openstreetmap tile as fallback (no key needed)
  const osmPreviewUrl = form.latitude && form.longitude
    ? `https://staticmap.openstreetmap.de/staticmap.php?center=${form.latitude},${form.longitude}&zoom=17&size=600x280&markers=${form.latitude},${form.longitude},red`
    : null;

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const validateStep = (): boolean => {
    if (step === 1) {
      if (!form.buildingName.trim()) { setError('Please enter the building name.'); return false; }
      if (!form.location.trim())     { setError('Please enter the location / address.'); return false; }
    }
    if (step === 2) {
      const lat = parseFloat(form.latitude);
      const lon = parseFloat(form.longitude);
      if (!form.latitude || isNaN(lat) || lat < -90  || lat > 90)  { setError('Enter a valid latitude (–90 to 90).'); return false; }
      if (!form.longitude || isNaN(lon) || lon < -180 || lon > 180) { setError('Enter a valid longitude (–180 to 180).'); return false; }
    }
    if (step === 3) {
      const h = parseFloat(form.height);
      const f = parseInt(form.floors);
      if (!form.height || isNaN(h) || h <= 0)   { setError('Enter a valid height in metres (e.g. 18).'); return false; }
      if (!form.floors || isNaN(f) || f < 1)    { setError('Enter at least 1 floor.'); return false; }
    }
    setError('');
    return true;
  };

  const next = () => { if (validateStep()) go(step + 1); };
  const back = () => go(step - 1);

  const handleGenerate = async () => {
    if (!validateStep()) return;
    setLoading(true);
    try {
      const parcelId = `PARCEL_${form.buildingName.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 18)}_${Date.now().toString(36).toUpperCase()}`;
      const res = await createBuilding({
        parcel_id: parcelId,
        address: `${form.buildingName}, ${form.location}`,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        height_meters: parseFloat(form.height),
        floor_count: parseInt(form.floors),
      });
      navigate(`/processing/${res.job_id || 'job-001'}`);
    } catch (err: any) {
      setError('Could not start processing. Check if the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="explore-page">
      <Header />

      <main className="explore-container">
        {/* ── Card ── */}
        <motion.div
          className="exp-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Progress bar */}
          <div className="exp-progress-track">
            <motion.div
              className="exp-progress-fill"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
            />
          </div>

          {/* Step indicators */}
          <div className="exp-steps">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const done = step > s.id;
              const active = step === s.id;
              return (
                <div key={s.id} className={`exp-step ${active ? 'active' : ''} ${done ? 'done' : ''}`}>
                  <div className="exp-step-circle">
                    {done ? <CheckCircle size={14} /> : <Icon size={14} />}
                  </div>
                  <span className="exp-step-label">{s.label}</span>
                </div>
              );
            })}
          </div>

          {/* ── Step Content ── */}
          <div className="exp-body">
            <AnimatePresence mode="wait" custom={dir}>
              {/* STEP 1 — Location */}
              {step === 1 && (
                <motion.div key="s1" custom={dir} variants={slide} initial="enter" animate="center" exit="exit">
                  <div className="exp-step-header">
                    <div className="exp-step-icon-box"><MapPin size={22} /></div>
                    <h2 className="exp-step-title">Building Identity</h2>
                    <p className="exp-step-desc">Enter the name and address of the building you want to digitize into a 3D cadastral record.</p>
                  </div>

                  <div className="exp-field">
                    <label className="exp-label">Building / Structure Name</label>
                    <input
                      id="building-name"
                      className="exp-input"
                      type="text"
                      placeholder="e.g. Panipat Institute of Engineering and Technology"
                      value={form.buildingName}
                      onChange={set('buildingName')}
                      autoFocus
                    />
                  </div>
                  <div className="exp-field">
                    <label className="exp-label">Location / Address</label>
                    <input
                      id="building-location"
                      className="exp-input"
                      type="text"
                      placeholder="e.g. GT Road, Samalkha, Panipat, Haryana"
                      value={form.location}
                      onChange={set('location')}
                    />
                  </div>
                </motion.div>
              )}

              {/* STEP 2 — GPS + Satellite */}
              {step === 2 && (
                <motion.div key="s2" custom={dir} variants={slide} initial="enter" animate="center" exit="exit">
                  <div className="exp-step-header">
                    <div className="exp-step-icon-box"><Satellite size={22} /></div>
                    <h2 className="exp-step-title">GPS Coordinates</h2>
                    <p className="exp-step-desc">Enter the precise latitude and longitude of the building. A satellite preview will appear below.</p>
                  </div>

                  <div className="exp-row">
                    <div className="exp-field">
                      <label className="exp-label">Latitude</label>
                      <input
                        id="lat-input"
                        className="exp-input"
                        type="number"
                        step="0.0001"
                        placeholder="e.g. 29.2386"
                        value={form.latitude}
                        onChange={set('latitude')}
                        autoFocus
                      />
                    </div>
                    <div className="exp-field">
                      <label className="exp-label">Longitude</label>
                      <input
                        id="lon-input"
                        className="exp-input"
                        type="number"
                        step="0.0001"
                        placeholder="e.g. 76.9943"
                        value={form.longitude}
                        onChange={set('longitude')}
                      />
                    </div>
                  </div>

                  {/* Satellite image preview */}
                  <AnimatePresence>
                    {form.latitude && form.longitude && !isNaN(parseFloat(form.latitude)) && !isNaN(parseFloat(form.longitude)) && (
                      <motion.div
                        className="exp-sat-preview"
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        <div className="exp-sat-badge"><Satellite size={11} /> Live Satellite Preview</div>
                        <iframe
                          title="satellite-preview"
                          className="exp-sat-frame"
                          src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(form.longitude)-0.003},${parseFloat(form.latitude)-0.002},${parseFloat(form.longitude)+0.003},${parseFloat(form.latitude)+0.002}&layer=hot&marker=${form.latitude},${form.longitude}`}
                          loading="lazy"
                        />
                        <p className="exp-sat-caption">
                          📍 {parseFloat(form.latitude).toFixed(4)}°N, {parseFloat(form.longitude).toFixed(4)}°E — {form.buildingName}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* STEP 3 — Dimensions */}
              {step === 3 && (
                <motion.div key="s3" custom={dir} variants={slide} initial="enter" animate="center" exit="exit">
                  <div className="exp-step-header">
                    <div className="exp-step-icon-box"><Ruler size={22} /></div>
                    <h2 className="exp-step-title">Building Dimensions</h2>
                    <p className="exp-step-desc">Provide the structural dimensions so the AI can construct an accurate 3D extrusion.</p>
                  </div>

                  <div className="exp-row">
                    <div className="exp-field">
                      <label className="exp-label">Building Height (metres)</label>
                      <input
                        id="height-input"
                        className="exp-input"
                        type="number"
                        min="1"
                        step="0.5"
                        placeholder="e.g. 18"
                        value={form.height}
                        onChange={set('height')}
                        autoFocus
                      />
                    </div>
                    <div className="exp-field">
                      <label className="exp-label">Number of Floors</label>
                      <input
                        id="floors-input"
                        className="exp-input"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="e.g. 5"
                        value={form.floors}
                        onChange={set('floors')}
                      />
                    </div>
                  </div>

                  {/* Summary card */}
                  {form.height && form.floors && (
                    <motion.div
                      className="exp-summary"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div className="exp-summary-row"><Building2 size={14} /><span><b>{form.buildingName}</b></span></div>
                      <div className="exp-summary-row"><MapPin size={14} /><span>{form.location}</span></div>
                      <div className="exp-summary-row"><Layers size={14} /><span>{form.floors} floors · {form.height}m · {parseFloat(form.latitude).toFixed(4)}°N, {parseFloat(form.longitude).toFixed(4)}°E</span></div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* STEP 4 — Generate */}
              {step === 4 && (
                <motion.div key="s4" custom={dir} variants={slide} initial="enter" animate="center" exit="exit">
                  <div className="exp-step-header">
                    <div className="exp-step-icon-box ready"><CheckCircle size={22} /></div>
                    <h2 className="exp-step-title">Ready to Generate</h2>
                    <p className="exp-step-desc">The AI pipeline will extract the satellite footprint, assign 3D ULPIN codes to every unit, and render the model.</p>
                  </div>

                  <div className="exp-confirm-card">
                    <div className="exp-confirm-row">
                      <span className="exp-confirm-key">Building</span>
                      <span className="exp-confirm-val">{form.buildingName}</span>
                    </div>
                    <div className="exp-confirm-row">
                      <span className="exp-confirm-key">Address</span>
                      <span className="exp-confirm-val">{form.location}</span>
                    </div>
                    <div className="exp-confirm-row">
                      <span className="exp-confirm-key">Coordinates</span>
                      <span className="exp-confirm-val">{parseFloat(form.latitude).toFixed(5)}°N, {parseFloat(form.longitude).toFixed(5)}°E</span>
                    </div>
                    <div className="exp-confirm-row">
                      <span className="exp-confirm-key">Height</span>
                      <span className="exp-confirm-val">{form.height} m</span>
                    </div>
                    <div className="exp-confirm-row">
                      <span className="exp-confirm-key">Floors</span>
                      <span className="exp-confirm-val">{form.floors} floors</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Error */}
          {error && (
            <motion.p className="exp-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              ⚠ {error}
            </motion.p>
          )}

          {/* Navigation buttons */}
          <div className="exp-nav">
            {step > 1 && (
              <button className="exp-btn-back" onClick={back} disabled={loading}>
                <ArrowLeft size={16} /> Back
              </button>
            )}
            {step < 4 && (
              <button className="exp-btn-next" onClick={next}>
                Continue <ChevronRight size={16} />
              </button>
            )}
            {step === 4 && (
              <button className="exp-btn-generate" onClick={handleGenerate} disabled={loading}>
                {loading
                  ? <><Loader2 size={16} className="spin" /> Initialising AI Pipeline…</>
                  : <><ArrowRight size={16} /> Generate 3D ULPIN Model</>
                }
              </button>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
