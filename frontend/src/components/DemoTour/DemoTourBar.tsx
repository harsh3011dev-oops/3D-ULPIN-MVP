import React, { useState } from 'react';
import {
  Play, ChevronRight, ChevronLeft, Award, CheckCircle2,
  Layers, ArrowDownToLine, FileText, Eye, X, Sparkles
} from 'lucide-react';
import './DemoTourBar.css';

interface DemoTourBarProps {
  onStepChange: (stepId: number) => void;
  onOpenCertificate: () => void;
  currentFloor: number | null;
  totalFloors: number;
}

export interface DemoStep {
  id: number;
  title: string;
  badge: string;
  icon: React.ReactNode;
  narrative: string;
  keyMetric: string;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    id: 1,
    title: 'Surface & Multi-Storey Cadastre',
    badge: 'STAGE 1: 3D VOLUME',
    icon: <Layers size={14} />,
    narrative: 'Conventional 2D maps only see the land footprint. Our system extracts building height, floor count, and constructs volumetric 3D bounds for modern vertical properties.',
    keyMetric: 'Multi-Sensor Fusion (OSM + Gemini Vision + LiDAR)',
  },
  {
    id: 2,
    title: 'Vertical Apartment Parcel Delineation',
    badge: 'STAGE 2: AIR-RIGHTS',
    icon: <Eye size={14} />,
    narrative: 'Individual apartments are isolated in 3D space with dedicated Z-min/Z-max boundaries, eliminating ownership disputes between floor owners and land owners.',
    keyMetric: 'Unit 3D ULPIN: ...-F04-U402 (ISO 19152 LADM)',
  },
  {
    id: 3,
    title: 'Subsurface & Utility Conflict Avoidance',
    badge: 'STAGE 3: UNDERGROUND',
    icon: <ArrowDownToLine size={14} />,
    narrative: 'Deep basements (B1–B4), metro tunnels, and underground utility pipes (gas, power, water) are mapped to prevent excavation damage during city infrastructure works.',
    keyMetric: 'Zero Utility Collisions • -25m Depth Cadastre',
  },
  {
    id: 4,
    title: 'Government 3D Land Title Certificate',
    badge: 'STAGE 4: TITLE DEED',
    icon: <FileText size={14} />,
    narrative: 'A standardized, digitally signed 3D Land Title Deed with QR authentication and exact volumetric spatial extents (m³) ready for legal registration and property taxation.',
    keyMetric: 'Bhu-Aadhaar 3D Deed with Cryptographic QR',
  },
];

export default function DemoTourBar({
  onStepChange,
  onOpenCertificate,
  totalFloors,
}: DemoTourBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const currentStep = DEMO_STEPS[activeStepIndex];

  const handleSelectStep = (index: number) => {
    setActiveStepIndex(index);
    onStepChange(DEMO_STEPS[index].id);
    if (DEMO_STEPS[index].id === 4) {
      onOpenCertificate();
    }
  };

  const handleNext = () => {
    if (activeStepIndex < DEMO_STEPS.length - 1) {
      handleSelectStep(activeStepIndex + 1);
    }
  };

  const handlePrev = () => {
    if (activeStepIndex > 0) {
      handleSelectStep(activeStepIndex - 1);
    }
  };

  if (!isOpen) {
    return (
      <div className="demo-tour-collapsed">
        <button
          type="button"
          className="demo-tour-launch-btn"
          onClick={() => {
            setIsOpen(true);
            handleSelectStep(0);
          }}
          title="Launch Interactive Judge Presentation Walkthrough"
        >
          <Award size={15} className="text-amber-400" />
          <span className="font-semibold">Launch SIH Live Demo Tour</span>
          <span className="demo-badge">4 Steps</span>
        </button>
      </div>
    );
  }

  return (
    <div className="demo-tour-banner">
      <div className="demo-tour-content">
        
        {/* Step Indicator Header */}
        <div className="demo-tour-header">
          <div className="demo-title-cluster">
            <div className="demo-trophy-icon">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="demo-super-badge">{currentStep.badge}</div>
              <h4 className="demo-step-title">{currentStep.title}</h4>
            </div>
          </div>

          <div className="demo-step-pills">
            {DEMO_STEPS.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                className={`step-pill ${idx === activeStepIndex ? 'active' : ''} ${idx < activeStepIndex ? 'completed' : ''}`}
                onClick={() => handleSelectStep(idx)}
              >
                <span className="pill-num">{s.id}</span>
                <span className="pill-name">{s.title.split(' ')[0]}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="demo-close-btn"
            onClick={() => setIsOpen(false)}
            aria-label="Close Demo Guide"
          >
            <X size={16} />
          </button>
        </div>

        {/* Narrative & Pitch Note */}
        <div className="demo-narrative-row">
          <p className="demo-script-text">
            <strong>What to tell judges:</strong> "{currentStep.narrative}"
          </p>
          <div className="demo-metric-tag font-mono">
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>{currentStep.keyMetric}</span>
          </div>
        </div>

        {/* Actions Row */}
        <div className="demo-action-footer">
          <div className="demo-step-counter font-mono">
            STEP {activeStepIndex + 1} OF {DEMO_STEPS.length}
          </div>

          <div className="demo-nav-btns">
            <button
              type="button"
              className="demo-nav-btn secondary"
              disabled={activeStepIndex === 0}
              onClick={handlePrev}
            >
              <ChevronLeft size={14} />
              <span>Back</span>
            </button>

            {activeStepIndex === 3 ? (
              <button
                type="button"
                className="demo-nav-btn primary"
                onClick={onOpenCertificate}
              >
                <FileText size={14} />
                <span>View 3D Title Deed</span>
              </button>
            ) : (
              <button
                type="button"
                className="demo-nav-btn primary"
                onClick={handleNext}
              >
                <span>Next Stage</span>
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
