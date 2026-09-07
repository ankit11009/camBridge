import {
  CameraPlugin,
  CameraStatusValue,
  CameraConnectionConfig,
  StreamSource,
} from '../camera-plugin.interface';

export class MockCameraPlugin implements CameraPlugin {
  readonly type = 'MOCK' as const;
  private status: CameraStatusValue = 'UNKNOWN';
  private connectionTimer: NodeJS.Timeout | null = null;
  private onStatusChangeCallback?: (status: CameraStatusValue) => void;

  constructor(onStatusChange?: (status: CameraStatusValue) => void) {
    this.onStatusChangeCallback = onStatusChange;
  }

  setStatusChangeHandler(handler: (status: CameraStatusValue) => void) {
    this.onStatusChangeCallback = handler;
  }

  async connect(config: CameraConnectionConfig): Promise<void> {
    this.clearTimer();

    // Immediately transition to CONNECTING
    this.setStatus('CONNECTING');

    const delayMs =
      typeof config.connectDelayMs === 'number'
        ? config.connectDelayMs
        : typeof config.simulateIntervalMs === 'number'
          ? Math.min(config.simulateIntervalMs, 800)
          : 500;

    const shouldFail = config.simulateError === true;

    return new Promise<void>((resolve) => {
      this.connectionTimer = setTimeout(() => {
        if (shouldFail) {
          this.setStatus('ERROR');
        } else {
          this.setStatus('CONNECTED');
        }
        resolve();
      }, delayMs);
    });
  }

  async disconnect(): Promise<void> {
    this.clearTimer();
    this.setStatus('DISCONNECTED');
  }

  async getStatus(): Promise<CameraStatusValue> {
    return this.status;
  }

  async getStreamSource(): Promise<StreamSource> {
    return {
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      protocol: 'hls',
    };
  }

  private setStatus(newStatus: CameraStatusValue) {
    this.status = newStatus;
    if (this.onStatusChangeCallback) {
      this.onStatusChangeCallback(newStatus);
    }
  }

  private clearTimer() {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }
}
