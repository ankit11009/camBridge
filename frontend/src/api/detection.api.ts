import { apiClient } from './client';
export interface MotionZone { x: number; y: number; width: number; height: number; }
export interface DetectionResult {
  label: string;
  confidence: number;
  box: { x: number; y: number; width: number; height: number };
  attributes?: Record<string, unknown>;
}

export interface DetectionStatusResponse {
  zone?: MotionZone;
  error?: string | null;
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  lastDetectedAt?: string | null;
  lastDetection?: DetectionResult | null;
}

export const detectionApi = {
  toggleDetection: async (
    cameraId: string,
    enabled: boolean,
    intervalMs = 2000,
    zone?: MotionZone,
  ): Promise<DetectionStatusResponse> => {
    const res = await apiClient.post<DetectionStatusResponse>(
      `/cameras/${cameraId}/detection/toggle`,
      { enabled, intervalMs, zone },
    );
    return res.data;
  },

  getStatus: async (cameraId: string): Promise<DetectionStatusResponse> => {
    const res = await apiClient.get<DetectionStatusResponse>(
      `/cameras/${cameraId}/detection/status`,
    );
    return res.data;
  },

  runManualDetection: async (cameraId: string): Promise<any> => {
    const res = await apiClient.post(`/cameras/${cameraId}/detect`);
    return res.data;
  },
};

