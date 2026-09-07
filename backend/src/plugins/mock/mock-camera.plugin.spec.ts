import { MockCameraPlugin } from './mock-camera.plugin';
import { CameraStatusValue } from '../camera-plugin.interface';

describe('MockCameraPlugin', () => {
  let plugin: MockCameraPlugin;
  let statusEvents: CameraStatusValue[];

  beforeEach(() => {
    statusEvents = [];
    plugin = new MockCameraPlugin((status) => {
      statusEvents.push(status);
    });
  });

  it('should initialize with UNKNOWN status', async () => {
    expect(await plugin.getStatus()).toBe('UNKNOWN');
    expect(plugin.type).toBe('MOCK');
  });

  it('should transition CONNECTING -> CONNECTED on successful connect', async () => {
    const connectPromise = plugin.connect({ connectDelayMs: 10 });

    // Should immediately transition to CONNECTING
    expect(await plugin.getStatus()).toBe('CONNECTING');
    expect(statusEvents).toContain('CONNECTING');

    await connectPromise;

    // After resolution, status should be CONNECTED
    expect(await plugin.getStatus()).toBe('CONNECTED');
    expect(statusEvents).toEqual(['CONNECTING', 'CONNECTED']);
  });

  it('should transition CONNECTING -> ERROR if simulateError is true', async () => {
    await plugin.connect({ connectDelayMs: 10, simulateError: true });

    expect(await plugin.getStatus()).toBe('ERROR');
    expect(statusEvents).toEqual(['CONNECTING', 'ERROR']);
  });

  it('should transition to DISCONNECTED on disconnect', async () => {
    await plugin.connect({ connectDelayMs: 10 });
    await plugin.disconnect();

    expect(await plugin.getStatus()).toBe('DISCONNECTED');
    expect(statusEvents).toContain('DISCONNECTED');
  });

  it('should provide stream source', async () => {
    const stream = await plugin.getStreamSource();
    expect(stream.protocol).toBe('hls');
    expect(stream.url).toBeDefined();
  });
});
