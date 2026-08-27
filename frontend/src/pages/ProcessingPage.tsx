import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header/Header';
import ProgressBar from '../components/ProgressBar/ProgressBar';
import { getJobStatus } from '../api/api';
import { ArrowRight } from 'lucide-react';
import './ProcessingPage.css';

export default function ProcessingPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const [progress, setProgress] = useState(10);
  const [stepText, setStepText] = useState('Initializing AI Volumetric Engine & deck.gl...');
  const [status, setStatus] = useState<'processing' | 'done' | 'failed'>('processing');
  const [buildingId, setBuildingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: any;

    const checkStatus = async () => {
      if (!jobId) return;
      try {
        const data = await getJobStatus(jobId);
        setProgress(data.progress_pct ?? 0);
        setStepText(data.step || 'Processing aerial building model...');
        setStatus(data.status);
        if (data.building_id) setBuildingId(data.building_id);

        if (data.status === 'done') {
          clearInterval(intervalId);
          setTimeout(() => {
            navigate(`/map/${data.building_id || '550e8400-e29b-41d4-a716-446655440000'}`);
          }, 1200);
        } else if (data.status === 'failed') {
          clearInterval(intervalId);
          setError(data.error_message || 'AI processing encountered an exception.');
        }
      } catch (err) {
        console.error('Job polling error:', err);
      }
    };

    checkStatus();
    intervalId = setInterval(checkStatus, 2000);

    return () => clearInterval(intervalId);
  }, [jobId, navigate]);

  return (
    <div className="page-layout">
      <Header />

      <main className="processing-container">
        <div className="processing-wrapper">
          <ProgressBar
            progress={progress}
            stepText={stepText}
            status={status}
            error={error}
          />

          {status === 'done' && (
            <div className="success-redirect-box glass-panel fade-in">
              <p>Generation Complete! Opening deck.gl 3D Map Explorer...</p>
              <button
                className="btn-primary"
                onClick={() => navigate(`/map/${buildingId || '550e8400-e29b-41d4-a716-446655440000'}`)}
              >
                <span>Launch 3D Explorer Now</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
