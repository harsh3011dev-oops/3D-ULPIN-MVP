import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Header from '../components/Header/Header';
import ProgressBar from '../components/ProgressBar/ProgressBar';
import { getJobStatus } from '../api/api';
import { CheckCircle2, XCircle, Terminal, Box, ArrowLeft } from 'lucide-react';
import './ProcessingPage.css';

export default function ProcessingPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const [progress, setProgress] = useState(0);
  const [stepText, setStepText] = useState('Initializing AI Pipeline...');
  const [status, setStatus] = useState<'pending' | 'processing' | 'done' | 'failed'>('processing');
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track consecutive 404s — backend may have restarted (in-memory job lost)
  const [notFound, setNotFound] = useState(false);
  const [notFoundCount, setNotFoundCount] = useState(0);

  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!jobId) return;
    let isMounted = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let consecutiveNotFound = 0;
    let currentPolls = 0;

    const pollStatus = async () => {
      currentPolls += 1;
      if (isMounted) setPollCount(currentPolls);

      try {
        const data = await getJobStatus(jobId);
        if (!isMounted) return;

        // Reset 404 counter on any successful response
        consecutiveNotFound = 0;
        setNotFoundCount(0);

        setProgress(data.progress_pct);
        const currentStep = data.progress_step || (data as any).step || 'Processing...';
        setStepText(currentStep);

        const effectiveBuildingId = 
          data.building_id || 
          data.result_data?.building_id || 
          (data as any).result_json?.building_id;

        if (effectiveBuildingId) {
          setBuildingId(effectiveBuildingId);
        }

        if ((data.status === 'done' || data.status === 'completed') && effectiveBuildingId) {
          setStatus('done');
          setTimeout(() => { if (isMounted) navigate(`/map/${effectiveBuildingId}`); }, 1200);
          return;
        } else if (data.status === 'failed') {
          setStatus('failed');
          setError(data.error_message || 'AI Pipeline processing failed');
          return;
        } else if (data.progress_pct >= 90 && effectiveBuildingId && currentPolls >= 3) {
          // If stuck at 90% for more than 3 polling cycles but buildingId is ready, auto-navigate
          setStatus('done');
          setTimeout(() => { if (isMounted) navigate(`/map/${effectiveBuildingId}`); }, 1000);
          return;
        }
      } catch (err: any) {
        if (!isMounted) return;

        // 404 = job not found (backend restarted, in-memory job wiped)
        const is404 = err?.response?.status === 404;
        if (is404) {
          consecutiveNotFound += 1;
          setNotFoundCount(consecutiveNotFound);
          if (consecutiveNotFound >= 15) {
            // Stop polling — the job is permanently lost after restart
            setStatus('failed');
            setError('Backend restarted and the job was lost. Please go back and submit again.');
            setNotFound(true);
            return;
          }
        } else if (err?.code !== 'ECONNABORTED') {
          console.warn('Job status poll retry:', err?.message || err);
        }
      }

      // Safety timeout after 20 polls (~45 seconds)
      if (currentPolls >= 20) {
        if (buildingId) {
          setStatus('done');
          navigate(`/map/${buildingId}`);
          return;
        } else {
          setStatus('failed');
          setError('AI Generation took longer than expected due to network load. Please try again or open the 3D Map directly.');
          return;
        }
      }

      if (isMounted) {
        timer = setTimeout(pollStatus, 2200);
      }
    };

    pollStatus();

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, navigate, buildingId]);


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

        {/* Centered Main Progress Card */}
        <div className="proc-center-wrapper">
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
                  <CheckCircle2 size={20} style={{ color: 'var(--accent-teal)' }} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    3D Model & ULPIN Hashes ready! Redirecting…
                  </span>
                </div>
                <button
                  className="btn-primary"
                  style={{ padding: '8px 18px', fontSize: '0.8rem' }}
                  onClick={() => navigate(`/map/${buildingId}`)}
                >
                  View Now →
                </button>
              </motion.div>
            )}

            {status === 'failed' && (
              <motion.div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginTop: 20,
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--accent-red-soft)',
                  border: '1px solid rgba(220,38,38,0.3)',
                  color: 'var(--accent-red)',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <XCircle size={18} />
                {error}
              </motion.div>
            )}

            {status !== 'done' && buildingId && (
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ 
                    padding: '9px 20px', 
                    fontSize: '0.85rem', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8,
                    background: 'linear-gradient(135deg, var(--accent-teal), #0284c7)',
                    cursor: 'pointer'
                  }}
                  onClick={() => navigate(`/map/${buildingId}`)}
                >
                  <span>⚡ Open 3D Building Now</span>
                </button>
              </div>
            )}

            {status !== 'done' && (
              <div className="proc-cancel-row">
                <button
                  type="button"
                  className="proc-cancel-btn"
                  onClick={() => navigate('/explore')}
                >
                  <ArrowLeft size={14} />
                  <span>Cancel and Return</span>
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
