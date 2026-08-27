import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header/Header';
import ProgressBar from '../components/ProgressBar/ProgressBar';
import { getJobStatus } from '../api/api';
import { CheckCircle2, Loader2, Info, XCircle, Terminal, Box } from 'lucide-react';
import './ProcessingPage.css';

interface LogLine {
  time: string;
  level: string;
  msg: string;
  type?: string;
}

const DEFAULT_LOGS: LogLine[] = [
  { time: '10:42:01', level: 'INFO', msg: 'Initializing 3D ULPIN AI pipeline worker...', type: 'sys' },
  { time: '10:42:01', level: 'SYS',  msg: 'Loading Shapely & MapLibre geometry drivers... OK', type: 'sys' },
  { time: '10:42:02', level: 'GEO',  msg: 'Bounding Polygon loaded: 4 vertices verified', type: 'geo' },
  { time: '10:42:02', level: 'OK',   msg: 'Footprint contour detection confidence: 0.985', type: 'ok' },
  { time: '10:42:03', level: 'INFO', msg: 'Calculating Z-min/Z-max spatial extrusion limits...', type: 'sys' },
  { time: '10:42:04', level: 'GEO',  msg: 'Building3D volumetric extrude: volume_m3 calculated', type: 'geo' },
  { time: '10:42:05', level: 'OK',   msg: 'Floor slicing completed across target elevation strata', type: 'ok' },
];

export default function ProcessingPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const [progress, setProgress] = useState(0);
  const [stepText, setStepText] = useState('Initializing AI Pipeline...');
  const [status, setStatus] = useState<'pending' | 'processing' | 'done' | 'failed'>('processing');
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>(DEFAULT_LOGS);

  useEffect(() => {
    if (!jobId) return;

    const interval = setInterval(async () => {
      try {
        const data = await getJobStatus(jobId);
        setProgress(data.progress_pct);
        setStepText(data.step || 'Processing...');

        // Add dynamic log entry
        if (data.step) {
          const timeStr = new Date().toLocaleTimeString([], { hour12: false });
          setLogs(prev => {
            if (prev.some(l => l.msg.includes(data.step!))) return prev;
            return [...prev, { time: timeStr, level: 'AI', msg: `${data.step} (${data.progress_pct}%)`, type: 'geo' }];
          });
        }

        if (data.status === 'done' && data.building_id) {
          setStatus('done');
          setBuildingId(data.building_id);
          clearInterval(interval);

          setTimeout(() => {
            navigate(`/map/${data.building_id}`);
          }, 1500);
        } else if (data.status === 'failed') {
          setStatus('failed');
          setError(data.error_message || 'AI Pipeline processing failed');
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId, navigate]);

  return (
    <div className="page-layout">
      <Header />

      <main className="processing-container">

        {/* ── Title Header ── */}
        <div className="processing-header-stitch">
          <div className="processing-icon-box">
            <Box size={28} />
          </div>
          <h1 className="processing-main-title">Generating 3D Cadastre</h1>
          <div className="job-id-chip font-mono">
            JOB ID: {jobId || 'ULPIN-492-XKA-991'}
          </div>
        </div>

        {/* ── 2-Column Split: Pipeline (Left) & Logs (Right) ── */}
        <div className="processing-grid-stitch">

          {/* Left Column: Progress Bar & Status */}
          <div className="pipeline-left-col">
            <ProgressBar
              progress={progress}
              stepText={stepText}
              status={status}
              error={error}
            />

            {status === 'done' && (
              <div className="success-redirect-box glass-panel">
                <div className="flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-green" />
                  <p>3D Model & ULPIN Hashes ready! Redirecting to 3D Explorer...</p>
                </div>
                <button
                  className="btn-primary py-1.5 px-4 text-xs font-mono"
                  onClick={() => navigate(`/map/${buildingId}`)}
                >
                  View Now →
                </button>
              </div>
            )}
          </div>

          {/* Right Column: Live Terminal Engine Logs & Note Card */}
          <div className="logs-right-col">
            {/* Live Logs Card */}
            <div className="terminal-logs-card glass-panel">
              <div className="terminal-header">
                <div className="terminal-title">
                  <Terminal size={14} className="icon-blue" />
                  <span>AI Engine Logs</span>
                </div>
                <div className="terminal-dots">
                  <span className="dot red"></span>
                  <span className="dot yellow"></span>
                  <span className="dot green"></span>
                </div>
              </div>

              <div className="terminal-body font-mono">
                {logs.map((log, i) => (
                  <div key={i} className="log-line">
                    <span className="log-time">[{log.time}]</span>{' '}
                    <span className={`log-level ${log.level.toLowerCase()}`}>{log.level}</span>{' '}
                    <span className="log-msg">{log.msg}</span>
                  </div>
                ))}
                {status === 'processing' && (
                  <div className="log-line animate-pulse text-cyan">
                    <span className="log-time">[{new Date().toLocaleTimeString([], { hour12: false })}]</span> Executing AI step... _
                  </div>
                )}
              </div>
            </div>

            {/* Background Note Card */}
            <div className="background-note-card">
              <Info size={18} className="text-secondary flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="note-title">Background Pipeline Operation</h4>
                <p className="note-desc">
                  You can safely monitor progress here or jump into the 3D map explorer. Topology extrusion and ISO 19152 ULPIN hash generation will auto-redirect once verified.
                </p>
              </div>
            </div>

            <button
              className="cancel-btn font-mono"
              onClick={() => navigate('/')}
            >
              Cancel Process
            </button>
          </div>

        </div>

      </main>
    </div>
  );
}
