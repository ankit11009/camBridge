export type CameraStatusValue =
  'UNKNOWN' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export interface CameraConnectionConfig {
  [key: string]: unknown; // plugin-specific shape, validated per-plugin
}

export interface DiscoveredDevice {
  id: string;
  name: string;
  address: string;
  metadata?: Record<string, unknown>;
}

export interface StreamSource {
  url: string; // HLS playlist URL or WebRTC signaling endpoint
  protocol: 'hls' | 'webrtc';
}

export interface CameraPlugin {
  readonly type: 'MOCK' | 'RTSP' | 'ONVIF';

  connect(config: CameraConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): Promise<CameraStatusValue>;

  discover?(): Promise<DiscoveredDevice[]>;
  getStreamSource?(): Promise<StreamSource>;
}
