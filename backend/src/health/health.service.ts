import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async checkHealth() {
    const isDbHealthy = await this.prisma.isDatabaseHealthy();

    if (!isDbHealthy) {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      });
    }

    return {
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString(),
    };
  }
}
