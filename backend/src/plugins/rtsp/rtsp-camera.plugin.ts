import { Logger } from '@nestjs/common';
import {
  CameraPlugin,
  CameraStatusValue,
  CameraConnectionConfig,
  StreamSource,
} from '../camera-plugin.interface';
import { StreamingService } from '../../streaming/streaming.service';

export class RtspCameraPlugin implements CameraPlugin {
  readonly type = 'RTSP' as const;
  private readonly logger = new Logger(RtspCameraPlugin.name);
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

  async connect(config: CameraConnectionConfig): Promise<void> {
    const rawUrl = config.rtspUrl;

    if (
      !rawUrl ||
      typeof rawUrl !== 'string' ||
      !rawUrl.startsWith('rtsp://')
    ) {
      this.setStatus('ERROR');
      throw new Error(
        'Invalid or missing rtspUrl in connectionConfig (must begin with rtsp://)',
      );
    }

    this.setStatus('CONNECTING');

    // Build URL with credentials if username and password are provided separately
    let targetUrl = rawUrl;
    if (config.username && config.password && !rawUrl.includes('@')) {
      const urlWithoutScheme = rawUrl.substring('rtsp://'.length);
      const encodedUser = encodeURIComponent(String(config.username));
      const encodedPass = encodeURIComponent(String(config.password));
      targetUrl = `rtsp://${encodedUser}:${encodedPass}@${urlWithoutScheme}`;
    }

    try {
      this.streamingService.startStream(this.cameraId, targetUrl, (err) => {
        // Callback invoked on process error or unexpected exit
        if (err) {
          this.logger.error(
            `Stream error for camera ${this.cameraId}: ${err.message}`,
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
