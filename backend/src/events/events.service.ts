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
    this.recordAndEmitEvent(cameraId, 'STATUS', { status, lastSeenAt }).catch(
      (err) => {
        this.logger.debug(
          `Status event recording skipped: ${(err as Error).message}`,
        );
      },
    );
  }

  async recordAndEmitEvent(
    cameraId: string,
    type: 'STATUS' | 'MOTION' | 'DETECTION',
    payload: unknown,
  ) {
    let savedEvent = null;
    try {
      savedEvent = await this.prisma.event.create({
        data: {
          cameraId,
          type,
          payload: (payload ?? {}) as any,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Could not persist event for camera ${cameraId}: ${(err as Error).message}`,
      );
    }

    this.gateway.broadcastCameraEvent(
      cameraId,
      type,
      payload,
      savedEvent?.createdAt,
    );
    return savedEvent;
  }

  async getEvents(
    cameraId: string,
    limit = 50,
    type?: 'STATUS' | 'MOTION' | 'DETECTION',
  ) {
    const where: any = { cameraId };
    if (type) {
      where.type = type;
    }
    return this.prisma.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(1, limit), 100),
    });
  }
}
