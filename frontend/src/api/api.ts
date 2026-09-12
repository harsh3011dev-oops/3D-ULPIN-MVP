import axios from 'axios';
import { AutoDetectBuildingPayload, AutoDetectBuildingResult, Building, CreateBuildingPayload, JobStatus, JobStatusResponse, SpatialValidation, ValidationResult } from '../types';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://threed-ulpin-backend-v9ur.onrender.com/api';
const BASE_URL = rawBaseUrl.replace(/\/+$/, '');

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Auto-fill coordinates / height / floors for a famous building.
 */
export async function autoDetectBuilding(payload: AutoDetectBuildingPayload): Promise<AutoDetectBuildingResult> {
  const response = await apiClient.post('/buildings/auto-detect', payload);
  return response.data;
}

/**
 * Submit a building for 3D ULPIN generation via Axios.
 */
export async function createBuilding(buildingData: CreateBuildingPayload): Promise<{ building_id: string; job_id: string; status: string; message?: string }> {
  const response = await apiClient.post('/buildings/create', buildingData);
  return response.data;
}

/**
 * Poll job status via Axios.
 */
export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const response = await apiClient.get(`/jobs/${jobId}/status`, { timeout: 10000 });
  return response.data;
}

/**
 * Fetch building record with volumetric units via Axios.
 */
export async function getBuilding(buildingId: string): Promise<Building> {
  const response = await apiClient.get(`/buildings/${buildingId}`);
  return response.data;
}

/**
 * Fetch spatial validation report via Axios.
 */
export async function getValidation(buildingId: string): Promise<SpatialValidation> {
  const response = await apiClient.get(`/validation/${buildingId}`);
  return response.data;
}

/**
 * buildingAPI wrapper object as specified in frontend build guide
 */
export const buildingAPI = {
  create: async (data: {
    parcel_id: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    height_meters: number;
    floor_count: number;
    aerial_image_url?: string;
    parcel_boundary?: any;
  }) => {
    return apiClient.post<{ job_id: string; status: string; building_id?: string }>('/buildings/create', data);
  },

  jobStatus: async (jobId: string) => {
    return apiClient.get<JobStatus>(`/jobs/${jobId}/status`);
  },

  getBuilding: async (buildingId: string) => {
    return apiClient.get<Building>(`/buildings/${buildingId}`);
  },

  getValidation: async (buildingId: string) => {
    return apiClient.get<ValidationResult>(`/validation/${buildingId}`);
  },
};

const _geminiInferenceCache = new Map<string, any>();

/**
 * Optional Gemini AI architectural metadata inference.
 * Only called when key architectural attributes are missing from OSM.
 */
export async function inferBuildingMetadata(
  payload: any
): Promise<any | null> {
  const cacheKey = `${payload.osm_id || ''}_${payload.building_name || ''}_${payload.footprint_metrics?.area_sqm || 0}_${payload.footprint_metrics?.circularity || 0}`;
  if (_geminiInferenceCache.has(cacheKey)) {
    return _geminiInferenceCache.get(cacheKey)!;
  }

  try {
    const response = await apiClient.post('/ai/infer-building-metadata', payload, {
      timeout: 4000,
    });
    if (response.data && response.data.confidence > 0) {
      _geminiInferenceCache.set(cacheKey, response.data);
      return response.data;
    }
    return null;
  } catch (err) {
    console.debug('Optional Gemini inference skipped or unavailable:', err);
    return null;
  }
}


