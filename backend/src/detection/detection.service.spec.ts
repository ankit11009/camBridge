import { Test, TestingModule } from '@nestjs/testing';
import { DetectionService } from './detection.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { NotFoundException } from '@nestjs/common';
import { PluginType } from '@prisma/client';

describe('DetectionService', () => {
  let service: DetectionService;
  let prisma: {
    camera: {
      findFirst: jest.Mock;
    };
    recording: {
      findFirst: jest.Mock;
    };
  };
  let eventsService: {
    recordAndEmitEvent: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      camera: {
        findFirst: jest.fn(),
      },
      recording: {
        findFirst: jest.fn(),
      },
    };

    eventsService = {
      recordAndEmitEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DetectionService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: EventsService,
          useValue: eventsService,
        },
      ],
    }).compile();

    service = module.get<DetectionService>(DetectionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('analyzeCamera', () => {
    it('runs detection on live camera feed and records DETECTION event with person label', async () => {
      prisma.camera.findFirst.mockResolvedValue({
        id: 'cam-ai-1',
        ownerId: 'user-1',
        pluginType: PluginType.MOCK,
      });

      eventsService.recordAndEmitEvent.mockImplementation(
        (cameraId, type, payload) =>
          Promise.resolve({
            id: 'event-ai-1',
            cameraId,
            type,
            payload,
            createdAt: new Date(),
          }),
      );

      const result = await service.analyzeCamera('user-1', 'cam-ai-1');

      expect(prisma.camera.findFirst).toHaveBeenCalledWith({
        where: { id: 'cam-ai-1', ownerId: 'user-1' },
      });

      expect(eventsService.recordAndEmitEvent).toHaveBeenCalledWith(
        'cam-ai-1',
        'DETECTION',
        expect.objectContaining({
          source: 'live_frame',
          sourceId: 'cam-ai-1',
          detections: expect.arrayContaining([
            expect.objectContaining({
              label: 'person',
              confidence: expect.any(Number),
              box: expect.objectContaining({
                x: expect.any(Number),
                y: expect.any(Number),
                width: expect.any(Number),
                height: expect.any(Number),
              }),
            }),
          ]),
        }),
      );

      expect(result.id).toBe('event-ai-1');
      expect(result.type).toBe('DETECTION');
    });

    it('throws NotFoundException when camera does not exist or belong to user', async () => {
      prisma.camera.findFirst.mockResolvedValue(null);

      await expect(
        service.analyzeCamera('user-1', 'cam-nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('analyzeRecording', () => {
    it('runs detection on recorded MP4 clip and persists DETECTION event', async () => {
      prisma.camera.findFirst.mockResolvedValue({
        id: 'cam-ai-1',
        ownerId: 'user-1',
        pluginType: PluginType.MOCK,
      });

      prisma.recording.findFirst.mockResolvedValue({
        id: 'rec-ai-100',
        cameraId: 'cam-ai-1',
        filePath: '/tmp/rec_ai_100.mp4',
      });

      eventsService.recordAndEmitEvent.mockImplementation(
        (cameraId, type, payload) =>
          Promise.resolve({
            id: 'event-ai-rec',
            cameraId,
            type,
            payload,
            createdAt: new Date(),
          }),
      );

      const result = await service.analyzeRecording(
        'user-1',
        'cam-ai-1',
        'rec-ai-100',
      );

      expect(prisma.recording.findFirst).toHaveBeenCalledWith({
        where: { id: 'rec-ai-100', cameraId: 'cam-ai-1' },
      });

      expect(eventsService.recordAndEmitEvent).toHaveBeenCalledWith(
        'cam-ai-1',
        'DETECTION',
        expect.objectContaining({
          source: 'recording_clip',
          sourceId: 'rec-ai-100',
          detections: expect.arrayContaining([
            expect.objectContaining({
              label: 'person',
            }),
          ]),
        }),
      );

      expect(result.id).toBe('event-ai-rec');
    });

    it('throws NotFoundException if recording is not found', async () => {
      prisma.camera.findFirst.mockResolvedValue({
        id: 'cam-ai-1',
        ownerId: 'user-1',
      });
      prisma.recording.findFirst.mockResolvedValue(null);

      await expect(
        service.analyzeRecording('user-1', 'cam-ai-1', 'rec-missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
