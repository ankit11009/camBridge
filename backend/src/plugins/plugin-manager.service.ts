import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import {
  CameraPlugin,
  CameraStatusValue,
  CameraConnectionConfig,
  StreamSource,
  DiscoveredDevice,
} from './camera-plugin.interface';
import { MockCameraPlugin } from './mock/mock-camera.plugin';
import { RtspCameraPlugin } from './rtsp/rtsp-camera.plugin';
import { OnvifCameraPlugin } from './onvif/onvif-camera.plugin';
import { OnvifDiscoveryService } from './onvif/onvif-discovery.service';
import { StreamingService } from '../streaming/streaming.service';

@Injectable()
export class PluginManagerService {
  private readonly logger = new Logger(PluginManagerService.name);
  // Independent plugin instance per camera ID to prevent cross-camera state leakage
  private readonly cameraPlugins = new Map<string, CameraPlugin>();

  constructor(
    private readonly streamingService: StreamingService,
    private readonly onvifDiscoveryService: OnvifDiscoveryService,
  ) {}

  /**
   * Resolves or creates a dedicated camera plugin instance
   */
  getOrCreatePlugin(
    cameraId: string,
    pluginType: string,
    onStatusChange?: (status: CameraStatusValue) => void,
  ): CameraPlugin {
    let plugin = this.cameraPlugins.get(cameraId);

    if (!plugin) {
      this.logger.log(
        `Instantiating new plugin instance for camera ${cameraId} (type: ${pluginType})`,
      );
      plugin = this.createPluginInstance(cameraId, pluginType, onStatusChange);
      this.cameraPlugins.set(cameraId, plugin);
    } else {
      if (plugin instanceof MockCameraPlugin && onStatusChange) {
        plugin.setStatusChangeHandler(onStatusChange);
      } else if (plugin instanceof RtspCameraPlugin && onStatusChange) {
        plugin.setStatusChangeHandler(onStatusChange);
      } else if (plugin instanceof OnvifCameraPlugin && onStatusChange) {
        plugin.setStatusChangeHandler(onStatusChange);
      }
    }

    return plugin;
  }

  async connect(
    cameraId: string,
    pluginType: string,
    config: CameraConnectionConfig,
    onStatusChange?: (status: CameraStatusValue) => void,
  ): Promise<CameraStatusValue> {
    const plugin = this.getOrCreatePlugin(cameraId, pluginType, onStatusChange);
    this.logger.log(
      `Connecting camera ${cameraId} using ${plugin.type} plugin...`,
    );
    await plugin.connect(config);
    return plugin.getStatus();
  }

  async disconnect(cameraId: string): Promise<CameraStatusValue> {
    const plugin = this.cameraPlugins.get(cameraId);
    if (!plugin) {
      return 'DISCONNECTED';
    }

    this.logger.log(`Disconnecting camera ${cameraId}...`);
    await plugin.disconnect();
    return plugin.getStatus();
  }

  async getStatus(
    cameraId: string,
    defaultStatus: CameraStatusValue = 'UNKNOWN',
  ): Promise<CameraStatusValue> {
    const plugin = this.cameraPlugins.get(cameraId);
    if (!plugin) {
      return defaultStatus;
    }
    return plugin.getStatus();
  }

  async getStreamSource(cameraId: string): Promise<StreamSource | null> {
    const plugin = this.cameraPlugins.get(cameraId);
    if (!plugin || !plugin.getStreamSource) {
      return null;
    }
    return plugin.getStreamSource();
  }

  async removePlugin(cameraId: string): Promise<void> {
    const plugin = this.cameraPlugins.get(cameraId);
    if (plugin) {
      try {
        await plugin.disconnect();
      } catch (err) {
        this.logger.warn(
          `Error disconnecting camera ${cameraId} on removal: ${(err as Error).message}`,
        );
      }
      this.cameraPlugins.delete(cameraId);
    }
  }

  private createPluginInstance(
    cameraId: string,
    pluginType: string,
    onStatusChange?: (status: CameraStatusValue) => void,
  ): CameraPlugin {
    switch (pluginType) {
      case 'MOCK':
        return new MockCameraPlugin(onStatusChange);
      case 'RTSP':
        return new RtspCameraPlugin(
          cameraId,
          this.streamingService,
          onStatusChange,
        );
      case 'ONVIF':
        return new OnvifCameraPlugin(
          cameraId,
          this.streamingService,
          onStatusChange,
        );
      default:
        throw new BadRequestException(
          `Unsupported camera plugin type: ${pluginType}`,
        );
    }
  }

  async discover(timeoutMs?: number): Promise<DiscoveredDevice[]> {
    this.logger.log(
      'Starting network device discovery via ONVIF WS-Discovery...',
    );
    return this.onvifDiscoveryService.discover(timeoutMs);
  }

  getPlugin(cameraId: string): CameraPlugin | undefined {
    return this.cameraPlugins.get(cameraId);
  }
}
