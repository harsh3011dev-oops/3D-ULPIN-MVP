/**
 * ThreeJSErrorBoundary.tsx
 * React Error Boundary around Three.js 3D Studio
 * 
 * Prevents unhandled WebGL / Three.js runtime exceptions from crashing or blanking the page.
 * Displays a clean fallback state while preserving the rest of the application layout.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export default class ThreeJSErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unknown Three.js rendering exception',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ThreeJSErrorBoundary caught an unhandled rendering error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          minHeight: 400,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#090d16',
          color: '#e2e8f0',
          padding: 24,
          textAlign: 'center',
          boxSizing: 'border-box',
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            border: '1px solid rgba(239, 68, 68, 0.3)',
          }}>
            <AlertTriangle size={24} />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 8, color: '#f8fafc' }}>
            3D Studio Reconstruction Recovered
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: 460, marginBottom: 20, lineHeight: 1.5 }}>
            {this.props.fallbackMessage || 'A procedural geometry rendering issue was intercepted. Safe fallback geometry is active.'}
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 6,
              background: '#0d9488',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.82rem',
              boxShadow: '0 2px 8px rgba(13, 148, 136, 0.3)',
            }}
          >
            <RotateCcw size={14} />
            <span>Reload 3D Model</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
