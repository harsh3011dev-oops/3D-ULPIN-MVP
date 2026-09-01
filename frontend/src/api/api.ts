import axios from 'axios';
import { Building, CreateBuildingPayload, JobStatus, JobStatusResponse, SpatialValidation, ValidationResult } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

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
  const response = await apiClient.get(`/jobs/${jobId}/status`);
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

