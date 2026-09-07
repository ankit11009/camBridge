import { Test, TestingModule } from '@nestjs/testing';
import { PluginManagerService } from './plugin-manager.service';
import { StreamingService } from '../streaming/streaming.service';
import { OnvifDiscoveryService } from './onvif/onvif-discovery.service';
import { BadRequestException } from '@nestjs/common';

describe('PluginManagerService', () => {
  let service: PluginManagerService;
  let mockStreamingService: Partial<StreamingService>;
  let mockOnvifDiscoveryService: Partial<OnvifDiscoveryService>;

  beforeEach(async () => {
    mockStreamingService = {
      startStream: jest
        .fn()
        .mockReturnValue({ url: '/streams/cam/stream.m3u8', protocol: 'hls' }),
      stopStream: jest.fn().mockReturnValue(true),
      getStreamSource: jest
        .fn()
        .mockReturnValue({ url: '/streams/cam/stream.m3u8', protocol: 'hls' }),
    };

    mockOnvifDiscoveryService = {
      discover: jest.fn().mockResolvedValue([
        {
          id: 'dev-1',
          name: 'Living Room ONVIF Cam',
          address: 'http://192.168.1.100:80/onvif/device_service',
          metadata: {},
        },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PluginManagerService,
        {
          provide: StreamingService,
          useValue: mockStreamingService,
        },
        {
          provide: OnvifDiscoveryService,
          useValue: mockOnvifDiscoveryService,
        },
      ],
    }).compile();

    service = module.get<PluginManagerService>(PluginManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create independent plugin instances per camera ID', () => {
    const plugin1 = service.getOrCreatePlugin('cam-1', 'MOCK');
    const plugin2 = service.getOrCreatePlugin('cam-2', 'MOCK');
    const plugin1Again = service.getOrCreatePlugin('cam-1', 'MOCK');

    expect(plugin1).not.toBe(plugin2);
    expect(plugin1).toBe(plugin1Again);
  });

  it('should instantiate RtspCameraPlugin for RTSP type', () => {
    const plugin = service.getOrCreatePlugin('cam-rtsp', 'RTSP');
    expect(plugin.type).toBe('RTSP');
  });

  it('should instantiate OnvifCameraPlugin for ONVIF type', () => {
    const plugin = service.getOrCreatePlugin('cam-onvif', 'ONVIF');
    expect(plugin.type).toBe('ONVIF');
  });

  it('should throw BadRequestException for unknown plugin types', () => {
    expect(() => service.getOrCreatePlugin('cam-1', 'INVALID_TYPE')).toThrow(
      BadRequestException,
    );
  });

  it('should delegate discovery to OnvifDiscoveryService', async () => {
    const devices = await service.discover(100);
    expect(devices).toHaveLength(1);
    expect(devices[0].name).toBe('Living Room ONVIF Cam');
    expect(mockOnvifDiscoveryService.discover).toHaveBeenCalledWith(100);
  });

  it('should connect and disconnect camera through plugin', async () => {
    const status = await service.connect('cam-1', 'MOCK', {
      connectDelayMs: 10,
    });
    expect(status).toBe('CONNECTED');

    const checkStatus = await service.getStatus('cam-1');
    expect(checkStatus).toBe('CONNECTED');

    const disconnectStatus = await service.disconnect('cam-1');
    expect(disconnectStatus).toBe('DISCONNECTED');
  });

  it('should handle removal of plugin instance', async () => {
    await service.connect('cam-1', 'MOCK', { connectDelayMs: 10 });
    await service.removePlugin('cam-1');

    const statusAfter = await service.getStatus('cam-1', 'UNKNOWN');
    expect(statusAfter).toBe('UNKNOWN');
  });
});
