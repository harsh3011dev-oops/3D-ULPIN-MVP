/**
 * frontend/src/utils/backendWarmup.ts
 * ────────────────────────────────────────────────────────
 * Proactively pings the Render backend on website load.
 * If the backend is currently sleeping (Render cold start),
 * this initiates the wake-up process immediately so by the time
 * the user interacts with maps or generation, the API is hot.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://threed-ulpin-backend-v9ur.onrender.com/api';
// Resolve base origin for /api/ping
const PING_URL = BASE_URL.endsWith('/api') ? `${BASE_URL}/ping` : `${BASE_URL}/api/ping`;

type BackendStatus = 'checking' | 'awake' | 'waking_up' | 'error';
type Listener = (status: BackendStatus) => void;

let currentStatus: BackendStatus = 'checking';
const listeners: Set<Listener> = new Set();

export function subscribeBackendStatus(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentStatus);
  return () => listeners.delete(listener);
}

function setStatus(status: BackendStatus) {
  currentStatus = status;
  listeners.forEach((fn) => fn(status));
}

let warmupTriggered = false;

export async function triggerBackendWarmup() {
  if (warmupTriggered) return;
  warmupTriggered = true;

  setStatus('checking');

  const maxAttempts = 12; // up to ~40-60s for cold start
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(PING_URL, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        setStatus('awake');
        console.debug('⚡ [Render Warmup] Backend is awake and responsive!');
        return;
      }
    } catch (e) {
      // Backend is likely spinning up from Render cold start
      if (attempt === 1) {
        setStatus('waking_up');
        console.debug('⏳ [Render Warmup] Backend sleeping; wake-up triggered...');
      }
    }

    // Wait 3 seconds before next poll
    await new Promise((r) => setTimeout(r, 3000));
  }

  setStatus('error');
}

// Auto-trigger warmup upon module evaluation (as soon as frontend starts in browser)
if (typeof window !== 'undefined') {
  // Give initial UI render priority, fire after 150ms
  setTimeout(() => {
    triggerBackendWarmup();
  }, 150);
}
