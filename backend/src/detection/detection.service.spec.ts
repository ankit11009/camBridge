import { Test, TestingModule } from '@nestjs/testing';
import { DetectionService } from './detection.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
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

  afterEach(() => {
    service.onModuleDestroy();
    jest.restoreAllMocks();
  });

  it('rejects missing frames instead of fabricating detections', async () => {
    await expect(service.runDetectionInference(null, 'RTSP')).rejects.toThrow(
      'No video frame',
    );
    expect(eventsService.recordAndEmitEvent).not.toHaveBeenCalled();
  });

  it('keeps an empty inference result without fabricating a fallback', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(service as any, 'invokeExternalDetector').mockResolvedValue([]);
    await expect(
      service.runDetectionInference('/frame.jpg', 'RTSP'),
    ).resolves.toEqual([]);
  });

  it('reports a detector failure without emitting invented results', async () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest
      .spyOn(service as any, 'invokeExternalDetector')
      .mockRejectedValue(new Error('Python unavailable'));
    await expect(
      service.runDetectionInference('/frame.jpg', 'RTSP'),
    ).rejects.toThrow('YOLO unavailable');
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

      jest.spyOn(service, 'runDetectionInference').mockResolvedValue([
        {
          label: 'person',
          confidence: 0.9,
          box: { x: 1, y: 2, width: 3, height: 4 },
        },
      ]);
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

      jest.spyOn(service, 'runDetectionInference').mockResolvedValue([
        {
          label: 'person',
          confidence: 0.9,
          box: { x: 1, y: 2, width: 3, height: 4 },
        },
      ]);
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

  describe('Automated Detection Mode', () => {
    beforeEach(() => {
      jest.spyOn(service, 'runDetectionInference').mockResolvedValue([]);
    });
    it('arms detection mode and returns active status when camera is CONNECTED', async () => {
      prisma.camera.findFirst.mockResolvedValue({
        id: 'cam-auto-1',
        ownerId: 'user-1',
        status: 'CONNECTED',
        pluginType: PluginType.MOCK,
      });

      const status = await service.toggleDetectionMode(
        'user-1',
        'cam-auto-1',
        true,
        3000,
      );

      expect(status.enabled).toBe(true);
      expect(status.running).toBe(true);
      expect(status.intervalMs).toBe(3000);

      const queried = await service.getDetectionStatus('user-1', 'cam-auto-1');
      expect(queried.enabled).toBe(true);
      expect(queried.running).toBe(true);
    });

    it('disarms detection mode cleanly when toggled off', async () => {
      prisma.camera.findFirst.mockResolvedValue({
        id: 'cam-auto-1',
        ownerId: 'user-1',
        status: 'CONNECTED',
        pluginType: PluginType.MOCK,
      });

      await service.toggleDetectionMode('user-1', 'cam-auto-1', true, 4000);
      const disarmed = await service.toggleDetectionMode(
        'user-1',
        'cam-auto-1',
        false,
      );

      expect(disarmed.enabled).toBe(false);
      expect(disarmed.running).toBe(false);

      const queried = await service.getDetectionStatus('user-1', 'cam-auto-1');
      expect(queried.enabled).toBe(false);
      expect(queried.running).toBe(false);
    });

    it('throws NotFoundException when toggling unknown camera', async () => {
      prisma.camera.findFirst.mockResolvedValue(null);

      await expect(
        service.toggleDetectionMode('user-1', 'cam-unknown', true),
      ).rejects.toThrow(NotFoundException);
    });
  });
  it('emits selected-zone person notifications with a cooldown', async () => {
    prisma.camera.findFirst.mockResolvedValue({ id: 'cam-1', name: 'Driveway', status: 'CONNECTED', pluginType: 'RTSP' });
    const zone = { x: 0, y: 0, width: 0.5, height: 1 };
    (service as any).detectionStates.set('cam-1', { enabled: true, zone });
    const inference = jest.spyOn(service, 'runDetectionInference').mockResolvedValue([
      { label: 'person', confidence: 0.9, box: { x: 1, y: 1, width: 10, height: 10 } },
    ]);
    await (service as any).runMonitoringTick('user-1', 'cam-1');
    await (service as any).runMonitoringTick('user-1', 'cam-1');
    expect(inference).toHaveBeenCalledWith(null, 'RTSP', zone);
    expect(eventsService.recordAndEmitEvent).toHaveBeenCalledTimes(1);
    expect(eventsService.recordAndEmitEvent).toHaveBeenCalledWith('cam-1', 'DETECTION', expect.objectContaining({ zone, cameraName: 'Driveway', eventType: 'PERSON_ENTERED' }));
    inference.mockResolvedValue([]);
    await (service as any).runMonitoringTick('user-1', 'cam-1');
    expect(eventsService.recordAndEmitEvent).toHaveBeenCalledTimes(1);
    await (service as any).runMonitoringTick('user-1', 'cam-1');
    expect(eventsService.recordAndEmitEvent).toHaveBeenLastCalledWith('cam-1', 'DETECTION', expect.objectContaining({ eventType: 'PERSON_EXITED', personCount: 0 }));
    await (service as any).runMonitoringTick('user-1', 'cam-1');
    expect(eventsService.recordAndEmitEvent).toHaveBeenCalledTimes(2);

  });

  it('does not emit an in-flight result after detection is switched off', async () => {
    prisma.camera.findFirst.mockResolvedValue({ status: 'CONNECTED', pluginType: 'RTSP' });
    (service as any).detectionStates.set('cam-1', { enabled: true });
    let finish!: (value: any) => void;
    jest.spyOn(service, 'runDetectionInference').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const tick = (service as any).runMonitoringTick('user-1', 'cam-1');
    await Promise.resolve();
    await service.toggleDetectionMode('user-1', 'cam-1', false);
    finish([{ label: 'person', confidence: 0.9, box: { x: 0, y: 0, width: 1, height: 1 } }]);
    await tick;
    expect(eventsService.recordAndEmitEvent).not.toHaveBeenCalled();
  });

  it('rejects a zone outside the video', async () => {
    prisma.camera.findFirst.mockResolvedValue({ status: 'CONNECTED' });
    await expect(service.toggleDetectionMode('user-1', 'cam-1', true, 2000,
      { x: 0.9, y: 0, width: 0.5, height: 1 })).rejects.toThrow('Zone must fit');
  });

});
