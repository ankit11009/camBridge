import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { PluginManagerService } from '../plugins/plugin-manager.service';
import { EventsService } from '../events/events.service';
import { CameraStatusValue } from '../plugins/camera-plugin.interface';
import { CreateCameraDto } from './dto/create-camera.dto';
import { UpdateCameraDto } from './dto/update-camera.dto';
import { Camera, CameraStatus, EventType, Prisma } from '@prisma/client';

export interface FormattedCamera extends Omit<Camera, 'connectionConfig'> {
  connectionConfig: Record<string, unknown>;
}

@Injectable()
export class CamerasService {
  private readonly logger = new Logger(CamerasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly pluginManager: PluginManagerService,
    private readonly eventsService: EventsService,
  ) {}

  async create(userId: string, dto: CreateCameraDto): Promise<FormattedCamera> {
    const encryptedConfig = this.encryption.encryptConfig(dto.connectionConfig);

    const camera = await this.prisma.camera.create({
      data: {
        ownerId: userId,
        name: dto.name,
        pluginType: dto.pluginType,
        connectionConfig: encryptedConfig as Prisma.InputJsonValue,
        status: CameraStatus.UNKNOWN,
      },
    });

    return this.formatCamera(camera);
  }

  async findAll(userId: string): Promise<FormattedCamera[]> {
    const cameras = await this.prisma.camera.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });

    return cameras.map((camera) => this.formatCamera(camera));
  }

  async findOne(userId: string, id: string): Promise<FormattedCamera> {
    const camera = await this.prisma.camera.findFirst({
      where: { id, ownerId: userId },
    });

    if (!camera) {
      throw new NotFoundException(`Camera with ID ${id} not found`);
    }

    return this.formatCamera(camera);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCameraDto,
  ): Promise<FormattedCamera> {
    // Verify existence and ownership
    await this.findOne(userId, id);

    const dataToUpdate: Prisma.CameraUpdateInput = {};

    if (dto.name !== undefined) {
      dataToUpdate.name = dto.name;
    }

    if (dto.connectionConfig !== undefined) {
      dataToUpdate.connectionConfig = this.encryption.encryptConfig(
        dto.connectionConfig,
      ) as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.camera.update({
      where: { id },
      data: dataToUpdate,
    });

    return this.formatCamera(updated);
  }

  async remove(
    userId: string,
    id: string,
  ): Promise<{ success: boolean; id: string }> {
    // Verify existence and ownership
    await this.findOne(userId, id);

    // Disconnect and remove plugin instance
    await this.pluginManager.removePlugin(id);

    await this.prisma.camera.delete({
      where: { id },
    });

    return { success: true, id };
  }

  /**
   * Triggers connection via the appropriate plugin and coordinates real-time status updates
   */
  async connect(
    userId: string,
    id: string,
  ): Promise<{
    id: string;
    status: CameraStatusValue;
    lastSeenAt: Date;
    streamSource?: any;
  }> {
    const camera = await this.findOne(userId, id);
    const now = new Date();

    // Callback invoked when plugin status transitions (e.g. CONNECTING -> CONNECTED / ERROR)
    const onStatusChange = async (newStatus: CameraStatusValue) => {
      const timestamp = new Date();
      try {
        await this.prisma.camera.update({
          where: { id },
          data: {
            status: newStatus as CameraStatus,
            lastSeenAt: timestamp,
          },
        });
      } catch (err) {
        this.logger.warn(
          `Failed to persist status transition for camera ${id}: ${(err as Error).message}`,
        );
      }
      this.eventsService.emitCameraStatus(id, newStatus, timestamp);
    };

    // Broadcast immediate CONNECTING state
    this.eventsService.emitCameraStatus(id, 'CONNECTING', now);
    await this.prisma.camera.update({
      where: { id },
      data: {
        status: CameraStatus.CONNECTING,
        lastSeenAt: now,
      },
    });

    // Delegate connect to PluginManager
    const finalStatus = await this.pluginManager.connect(
      id,
      camera.pluginType,
      camera.connectionConfig,
      onStatusChange,
    );

    const updatedTime = new Date();
    await this.prisma.camera.update({
      where: { id },
      data: {
        status: finalStatus as CameraStatus,
        lastSeenAt: updatedTime,
      },
    });
    this.eventsService.emitCameraStatus(id, finalStatus, updatedTime);

    const streamSource = await this.pluginManager.getStreamSource(id);

    return {
      id,
      status: finalStatus,
      lastSeenAt: updatedTime,
      streamSource,
    };
  }

  /**
   * Triggers disconnection via plugin and broadcasts status
   */
  async disconnect(
    userId: string,
    id: string,
  ): Promise<{ id: string; status: CameraStatusValue }> {
    await this.findOne(userId, id);

    const finalStatus = await this.pluginManager.disconnect(id);
    const now = new Date();

    await this.prisma.camera.update({
      where: { id },
      data: {
        status: finalStatus as CameraStatus,
        lastSeenAt: now,
      },
    });

    this.eventsService.emitCameraStatus(id, finalStatus, now);

    return {
      id,
      status: finalStatus,
    };
  }

  /**
   * Retrieves live status of a camera from its plugin
   */
  async getStatus(
    userId: string,
    id: string,
  ): Promise<{ id: string; status: CameraStatusValue }> {
    const camera = await this.findOne(userId, id);
    const status = await this.pluginManager.getStatus(
      id,
      camera.status as CameraStatusValue,
    );

    return {
      id,
      status,
    };
  }

  /**
   * Retrieves the current stream source (e.g. HLS playlist URL) for a camera
   */
  async getStreamSource(userId: string, id: string) {
    await this.findOne(userId, id);
    const streamSource = await this.pluginManager.getStreamSource(id);
    return {
      id,
      streamSource,
    };
  }

  /**
   * Discovers ONVIF cameras on the local network
   */
  async discoverCameras() {
    return this.pluginManager.discover();
  }

  /**
   * Queries stored events for a camera
   */
  async getCameraEvents(
    userId: string,
    cameraId: string,
    limit?: number,
    type?: EventType,
  ) {
    await this.findOne(userId, cameraId);
    return this.eventsService.getEvents(cameraId, limit, type);
  }

  /**
   * Triggers a simulated event (e.g. MOTION) for a camera and persists/broadcasts it
   */
  async triggerCameraEvent(
    userId: string,
    cameraId: string,
    type: EventType = 'MOTION',
    payload?: Record<string, any>,
  ) {
    await this.findOne(userId, cameraId);
    const eventPayload = payload ?? {
      message: 'Motion detected in active zone',
      confidence: 0.95,
      source: 'motion_detector',
      timestamp: new Date().toISOString(),
    };

    return this.eventsService.recordAndEmitEvent(cameraId, type, eventPayload);
  }

  private formatCamera(camera: Camera): FormattedCamera {
    const decryptedConfig = this.encryption.decryptConfig(
      camera.connectionConfig as Record<string, unknown>,
    );

    return {
      ...camera,
      connectionConfig: decryptedConfig,
    };
  }
}
