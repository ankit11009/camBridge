import { OnvifCameraPlugin } from './onvif-camera.plugin';
import { StreamingService } from '../../streaming/streaming.service';

describe('OnvifCameraPlugin', () => {
  let plugin: OnvifCameraPlugin;
  let mockStreamingService: Partial<StreamingService>;

  beforeEach(() => {
    mockStreamingService = {
      startStream: jest.fn().mockReturnValue({
        url: '/streams/onvif-cam-1/stream.m3u8',
        protocol: 'hls',
      }),
      stopStream: jest.fn().mockReturnValue(true),
      getStreamSource: jest.fn().mockReturnValue({
        url: '/streams/onvif-cam-1/stream.m3u8',
        protocol: 'hls',
      }),
    };

    plugin = new OnvifCameraPlugin(
      'onvif-cam-1',
      mockStreamingService as StreamingService,
    );
  });

  it('initializes with type ONVIF and UNKNOWN status', async () => {
    expect(plugin.type).toBe('ONVIF');
    expect(await plugin.getStatus()).toBe('UNKNOWN');
  });

  describe('resolveStreamUrl', () => {
    it('uses provided rtspUrl directly', () => {
      const url = plugin.resolveStreamUrl({
        rtspUrl: 'rtsp://192.168.1.50:554/live/ch0',
      });
      expect(url).toBe('rtsp://192.168.1.50:554/live/ch0');
    });

    it('injects credentials into rtspUrl when provided separately', () => {
      const url = plugin.resolveStreamUrl({
        rtspUrl: 'rtsp://192.168.1.50:554/live/ch0',
        username: 'admin',
        password: 'password123',
      });
      expect(url).toBe('rtsp://admin:password123@192.168.1.50:554/live/ch0');
    });

    it('derives stream URL from deviceUrl and streamPath', () => {
      const url = plugin.resolveStreamUrl({
        deviceUrl: 'http://192.168.1.80:80/onvif/device_service',
        username: 'admin',
        password: 'secret',
        streamPath: 'h264Preview_01_main',
      });
      expect(url).toBe(
        'rtsp://admin:secret@192.168.1.80:554/h264Preview_01_main',
      );
    });

    it('throws error if neither rtspUrl nor deviceUrl is provided', () => {
      expect(() => plugin.resolveStreamUrl({})).toThrow(
        'Invalid ONVIF configuration',
      );
    });
  });

  describe('connect', () => {
    it('connects successfully and calls streamingService.startStream', async () => {
      const statusChanges: string[] = [];
      plugin.setStatusChangeHandler((status) => statusChanges.push(status));

      await plugin.connect({
        rtspUrl: 'rtsp://192.168.1.50:554/live/ch0',
      });

      expect(statusChanges).toContain('CONNECTING');
      expect(statusChanges).toContain('CONNECTED');
      expect(await plugin.getStatus()).toBe('CONNECTED');
      expect(mockStreamingService.startStream).toHaveBeenCalledWith(
        'onvif-cam-1',
        'rtsp://192.168.1.50:554/live/ch0',
        expect.any(Function),
      );
    });

    it('transitions to ERROR and rethrows if resolution fails', async () => {
      await expect(plugin.connect({})).rejects.toThrow();
      expect(await plugin.getStatus()).toBe('ERROR');
    });
  });

  describe('disconnect', () => {
    it('stops stream and transitions to DISCONNECTED', async () => {
      await plugin.connect({
        rtspUrl: 'rtsp://192.168.1.50:554/live/ch0',
      });
      await plugin.disconnect();

      expect(mockStreamingService.stopStream).toHaveBeenCalledWith(
        'onvif-cam-1',
      );
      expect(await plugin.getStatus()).toBe('DISCONNECTED');
    });
  });

  describe('getStreamSource', () => {
    it('returns stream source from streamingService', async () => {
      const source = await plugin.getStreamSource();
      expect(source).toEqual({
        url: '/streams/onvif-cam-1/stream.m3u8',
        protocol: 'hls',
      });
    });
  });
});
