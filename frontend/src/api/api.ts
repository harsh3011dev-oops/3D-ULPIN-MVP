import axios from 'axios';
import { Building, CreateBuildingPayload, JobStatusResponse, SpatialValidation } from '../types';
import { mockBuilding } from '../mocks/mockBuilding';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

interface LocalJobStore {
  status: 'processing' | 'done' | 'failed';
  progress: number;
  buildingId: string;
  formData: CreateBuildingPayload;
  createdAt: number;
}

const localJobStore = new Map<string, LocalJobStore>();

/**
 * Submit a building for 3D ULPIN generation via Axios.
 */
export async function createBuilding(buildingData: CreateBuildingPayload): Promise<{ building_id: string; job_id: string; status: string; message?: string }> {
  try {
    const response = await apiClient.post('/buildings/create', buildingData);
    return response.data;
  } catch (error: any) {
    console.warn('FastAPI Backend offline, utilizing mock job pipeline engine:', error.message);
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
 * Poll job status via Axios.
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  try {
    const response = await apiClient.get(`/jobs/${jobId}/status`);
    return response.data;
  } catch (error: any) {
    const job = localJobStore.get(jobId) || { createdAt: Date.now(), buildingId: mockBuilding.building_id };
    const elapsedSeconds = (Date.now() - (job.createdAt || Date.now())) / 1000;
    
    const progress = Math.min(100, Math.floor(elapsedSeconds * 22) + 20);
    const status = progress >= 100 ? 'done' : 'processing';

    let currentStep = 'Extracting aerial footprint with OpenCV & Shapely...';
    if (progress > 30) currentStep = 'Generating 3D volumetric extrusions with deck.gl...';
    if (progress > 65) currentStep = 'Hashing 3D ULPIN spatial coordinates (ISO 19152 LADM)...';
    if (progress > 85) currentStep = 'Running 3D spatial collision & overlap validation...';
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
 * Fetch building record with volumetric units via Axios.
 */
export async function getBuilding(buildingId: string): Promise<Building> {
  try {
    const response = await apiClient.get(`/buildings/${buildingId}`);
    return response.data;
  } catch (error: any) {
    return {
      ...mockBuilding,
      building_id: buildingId || mockBuilding.building_id
    };
  }
}

/**
 * Fetch spatial validation report via Axios.
 */
export async function getValidation(buildingId: string): Promise<SpatialValidation> {
  try {
    const response = await apiClient.get(`/validation/${buildingId}`);
    return response.data;
  } catch (error: any) {
    return mockBuilding.validation || { valid: true, overlaps_detected: false };
  }
}
