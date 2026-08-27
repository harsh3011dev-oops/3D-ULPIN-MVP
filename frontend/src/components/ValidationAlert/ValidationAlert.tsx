import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { SpatialValidation } from '../../types';
import './ValidationAlert.css';

interface ValidationAlertProps {
  validation?: SpatialValidation | null;
}

export default function ValidationAlert({ validation }: ValidationAlertProps) {
  const [expanded, setExpanded] = useState(false);

  if (!validation) return null;

  if (validation.valid) {
    return (
      <div className="validation-alert valid glass-panel" id="validation-status">
        <div className="validation-badge-icon green">
          <ShieldCheck size={20} />
        </div>
        <div className="validation-text-content">
          <span className="validation-title green-text">Spatial Validation Passed</span>
          <span className="validation-desc">Zero 3D volumetric overlaps detected across all property units.</span>
        </div>
      </div>
    );
  }

  const issueCount = (validation.overlapping_units?.length || 0) + (validation.out_of_bounds?.length || 0) + (validation.errors?.length || 0);

  return (
    <div className="validation-alert invalid glass-panel" id="validation-status">
      <div
        className="validation-alert-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
      >
        <div className="header-left">
          <div className="validation-badge-icon red">
            <ShieldAlert size={20} />
          </div>
          <div>
            <span className="validation-title red-text">
              Spatial Validation Failed ({issueCount} Issues)
            </span>
            <span className="validation-desc">Click to inspect 3D volumetric collision errors</span>
          </div>
        </div>
        <button className="toggle-btn" aria-label="Toggle details">
          {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {expanded && (
        <div className="validation-details-body" id="validation-errors-list">
          {validation.overlapping_units && validation.overlapping_units.length > 0 && (
            <div className="error-category">
              <h4 className="category-title">
                <AlertTriangle size={14} className="text-amber" />
                Volumetric Overlaps Detected
              </h4>
              {validation.overlapping_units.map(([u1, u2], i) => (
                <div key={i} className="error-item-pill">
                  <code>{u1}</code> ↔ <code>{u2}</code>
                </div>
              ))}
            </div>
          )}

          {validation.out_of_bounds && validation.out_of_bounds.length > 0 && (
            <div className="error-category">
              <h4 className="category-title">
                <AlertTriangle size={14} className="text-red" />
                Plot Boundary Violations
              </h4>
              {validation.out_of_bounds.map((uId, i) => (
                <div key={i} className="error-item-pill">
                  Unit <code>{uId}</code> extends beyond parcel footprint
                </div>
              ))}
            </div>
          )}

          {validation.errors && validation.errors.length > 0 && (
            <div className="error-category">
              <h4 className="category-title">Audit Logs</h4>
              {validation.errors.map((err, i) => (
                <p key={i} className="error-log-line">• {err}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
