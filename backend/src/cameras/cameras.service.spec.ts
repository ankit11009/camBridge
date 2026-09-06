import { Test, TestingModule } from '@nestjs/testing';
import { CamerasService } from './cameras.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { PluginType, CameraStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';

describe('CamerasService', () => {
  let service: CamerasService;
  let prisma: {
    camera: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let encryption: {
    encryptConfig: jest.Mock;
    decryptConfig: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      camera: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    encryption = {
      encryptConfig: jest
        .fn()
        .mockImplementation((cfg) => ({ _encrypted: 'enc', ...cfg })),
      decryptConfig: jest.fn().mockImplementation((cfg) => cfg),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CamerasService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: EncryptionService,
          useValue: encryption,
        },
      ],
    }).compile();

    service = module.get<CamerasService>(CamerasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create camera and encrypt connection config', async () => {
      const mockCreated = {
        id: 'cam-1',
        ownerId: 'user-1',
        name: 'Driveway',
        pluginType: PluginType.MOCK,
        connectionConfig: { _encrypted: 'enc' },
        status: CameraStatus.UNKNOWN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.camera.create.mockResolvedValue(mockCreated);

      const result = await service.create('user-1', {
        name: 'Driveway',
        pluginType: PluginType.MOCK,
        connectionConfig: { interval: 1000 },
      });

      expect(encryption.encryptConfig).toHaveBeenCalledWith({ interval: 1000 });
      expect(prisma.camera.create).toHaveBeenCalled();
      expect(result.id).toBe('cam-1');
      expect(result.name).toBe('Driveway');
    });
  });

  describe('findAll', () => {
    it('should return list of cameras for user', async () => {
      const mockCameras = [
        {
          id: 'cam-1',
          ownerId: 'user-1',
          name: 'Backyard',
          pluginType: PluginType.MOCK,
          connectionConfig: {},
          status: CameraStatus.UNKNOWN,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prisma.camera.findMany.mockResolvedValue(mockCameras);

      const results = await service.findAll('user-1');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Backyard');
    });
  });

  describe('findOne', () => {
    it('should return a camera if found and owned by user', async () => {
      const mockCam = {
        id: 'cam-1',
        ownerId: 'user-1',
        name: 'Backyard',
        pluginType: PluginType.MOCK,
        connectionConfig: {},
        status: CameraStatus.UNKNOWN,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.camera.findFirst.mockResolvedValue(mockCam);

      const result = await service.findOne('user-1', 'cam-1');
      expect(result.id).toBe('cam-1');
    });

    it('should throw NotFoundException if camera does not exist', async () => {
      prisma.camera.findFirst.mockResolvedValue(null);

      await expect(service.findOne('user-1', 'cam-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
