import React from 'react';
import { Cpu, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import './ProgressBar.css';

interface ProgressBarProps {
  progress: number;
  stepText: string;
  status: string;
  error?: string | null;
}

export default function ProgressBar({ progress, stepText, status, error }: ProgressBarProps) {
  const steps = [
    { title: "Footprint Detection", threshold: 25 },
    { title: "deck.gl Extrusion", threshold: 50 },
    { title: "Volumetric Division", threshold: 75 },
    { title: "ULPIN Hash Generation", threshold: 100 },
  ];

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
                ? 'Processing Failed'
                : progress >= 100
                ? '3D ULPIN Cadastral Ready'
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

      {/* Pipeline Milestone Steps */}
      <div className="pipeline-steps-grid">
        {steps.map((s, idx) => {
          const isDone = progress >= s.threshold;
          const isCurrent = progress < s.threshold && (idx === 0 || progress >= steps[idx - 1].threshold);

          return (
            <div
              key={idx}
              className={`step-item ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}
            >
              <div className="step-indicator">
                {isDone ? (
                  <CheckCircle2 size={16} />
                ) : isCurrent ? (
                  <Loader2 size={16} className="spinner" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span className="step-name">{s.title}</span>
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
