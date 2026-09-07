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

export interface StreamSource {
  url: string;
  protocol: 'hls' | 'webrtc';
}

export interface CameraStreamResponse {
  id: string;
  streamSource: StreamSource | null;
}

export interface CameraStatusResponse {
  id: string;
  status: CameraStatus;
  lastSeenAt?: string;
  streamSource?: StreamSource | null;
}

export interface DiscoveredDevice {
  id: string;
  name: string;
  address: string;
  metadata?: Record<string, any>;
}

export interface CameraEvent {
  id: string;
  cameraId: string;
  type: 'STATUS' | 'MOTION' | 'DETECTION';
  payload: Record<string, any>;
  createdAt: string;
}

export interface Recording {
  id: string;
  cameraId: string;
  filePath: string;
  videoUrl: string;
  duration: number | null;
  sizeBytes: number | null;
  trigger: 'MANUAL' | 'EVENT' | 'SCHEDULE';
  startedAt: string;
  finishedAt: string | null;
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

  getStreamSource: async (id: string): Promise<CameraStreamResponse> => {
    const res = await apiClient.get<CameraStreamResponse>(`/cameras/${id}/stream`);
    return res.data;
  },

  discover: async (): Promise<DiscoveredDevice[]> => {
    const res = await apiClient.get<DiscoveredDevice[]>('/cameras/discover');
    return res.data;
  },

  getEvents: async (
    id: string,
    limit?: number,
    type?: string,
  ): Promise<CameraEvent[]> => {
    const params: Record<string, string | number> = {};
    if (limit) params.limit = limit;
    if (type) params.type = type;
    const res = await apiClient.get<CameraEvent[]>(`/cameras/${id}/events`, {
      params,
    });
    return res.data;
  },

  triggerEvent: async (
    id: string,
    type: 'MOTION' | 'STATUS' = 'MOTION',
    payload?: Record<string, any>,
  ): Promise<CameraEvent> => {
    const res = await apiClient.post<CameraEvent>(
      `/cameras/${id}/events/trigger`,
      { type, payload },
    );
    return res.data;
  },

  listRecordings: async (id: string): Promise<Recording[]> => {
    const res = await apiClient.get<Recording[]>(`/cameras/${id}/recordings`);
    return res.data;
  },

  startRecording: async (id: string): Promise<Recording> => {
    const res = await apiClient.post<Recording>(`/cameras/${id}/recordings/start`);
    return res.data;
  },

  stopRecording: async (id: string): Promise<Recording> => {
    const res = await apiClient.post<Recording>(`/cameras/${id}/recordings/stop`);
    return res.data;
  },
};
