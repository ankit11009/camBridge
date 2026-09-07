import { RtspCameraPlugin } from './rtsp-camera.plugin';
import { StreamingService } from '../../streaming/streaming.service';

describe('RtspCameraPlugin', () => {
  let plugin: RtspCameraPlugin;
  let mockStreamingService: Partial<StreamingService>;

  beforeEach(() => {
    mockStreamingService = {
      startStream: jest.fn().mockReturnValue({
        url: '/streams/cam-1/stream.m3u8',
        protocol: 'hls',
      }),
      stopStream: jest.fn().mockReturnValue(true),
      getStreamSource: jest.fn().mockReturnValue({
        url: '/streams/cam-1/stream.m3u8',
        protocol: 'hls',
      }),
    };

    plugin = new RtspCameraPlugin(
      'cam-1',
      mockStreamingService as StreamingService,
    );
  });

  it('should have type RTSP and initial status UNKNOWN', async () => {
    expect(plugin.type).toBe('RTSP');
    expect(await plugin.getStatus()).toBe('UNKNOWN');
  });

  it('should throw and set status to ERROR if rtspUrl is invalid or missing', async () => {
    await expect(plugin.connect({})).rejects.toThrow();
    expect(await plugin.getStatus()).toBe('ERROR');

    await expect(
      plugin.connect({ rtspUrl: 'http://invalid-scheme' }),
    ).rejects.toThrow();
    expect(await plugin.getStatus()).toBe('ERROR');
  });

  it('should start stream and transition to CONNECTED on valid rtspUrl', async () => {
    await plugin.connect({
      rtspUrl:
        'rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4',
    });

    expect(mockStreamingService.startStream).toHaveBeenCalledWith(
      'cam-1',
      'rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4',
      expect.any(Function),
    );
    expect(await plugin.getStatus()).toBe('CONNECTED');
  });

  it('should inject username and password into rtspUrl if separate', async () => {
    await plugin.connect({
      rtspUrl: 'rtsp://192.168.1.100:554/live',
      username: 'admin',
      password: 'password123',
    });

    expect(mockStreamingService.startStream).toHaveBeenCalledWith(
      'cam-1',
      'rtsp://admin:password123@192.168.1.100:554/live',
      expect.any(Function),
    );
  });

  it('should stop stream and transition to DISCONNECTED on disconnect', async () => {
    await plugin.connect({ rtspUrl: 'rtsp://192.168.1.100:554/live' });
    await plugin.disconnect();

    expect(mockStreamingService.stopStream).toHaveBeenCalledWith('cam-1');
    expect(await plugin.getStatus()).toBe('DISCONNECTED');
  });

  it('should return stream source', async () => {
    const source = await plugin.getStreamSource();
    expect(source.protocol).toBe('hls');
    expect(source.url).toBe('/streams/cam-1/stream.m3u8');
  });
});
