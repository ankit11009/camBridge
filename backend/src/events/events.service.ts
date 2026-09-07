import { Injectable, Logger } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly gateway: EventsGateway,
    private readonly prisma: PrismaService,
  ) {}

  emitCameraStatus(
    cameraId: string,
    status: string,
    lastSeenAt?: string | Date | null,
  ) {
    this.logger.log(`Emitting camera:status for ${cameraId} -> ${status}`);
    this.gateway.broadcastCameraStatus(cameraId, status, lastSeenAt);
  }

  async recordAndEmitEvent(
    cameraId: string,
    type: 'STATUS' | 'MOTION' | 'DETECTION',
    payload: unknown,
  ) {
    this.gateway.broadcastCameraEvent(cameraId, type, payload);
    // Optionally persist event row if Prisma is available
    try {
      await this.prisma.event.create({
        data: {
          cameraId,
          type,
          payload: payload as any,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Could not persist event for camera ${cameraId}: ${(err as Error).message}`,
      );
    }
  }
}
