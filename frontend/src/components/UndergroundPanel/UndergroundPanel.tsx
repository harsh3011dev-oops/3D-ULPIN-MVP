import React, { useState } from 'react';
import { Building2, Layers, Zap, Droplets, Radio, Flame, Car, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { UndergroundData } from '../../types';
import './UndergroundPanel.css';

interface Props {
  data: UndergroundData;
  buildingName?: string;
}

const LEVEL_COLORS: Record<string, string> = {
  basement: '#6366f1',
  parking: '#f59e0b',
  utility: '#06b6d4',
  metro: '#ec4899',
  museum: '#8b5cf6',
  mixed: '#10b981',
};

const UTIL_COLORS: Record<string, string> = {
  water: '#06b6d4', sewage: '#92400e', power: '#f59e0b',
  telecom: '#6366f1', gas: '#ef4444',
};

function LevelIcon({ type }: { type: string }) {
  if (type === 'parking') return <Car size={12} />;
  if (type === 'metro') return <Radio size={12} />;
  if (type === 'museum') return <Building2 size={12} />;
  return <Layers size={12} />;
}

function UtilIcon({ type }: { type: string }) {
  if (type === 'water' || type === 'sewage') return <Droplets size={11} />;
  if (type === 'power') return <Zap size={11} />;
  if (type === 'telecom') return <Radio size={11} />;
  if (type === 'gas') return <Flame size={11} />;
  return <Zap size={11} />;
}

export default function UndergroundPanel({ data, buildingName }: Props) {
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  const [showUtilities, setShowUtilities] = useState(false);

  const levels = data.ulpin_details?.filter(u => u.level < 0) || [];
  const utilities = data.utilities || [];

  return (
    <div className="underground-panel">
      <div className="ug-header">
        <div className="ug-header-icon"><Layers size={13} /></div>
        <div>
          <div className="ug-title">Underground Infrastructure</div>
          <div className="ug-subtitle">Subsurface Volumetric Cadastre</div>
        </div>
        <div className="ug-badge">{data.underground_ulpins} ULPINs</div>
      </div>

      <div className="ug-stats-row">
        <div className="ug-stat">
          <div className="ug-stat-value">{data.basement_levels}</div>
          <div className="ug-stat-label">B. Levels</div>
        </div>
        <div className="ug-stat">
          <div className="ug-stat-value">{data.parking_spaces}</div>
          <div className="ug-stat-label">Parking</div>
        </div>
        <div className="ug-stat">
          <div className="ug-stat-value">{data.max_depth_m?.toFixed(0)}m</div>
          <div className="ug-stat-label">Max Depth</div>
        </div>
        <div className="ug-stat">
          <div className="ug-stat-value">{((data.total_volume_m3 || 0) / 1000).toFixed(1)}k</div>
          <div className="ug-stat-label">Vol m³</div>
        </div>
      </div>

      <div className="ug-validation-row">
        <div className="ug-validation-dot" style={{ background: data.validation_score > 70 ? '#10b981' : '#f59e0b' }} />
        <span className="ug-validation-label">Subsurface Validation</span>
        <span className="ug-validation-score" style={{ color: data.validation_score > 70 ? '#10b981' : '#f59e0b' }}>
          {data.validation_score?.toFixed(0)}%
        </span>
      </div>

      <div className="ug-section-title">BASEMENT LEVELS</div>
      <div className="ug-levels-list">
        {levels.length === 0 ? (
          <div className="ug-empty">No underground levels detected</div>
        ) : levels.map((level) => {
          const color = LEVEL_COLORS[level.type] || '#6366f1';
          const isExpanded = expandedLevel === level.ulpin;
          return (
            <div key={level.ulpin} className="ug-level-card" style={{ borderLeft: `3px solid ${color}` }}>
              <button className="ug-level-header" onClick={() => setExpandedLevel(isExpanded ? null : level.ulpin)}>
                <div className="ug-level-icon" style={{ background: `${color}22`, color }}>
                  <LevelIcon type={level.type} />
                </div>
                <div className="ug-level-info">
                  <div className="ug-level-name">{level.title || level.subsurface_zone || `Level B${Math.abs(level.level)}`}</div>
                  <div className="ug-level-depth" style={{ color }}>
                    -{level.depth_range[0].toFixed(1)}m → -{level.depth_range[1].toFixed(1)}m
                  </div>
                </div>
                <div className="ug-level-chevron">
                  {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                </div>
              </button>
              {isExpanded && (
                <div className="ug-level-expanded">
                  <div className="ug-ulpin-box">
                    <div className="ug-ulpin-label">3D ULPIN</div>
                    <div className="ug-ulpin-code">{level.ulpin}</div>
                  </div>
                  <div className="ug-level-metrics">
                    <div className="ug-metric">
                      <span className="ug-metric-label">Type</span>
                      <span className="ug-metric-value" style={{ textTransform: 'capitalize', color }}>{level.type}</span>
                    </div>
                    <div className="ug-metric">
                      <span className="ug-metric-label">Volume</span>
                      <span className="ug-metric-value">{level.volume_m3?.toFixed(0)} m³</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {utilities.length > 0 && (
        <>
          <button className="ug-section-toggle" onClick={() => setShowUtilities(!showUtilities)}>
            <div className="ug-section-title" style={{ margin: 0 }}>UTILITY NETWORKS ({utilities.length})</div>
            {showUtilities ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
          {showUtilities && (
            <div className="ug-utilities-list">
              {utilities.map((util, idx) => {
                const color = UTIL_COLORS[util.type] || '#94a3b8';
                return (
                  <div key={idx} className="ug-utility-row" style={{ borderLeft: `3px solid ${color}` }}>
                    <div className="ug-utility-icon" style={{ color }}><UtilIcon type={util.type} /></div>
                    <div className="ug-utility-info">
                      <div className="ug-utility-name">
                        {util.title || `${util.type.charAt(0).toUpperCase() + util.type.slice(1)} Line`}
                      </div>
                      <div className="ug-utility-meta">
                        Depth: {util.depth_m}m · ⌀{util.diameter_mm}mm
                        {util.conflicts > 0 && (
                          <span className="ug-utility-conflict">
                            <AlertTriangle size={9} /> {util.conflicts} conflicts
                          </span>
                        )}
                      </div>
                    </div>
                    {util.ulpin && (
                      <div className="ug-utility-ulpin">{util.ulpin.split('-').slice(-2).join('-')}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
