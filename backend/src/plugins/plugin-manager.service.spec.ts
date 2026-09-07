import { Test, TestingModule } from '@nestjs/testing';
import { PluginManagerService } from './plugin-manager.service';
import { BadRequestException } from '@nestjs/common';

describe('PluginManagerService', () => {
  let service: PluginManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PluginManagerService],
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

  it('should throw BadRequestException for unknown plugin types', () => {
    expect(() => service.getOrCreatePlugin('cam-1', 'INVALID_TYPE')).toThrow(
      BadRequestException,
    );
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
