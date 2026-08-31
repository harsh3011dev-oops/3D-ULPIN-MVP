import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../components/Header/Header';
import ProgressBar from '../components/ProgressBar/ProgressBar';
import { getJobStatus } from '../api/api';
import { CheckCircle2, XCircle, Terminal, Box, Info, Cpu, Layers, Tag } from 'lucide-react';
import './ProcessingPage.css';

interface LogLine {
  time: string;
  level: string;
  msg: string;
  type?: string;
}

const DEFAULT_LOGS: LogLine[] = [
  { time: '10:42:01', level: 'SYS', msg: 'Initializing 3D ULPIN AI pipeline worker...', type: 'sys' },
  { time: '10:42:01', level: 'SYS', msg: 'Loading Shapely & MapLibre geometry drivers... OK', type: 'sys' },
  { time: '10:42:02', level: 'GEO', msg: 'Bounding Polygon loaded: 4 vertices verified', type: 'geo' },
  { time: '10:42:02', level: 'AI',  msg: 'Footprint contour detection confidence: 0.985', type: 'ai' },
  { time: '10:42:03', level: 'GEO', msg: 'Calculating Z-min/Z-max spatial extrusion limits...', type: 'geo' },
  { time: '10:42:04', level: 'GEO', msg: 'Building3D volumetric extrude: volume_m3 calculated', type: 'geo' },
  { time: '10:42:05', level: 'SYS', msg: 'Floor slicing completed across target elevation strata', type: 'sys' },
];

const INFO_ITEMS = [
  { icon: Cpu,    text: 'AI pipeline runs in background — safe to leave this page.' },
  { icon: Layers, text: 'Topology extrusion across all floor strata in progress.' },
  { icon: Tag,    text: 'ISO 19152 ULPIN hashes minted post-validation.' },
];

export default function ProcessingPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const [progress, setProgress]   = useState(0);
  const [stepText, setStepText]   = useState('Initializing AI Pipeline...');
  const [status, setStatus]       = useState<'pending' | 'processing' | 'done' | 'failed'>('processing');
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [logs, setLogs]           = useState<LogLine[]>(DEFAULT_LOGS);

  useEffect(() => {
    if (!jobId) return;
    let isMounted = true;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;

    const interval = setInterval(async () => {
      try {
        const data = await getJobStatus(jobId);
        if (!isMounted) return;
        setProgress(data.progress_pct);
        setStepText(data.step || 'Processing...');

        if (data.step) {
          const timeStr = new Date().toLocaleTimeString([], { hour12: false });
          setLogs(prev => {
            if (prev.some(l => l.msg.includes(data.step!))) return prev;
            return [...prev, { time: timeStr, level: 'AI', msg: `${data.step} (${data.progress_pct}%)`, type: 'ai' }];
          });
        }

        if (data.status === 'done' && data.building_id) {
          setStatus('done');
          setBuildingId(data.building_id);
          clearInterval(interval);
          redirectTimer = setTimeout(() => { if (isMounted) navigate(`/map/${data.building_id}`); }, 1500);
        } else if (data.status === 'failed') {
          setStatus('failed');
          setError(data.error_message || 'AI Pipeline processing failed');
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [jobId, navigate]);

  return (
    <div className="processing-page">
      <Header />

      <main className="processing-main">

        {/* Breadcrumb + Status */}
        <motion.div
          className="proc-header-row"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="proc-breadcrumb">
            <span>3D ULPIN</span>
            <span>/</span>
            <strong>Pipeline Processing</strong>
          </div>
          <div className={`proc-status-pill ${status === 'done' ? 'done' : status === 'failed' ? 'failed' : 'running'}`}>
            <span className="proc-status-dot" />
            {status === 'done' ? 'Complete' : status === 'failed' ? 'Failed' : 'Running'}
          </div>
        </motion.div>

        {/* Split Layout */}
        <div className="proc-split">

          {/* Left — Progress */}
          <motion.div
            className="proc-main-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            <div className="proc-card-header">
              <div className="proc-icon-box">
                <Box size={22} />
              </div>
              <div>
                <h1 className="proc-title font-display">Generating 3D Cadastre</h1>
                <p className="proc-subtitle font-mono">JOB: {jobId || 'ULPIN-492-XKA-991'}</p>
              </div>
            </div>

            <div className="proc-pct-label font-display">
              {progress}<small>%</small>
            </div>

            <div className="proc-step-text">
              <Terminal size={13} />
              {stepText}
            </div>

            <ProgressBar progress={progress} stepText={stepText} status={status} error={error} />

            {status === 'done' && (
              <motion.div
                className="success-redirect-box"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle2 size={20} style={{ color: 'var(--accent-sage)' }} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--primary)' }}>
                    3D Model & ULPIN Hashes ready! Redirecting…
                  </span>
                </div>
                <button className="btn-primary" style={{ padding: '8px 18px', fontSize: '0.8rem' }}
                  onClick={() => navigate(`/map/${buildingId}`)}>
                  View Now →
                </button>
              </motion.div>
            )}

            {status === 'failed' && (
              <motion.div
                style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20,
                  padding: '12px 16px', borderRadius: 'var(--radius-md)',
                  background: 'var(--accent-rose-soft)', border: '1.5px solid rgba(224,111,143,0.3)',
                  color: 'var(--accent-rose)', fontSize: '0.84rem', fontWeight: 600 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <XCircle size={18} />
                {error}
              </motion.div>
            )}
          </motion.div>

          {/* Right — Logs */}
          <div className="logs-right-col">
            <motion.div
              className="terminal-logs-card"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.45 }}
            >
              <div className="terminal-header">
                <div className="terminal-title">
                  <Terminal size={13} />
                  AI Engine Logs
                </div>
                <div className="terminal-traffic-lights">
                  <span className="traffic-light red" />
                  <span className="traffic-light yellow" />
                  <span className="traffic-light green" />
                </div>
              </div>

              <div className="terminal-body">
                {logs.map((log, i) => (
                  <div key={i} className="log-line">
                    <span className="log-time">[{log.time}]</span>
                    <span className={`log-badge ${log.type || 'sys'}`}>{log.level}</span>
                    <span className="log-msg">{log.msg}</span>
                  </div>
                ))}
                {status === 'processing' && (
                  <div className="log-line" style={{ opacity: 0.6 }}>
                    <span className="log-time">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                    <span className="log-badge ai">AI</span>
                    <span className="log-msg" style={{ animation: 'fadeInOut 1.5s infinite' }}>
                      Executing AI step... _
                    </span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Info Card */}
            <motion.div
              className="proc-info-card"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.45 }}
            >
              <div className="proc-info-title font-display">
                <Info size={15} style={{ color: 'var(--accent-lavender)' }} />
                Background Pipeline
              </div>
              {INFO_ITEMS.map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="proc-info-item">
                    <div className="proc-info-icon"><Icon size={12} /></div>
                    <span>{item.text}</span>
                  </div>
                );
              })}
              <button
                style={{ marginTop: 14, width: '100%', padding: '9px', borderRadius: 'var(--radius-sm)',
                  background: 'transparent', border: '1.5px solid var(--border-subtle)',
                  color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 600,
                  cursor: 'pointer', transition: 'all var(--transition-fast)', fontFamily: 'var(--font-mono)' }}
                onClick={() => navigate('/')}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-rose)',
                  e.currentTarget.style.color = 'var(--accent-rose)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)',
                  e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                Cancel Process
              </button>
            </motion.div>
          </div>

        </div>
      </main>
    </div>
  );
}
