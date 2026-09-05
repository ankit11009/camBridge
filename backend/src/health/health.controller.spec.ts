import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceUnavailableException } from '@nestjs/common';

describe('HealthController', () => {
  let controller: HealthController;
  let prismaService: jest.Mocked<Partial<PrismaService>>;

  beforeEach(async () => {
    prismaService = {
      isDatabaseHealthy: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return ok when database is healthy', async () => {
    (prismaService.isDatabaseHealthy as jest.Mock).mockResolvedValue(true);

    const result = await controller.getHealth();
    expect(result.status).toBe('ok');
    expect(result.database).toBe('connected');
    expect(result.timestamp).toBeDefined();
  });

  it('should throw ServiceUnavailableException when database is unhealthy', async () => {
    (prismaService.isDatabaseHealthy as jest.Mock).mockResolvedValue(false);

    await expect(controller.getHealth()).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
