import { Test, TestingModule } from '@nestjs/testing';
import { RecordingsService } from './recordings.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { RecordingTrigger } from '@prisma/client';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('RecordingsService', () => {
  let service: RecordingsService;
  let prisma: {
    camera: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
    };
    recording: {
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      camera: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      recording: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordingsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('/tmp/cambridge-test-recordings'),
          },
        },
      ],
    }).compile();

    service = module.get<RecordingsService>(RecordingsService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startRecording', () => {
    it('starts manual recording session and persists record in database', async () => {
      prisma.camera.findFirst.mockResolvedValue({
        id: 'cam-rec-1',
        ownerId: 'user-1',
      });

      prisma.recording.create.mockResolvedValue({
        id: 'rec-1',
        cameraId: 'cam-rec-1',
        filePath: '/tmp/cambridge-test-recordings/cam-rec-1/rec_123.mp4',
        triggeredBy: RecordingTrigger.MANUAL,
        startedAt: new Date(),
        endedAt: null,
      });

      const recording = await service.startRecording('user-1', 'cam-rec-1');

      expect(recording.id).toBe('rec-1');
      expect(recording.trigger).toBe(RecordingTrigger.MANUAL);
      expect(recording.videoUrl).toContain('/recordings/cam-rec-1/rec_123.mp4');
      expect(service.isRecording('cam-rec-1')).toBe(true);
    });

    it('throws NotFoundException if camera does not belong to user', async () => {
      prisma.camera.findFirst.mockResolvedValue(null);

      await expect(
        service.startRecording('user-other', 'cam-not-found'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if camera is already recording', async () => {
      prisma.camera.findFirst.mockResolvedValue({
        id: 'cam-rec-1',
        ownerId: 'user-1',
      });
      prisma.recording.create.mockResolvedValue({
        id: 'rec-1',
        cameraId: 'cam-rec-1',
        filePath: '/tmp/cam-rec-1/rec.mp4',
        trigger: RecordingTrigger.MANUAL,
        startedAt: new Date(),
      });

      await service.startRecording('user-1', 'cam-rec-1');

      await expect(
        service.startRecording('user-1', 'cam-rec-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('stopRecording', () => {
    it('stops active recording and updates duration and size', async () => {
      prisma.camera.findFirst.mockResolvedValue({
        id: 'cam-rec-1',
        ownerId: 'user-1',
      });
      prisma.recording.create.mockResolvedValue({
        id: 'rec-1',
        cameraId: 'cam-rec-1',
        filePath: '/tmp/cambridge-test-recordings/cam-rec-1/rec.mp4',
        triggeredBy: RecordingTrigger.MANUAL,
        startedAt: new Date(Date.now() - 5000),
      });

      await service.startRecording('user-1', 'cam-rec-1');

      prisma.recording.update.mockResolvedValue({
        id: 'rec-1',
        cameraId: 'cam-rec-1',
        filePath: '/tmp/cambridge-test-recordings/cam-rec-1/rec.mp4',
        triggeredBy: RecordingTrigger.MANUAL,
        startedAt: new Date(Date.now() - 5000),
        endedAt: new Date(),
      });

      const stopped = await service.stopRecording('user-1', 'cam-rec-1');

      expect(stopped.id).toBe('rec-1');
      expect(stopped.duration).toBeGreaterThanOrEqual(1);
      expect(service.isRecording('cam-rec-1')).toBe(false);
    });

    it('throws BadRequestException when stopping a non-active recording', async () => {
      prisma.camera.findFirst.mockResolvedValue({
        id: 'cam-idle',
        ownerId: 'user-1',
      });

      await expect(service.stopRecording('user-1', 'cam-idle')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('listRecordings', () => {
    it('returns formatted historical recordings for a camera', async () => {
      prisma.camera.findFirst.mockResolvedValue({
        id: 'cam-1',
        ownerId: 'user-1',
      });

      const start = new Date(Date.now() - 30000);
      const end = new Date();

      prisma.recording.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          cameraId: 'cam-1',
          filePath: '/recordings/cam-1/clip1.mp4',
          triggeredBy: RecordingTrigger.EVENT,
          startedAt: start,
          endedAt: end,
          sizeBytes: 5242880,
        },
      ]);

      const list = await service.listRecordings('user-1', 'cam-1');
      expect(list).toHaveLength(1);
      expect(list[0].sizeBytes).toBe(5242880);
      expect(list[0].trigger).toBe('EVENT');
      expect(list[0].videoUrl).toBe('/recordings/cam-1/clip1.mp4');
    });
  });

  describe('cleanUpOldRecordings', () => {
    it('deletes expired recordings from disk and database', async () => {
      prisma.recording.findMany.mockResolvedValue([
        {
          id: 'rec-old-1',
          filePath: '/tmp/nonexistent-old-file.mp4',
        },
      ]);
      prisma.recording.deleteMany.mockResolvedValue({ count: 1 });

      const deleted = await service.cleanUpOldRecordings(7);

      expect(deleted).toBe(1);
      expect(prisma.recording.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['rec-old-1'] } },
      });
    });
  });
});
