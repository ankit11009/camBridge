import { apiClient } from './client';

export type PluginType = 'MOCK' | 'RTSP' | 'ONVIF';
export type CameraStatus = 'UNKNOWN' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export interface Camera {
  id: string;
  ownerId: string;
  name: string;
  pluginType: PluginType;
  connectionConfig: Record<string, unknown>;
  status: CameraStatus;
  lastSeenAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCameraInput {
  name: string;
  pluginType: PluginType;
  connectionConfig?: Record<string, unknown>;
}

export interface UpdateCameraInput {
  name?: string;
  connectionConfig?: Record<string, unknown>;
}

export interface CameraStatusResponse {
  id: string;
  status: CameraStatus;
  lastSeenAt?: string;
}

export const camerasApi = {
  list: async (): Promise<Camera[]> => {
    const res = await apiClient.get<Camera[]>('/cameras');
    return res.data;
  },

  getById: async (id: string): Promise<Camera> => {
    const res = await apiClient.get<Camera>(`/cameras/${id}`);
    return res.data;
  },

  create: async (input: CreateCameraInput): Promise<Camera> => {
    const res = await apiClient.post<Camera>('/cameras', input);
    return res.data;
  },

  update: async (id: string, input: UpdateCameraInput): Promise<Camera> => {
    const res = await apiClient.patch<Camera>(`/cameras/${id}`, input);
    return res.data;
  },

  delete: async (id: string): Promise<{ success: boolean; id: string }> => {
    const res = await apiClient.delete<{ success: boolean; id: string }>(`/cameras/${id}`);
    return res.data;
  },

  connect: async (id: string): Promise<CameraStatusResponse> => {
    const res = await apiClient.post<CameraStatusResponse>(`/cameras/${id}/connect`);
    return res.data;
  },

  disconnect: async (id: string): Promise<CameraStatusResponse> => {
    const res = await apiClient.post<CameraStatusResponse>(`/cameras/${id}/disconnect`);
    return res.data;
  },

  getStatus: async (id: string): Promise<CameraStatusResponse> => {
    const res = await apiClient.get<CameraStatusResponse>(`/cameras/${id}/status`);
    return res.data;
  },
};
