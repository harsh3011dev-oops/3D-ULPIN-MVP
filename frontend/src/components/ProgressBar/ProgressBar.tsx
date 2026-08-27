import React from 'react';
import { Cpu, CheckCircle2, Loader2, AlertCircle, ScanSearch, Box, Scissors, Hash, ShieldCheck, LayoutGrid } from 'lucide-react';
import './ProgressBar.css';

interface ProgressBarProps {
  progress: number;
  stepText: string;
  status: string;
  error?: string | null;
}

// Exact 6-step pipeline from AI Blueprint pipeline.py
const PIPELINE_STEPS = [
  { title: "Footprint Detection",   desc: "OpenCV contour + Canny edge detection",  icon: ScanSearch,  threshold: 17 },
  { title: "3D Extrusion",          desc: "Shapely 2D → Building3D with z_min/z_max", icon: Box,         threshold: 34 },
  { title: "Floor Division",        desc: "Horizontal slicing into floor slabs",       icon: Scissors,    threshold: 51 },
  { title: "Unit Subdivision",      desc: "Grid-based cadastral unit partitioning",    icon: LayoutGrid,  threshold: 68 },
  { title: "ULPIN Generation",      desc: "Geohash-based unique 3D spatial IDs",      icon: Hash,        threshold: 85 },
  { title: "Spatial Validation",    desc: "Overlap & boundary constraint checks",      icon: ShieldCheck, threshold: 100 },
];

export default function ProgressBar({ progress, stepText, status, error }: ProgressBarProps) {
  return (
    <div className="progress-bar-card glass-panel fade-in">
      <div className="progress-header">
        <div className="progress-title-section">
          <div className={`progress-icon-badge ${status === 'failed' ? 'error' : ''}`}>
            {status === 'failed' ? (
              <AlertCircle size={24} className="text-red" />
            ) : progress >= 100 ? (
              <CheckCircle2 size={24} className="text-green" />
            ) : (
              <Cpu size={24} className="icon-spin" />
            )}
          </div>
          <div>
            <h3 className="progress-title">
              {status === 'failed'
                ? 'AI Pipeline Failed'
                : progress >= 100
                ? '3D ULPIN Cadastral Model Ready ✓'
                : 'AI Volumetric Extraction Pipeline'}
            </h3>
            <p className="progress-subtitle">{stepText}</p>
          </div>
        </div>

        <div className="progress-percentage-badge">
          <span>{progress}%</span>
        </div>
      </div>

      {/* Progress Track */}
      <div className="progress-track-outer">
        <div
          className={`progress-track-inner ${status === 'failed' ? 'failed' : ''}`}
          style={{ width: `${progress}%` }}
        >
          <div className="progress-glow"></div>
        </div>
      </div>

      {/* 6-Step AI Pipeline Milestones */}
      <div className="pipeline-steps-grid-6">
        {PIPELINE_STEPS.map((s, idx) => {
          const isDone = progress >= s.threshold;
          const prevThreshold = idx === 0 ? 0 : PIPELINE_STEPS[idx - 1].threshold;
          const isCurrent = !isDone && progress >= prevThreshold;
          const StepIcon = s.icon;

          return (
            <div
              key={idx}
              className={`step-item-6 ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
              title={s.desc}
            >
              <div className="step-indicator-6">
                {isDone ? (
                  <CheckCircle2 size={15} />
                ) : isCurrent ? (
                  <Loader2 size={15} className="spinner" />
                ) : (
                  <StepIcon size={15} />
                )}
              </div>
              <div className="step-text-6">
                <span className="step-name-6">{s.title}</span>
                <span className="step-desc-6">{s.desc}</span>
              </div>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="progress-error-message">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
