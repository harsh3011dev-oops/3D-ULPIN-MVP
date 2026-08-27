import axios from 'axios';
import { mockBuilding, mockValidationInvalid } from '../mocks/mockBuilding';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// In-memory store for newly submitted jobs/buildings during mock fallback mode
const localJobStore = new Map();

/**
 * Submit a building for 3D ULPIN generation.
 */
export async function createBuilding(buildingData) {
  try {
    const response = await apiClient.post('/buildings/create', buildingData);
    return response.data;
  } catch (error) {
    console.warn('Backend unavailable, using simulated job queue:', error.message);
    const jobId = 'job-' + Math.random().toString(36).substring(2, 9);
    const buildingId = mockBuilding.building_id;

    localJobStore.set(jobId, {
      status: 'processing',
      progress: 0,
      buildingId,
      formData: buildingData,
      createdAt: Date.now()
    });

    return {
      building_id: buildingId,
      job_id: jobId,
      status: 'processing',
      message: '3D ULPIN Extraction job initialized'
    };
  }
}

/**
 * Poll job status.
 */
export async function getJobStatus(jobId) {
  try {
    const response = await apiClient.get(`/jobs/${jobId}/status`);
    return response.data;
  } catch (error) {
    console.warn(`Polling mock job status for ${jobId}`);
    const job = localJobStore.get(jobId) || { createdAt: Date.now(), buildingId: mockBuilding.building_id };
    const elapsedSeconds = (Date.now() - (job.createdAt || Date.now())) / 1000;
    
    // Simulate 4-step progress: 0s->20%, 2s->50%, 4s->80%, 6s->100% (done)
    let progress = Math.min(100, Math.floor(elapsedSeconds * 22) + 20);
    let status = progress >= 100 ? 'done' : 'processing';

    let currentStep = 'Extracting aerial footprint...';
    if (progress > 30) currentStep = 'Generating 3D volumetric extrusions...';
    if (progress > 65) currentStep = 'Assigning 3D ULPIN spatial hashes...';
    if (progress > 85) currentStep = 'Validating spatial non-overlap constraints...';
    if (status === 'done') currentStep = '3D ULPIN generation complete!';

    return {
      status,
      progress_pct: progress,
      step: currentStep,
      building_id: job.buildingId || mockBuilding.building_id
    };
  }
}

/**
 * Fetch building record with units.
 */
export async function getBuilding(buildingId) {
  try {
    const response = await apiClient.get(`/buildings/${buildingId}`);
    return response.data;
  } catch (error) {
    console.warn(`Fetching mock building for ID: ${buildingId}`);
    return {
      ...mockBuilding,
      building_id: buildingId || mockBuilding.building_id
    };
  }
}

/**
 * Fetch spatial validation report.
 */
export async function getValidation(buildingId) {
  try {
    const response = await apiClient.get(`/validation/${buildingId}`);
    return response.data;
  } catch (error) {
    console.warn(`Fetching mock spatial validation for ID: ${buildingId}`);
    return mockBuilding.validation;
  }
}
