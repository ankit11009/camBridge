import { getOnvifStreamUri } from './onvif-client';
import { Logger } from '@nestjs/common';
import {
  CameraPlugin,
  CameraStatusValue,
  CameraConnectionConfig,
  StreamSource,
} from '../camera-plugin.interface';
import { StreamingService } from '../../streaming/streaming.service';

export class OnvifCameraPlugin implements CameraPlugin {
  readonly type = 'ONVIF' as const;
  private readonly logger = new Logger(OnvifCameraPlugin.name);
  private connectionAbort?: AbortController;
  private status: CameraStatusValue = 'UNKNOWN';
  private onStatusChangeCallback?: (status: CameraStatusValue) => void;

  constructor(
    private readonly cameraId: string,
    private readonly streamingService: StreamingService,
    onStatusChange?: (status: CameraStatusValue) => void,
  ) {
    this.onStatusChangeCallback = onStatusChange;
  }

  setStatusChangeHandler(handler: (status: CameraStatusValue) => void) {
    this.onStatusChangeCallback = handler;
  }

  /**
   * Resolves the RTSP stream URI from connectionConfig.
   * If an explicit rtspUrl is given (e.g. from discovery metadata), it uses it.
   * Otherwise, it derives the stream endpoint from deviceUrl/xaddrs/credentials.
   */
  resolveStreamUrl(config: CameraConnectionConfig): string {
    if (config.rtspUrl && typeof config.rtspUrl === 'string') {
      const url = new URL(config.rtspUrl);
      if (!['rtsp:', 'rtsps:'].includes(url.protocol)) {
        throw new Error('ONVIF stream URL must use RTSP');
      }
      if (config.username && !url.username) {
        url.username = String(config.username);
        url.password = String(config.password || '');
      }
      return url.toString();
    }

    const deviceUrl = (config.deviceUrl ||
      config.xaddrs ||
      config.address) as string;
    if (!deviceUrl) {
      throw new Error(
        'Invalid ONVIF configuration: either rtspUrl or deviceUrl/address must be provided',
      );
    }

    try {
      const parsed = new URL(deviceUrl);
      const host = parsed.hostname;
      const rtspPort = config.rtspPort || 554;
      if (!config.streamPath)
        throw new Error(
          'An explicit streamPath is required for manual URL resolution',
        );
      const path = String(config.streamPath).replace(/^\/+/, '');

      if (config.username && config.password) {
        const encodedUser = encodeURIComponent(String(config.username));
        const encodedPass = encodeURIComponent(String(config.password));
        return `rtsp://${encodedUser}:${encodedPass}@${host}:${rtspPort}/${path}`;
      }

      return `rtsp://${host}:${rtspPort}/${path}`;
    } catch {
      throw new Error(
        `Unable to parse ONVIF deviceUrl '${deviceUrl}' to extract RTSP stream endpoint`,
      );
    }
  }

  async connect(config: CameraConnectionConfig): Promise<void> {
    this.connectionAbort?.abort();
    const controller = new AbortController();
    this.connectionAbort = controller;
    const deadline = setTimeout(() => controller.abort(), 15000);
    this.setStatus('CONNECTING');

    let streamUrl: string;
    try {
      streamUrl =
        config.rtspUrl || config.streamPath
          ? this.resolveStreamUrl(config)
          : this.resolveStreamUrl({
              ...config,
              rtspUrl: await getOnvifStreamUri(config, controller.signal),
            });
    } catch (err) {
      if (this.connectionAbort === controller) this.setStatus('ERROR');
      throw err;
    } finally {
      clearTimeout(deadline);
    }
    if (controller.signal.aborted || this.connectionAbort !== controller) return;

    try {
      this.logger.log(
        `Connecting ONVIF camera ${this.cameraId} with resolved stream: ${streamUrl.replace(/\/\/.*@/, '//***:***@')}`,
      );

      this.streamingService.startStream(this.cameraId, streamUrl, (err) => {
        if (err) {
          this.logger.error(
            `ONVIF stream error for camera ${this.cameraId}: ${err.message}`,
          );
        }
        this.setStatus('ERROR');
      });

      this.setStatus('CONNECTED');
    } catch (err) {
      this.setStatus('ERROR');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.connectionAbort?.abort();
    this.connectionAbort = undefined;
    this.streamingService.stopStream(this.cameraId);
    this.setStatus('DISCONNECTED');
  }

  async getStatus(): Promise<CameraStatusValue> {
    return this.status;
  }

  async getStreamSource(): Promise<StreamSource> {
    return this.streamingService.getStreamSource(this.cameraId);
  }

  private setStatus(newStatus: CameraStatusValue) {
    this.status = newStatus;
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(newStatus);
    }
  }
}
