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
    search?: string,
    startDate?: Date | string,
    endDate?: Date | string,
  ) {
    const where: any = { cameraId };
    if (type) {
      where.type = type;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }
    const events = await this.prisma.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(1, limit), 100),
    });

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      return events.filter((ev) => {
        const payloadStr = JSON.stringify(ev.payload || {}).toLowerCase();
        return ev.type.toLowerCase().includes(q) || payloadStr.includes(q);
      });
    }

    return events;
  }
}
