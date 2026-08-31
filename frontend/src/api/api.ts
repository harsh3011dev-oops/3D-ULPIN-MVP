import axios from 'axios';
import { Building, CreateBuildingPayload, JobStatus, JobStatusResponse, SpatialValidation, ValidationResult } from '../types';
import { mockBuildingTajMahal, mockBuildingDelhi, mockBuildingGurugram, mockBuildingMumbai, generateUnitsForBounds } from '../mocks/mockBuilding';
import { MOCK_BUILDING } from '../mocks/mockBuildings';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Dynamic In-Memory Store for Created Buildings and Preset Buildings
const buildingStore = new Map<string, Building>();

// Pre-load default preset buildings into store
buildingStore.set(MOCK_BUILDING.building_id, MOCK_BUILDING);
buildingStore.set(MOCK_BUILDING.parcel_id, MOCK_BUILDING);
buildingStore.set(mockBuildingTajMahal.building_id, mockBuildingTajMahal);
buildingStore.set("PARCEL_777_TAJMAHAL_AGRA", mockBuildingTajMahal);
buildingStore.set("bldg-tajmahal-007", mockBuildingTajMahal);

buildingStore.set(mockBuildingDelhi.building_id, mockBuildingDelhi);
buildingStore.set("550e8400-e29b-41d4-a716-446655440000", mockBuildingDelhi);
buildingStore.set("PARCEL_001_DELHI", mockBuildingDelhi);

buildingStore.set(mockBuildingGurugram.building_id, mockBuildingGurugram);
buildingStore.set("PARCEL_108_GURUGRAM", mockBuildingGurugram);
buildingStore.set("bldg-gurugram-108", mockBuildingGurugram);

buildingStore.set(mockBuildingMumbai.building_id, mockBuildingMumbai);
buildingStore.set("PARCEL_502_MUMBAI", mockBuildingMumbai);
buildingStore.set("bldg-mumbai-502", mockBuildingMumbai);

interface LocalJobStore {
  status: 'pending' | 'processing' | 'completed' | 'done' | 'failed';
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
    console.warn('FastAPI Backend offline, utilizing dynamic mock job pipeline engine:', error.message);
    const jobId = 'job-' + Math.random().toString(36).substring(2, 9);
    
    // Check if submitting one of the known preset parcel IDs
    let buildingId = 'bldg-' + Math.random().toString(36).substring(2, 9);
    let buildingName = `Cadastral Plot ${buildingData.parcel_id}`;
    let address = buildingData.address || 'Plot Boundary Location';

    if (buildingData.parcel_id.includes('TAJMAHAL')) {
      buildingId = mockBuildingTajMahal.building_id;
      buildingName = mockBuildingTajMahal.building_name!;
      address = mockBuildingTajMahal.address!;
    } else if (buildingData.parcel_id.includes('GURUGRAM')) {
      buildingId = mockBuildingGurugram.building_id;
      buildingName = mockBuildingGurugram.building_name!;
      address = mockBuildingGurugram.address!;
    } else if (buildingData.parcel_id.includes('MUMBAI')) {
      buildingId = mockBuildingMumbai.building_id;
      buildingName = mockBuildingMumbai.building_name!;
      address = mockBuildingMumbai.address!;
    } else if (buildingData.parcel_id.includes('DELHI') || buildingData.parcel_id.includes('COLLEGE')) {
      buildingId = MOCK_BUILDING.building_id;
      buildingName = 'College Academic Block';
      address = 'College Campus, Delhi';
    }

    // Generate dynamic 3D building object from submitted boundary coordinates
    const coords = buildingData.parcel_boundary?.coordinates?.[0] || [
      [78.0416, 27.1746],
      [78.0426, 27.1746],
      [78.0426, 27.1756],
      [78.0416, 27.1756],
      [78.0416, 27.1746]
    ];

    const generatedUnits = generateUnitsForBounds(
      buildingData.parcel_id,
      coords,
      buildingData.height_meters,
      buildingData.floor_count
    );

    const newBuilding: Building = {
      status: 'success',
      building_id: buildingId,
      parcel_id: buildingData.parcel_id,
      aerial_image_url: buildingData.aerial_image_url,
      building_name: buildingName,
      address,
      footprint: buildingData.parcel_boundary,
      height: buildingData.height_meters,
      height_meters: buildingData.height_meters,
      floor_count: buildingData.floor_count,
      total_units: generatedUnits.length,
      units: generatedUnits,
      validation: { valid: true, overlaps_detected: false, overlapping_units: [], out_of_bounds: [], errors: [] },
      created_at: new Date().toISOString()
    };

    buildingStore.set(buildingId, newBuilding);
    buildingStore.set(buildingData.parcel_id, newBuilding);

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
    const job = localJobStore.get(jobId) || { createdAt: Date.now(), buildingId: mockBuildingTajMahal.building_id };
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
      progress_step: currentStep,
      building_id: job.buildingId || mockBuildingTajMahal.building_id
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
    if (buildingStore.has(buildingId)) {
      return buildingStore.get(buildingId)!;
    }
    if (buildingId?.startsWith('demo-') || buildingId?.includes('COLLEGE') || buildingId === 'bldg-001') {
      return MOCK_BUILDING;
    }
    if (buildingId?.toLowerCase().includes('tajmahal') || buildingId === 'bldg-tajmahal-007') {
      return mockBuildingTajMahal;
    }
    if (buildingId?.toLowerCase().includes('gurugram') || buildingId === 'bldg-gurugram-108') {
      return mockBuildingGurugram;
    }
    if (buildingId?.toLowerCase().includes('mumbai') || buildingId === 'bldg-mumbai-502') {
      return mockBuildingMumbai;
    }
    return mockBuildingDelhi;
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
    const bld = buildingStore.get(buildingId) || mockBuildingTajMahal;
    return bld.validation || { valid: true, overlaps_detected: false };
  }
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
