import { Test, TestingModule } from '@nestjs/testing';
import { FfmpegService } from './ffmpeg.service';
import * as child_process from 'child_process';
import { EventEmitter } from 'events';

describe('FfmpegService', () => {
  let service: FfmpegService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FfmpegService],
    }).compile();

    service = module.get<FfmpegService>(FfmpegService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should spawn ffmpeg process and track its PID', () => {
    const mockProcess = Object.assign(new EventEmitter(), {
      pid: 12345,
      killed: false,
      kill: jest.fn().mockImplementation(() => {
        mockProcess.killed = true;
        return true;
      }),
      stderr: new EventEmitter(),
    });

    const spySpawn = jest
      .spyOn(child_process, 'spawn')
      .mockReturnValue(mockProcess as any);

    const info = service.startStream(
      'cam-1',
      'rtsp://127.0.0.1:8554/live',
      '/tmp/streams/cam-1',
    );

    expect(spySpawn).toHaveBeenCalledWith(
      'ffmpeg',
      expect.arrayContaining(['-i', 'rtsp://127.0.0.1:8554/live', '-f', 'hls']),
      expect.any(Object),
    );
    expect(info.pid).toBe(12345);
    expect(service.isStreaming('cam-1')).toBe(true);

    // Test stopStream
    const stopped = service.stopStream('cam-1');
    expect(stopped).toBe(true);
    expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    expect(service.isStreaming('cam-1')).toBe(false);

    spySpawn.mockRestore();
  });

  it('should invoke onError callback when process errors', (done) => {
    const mockProcess = Object.assign(new EventEmitter(), {
      pid: 67890,
      killed: false,
      kill: jest.fn(),
      stderr: new EventEmitter(),
    });

    jest.spyOn(child_process, 'spawn').mockReturnValue(mockProcess as any);

    service.startStream(
      'cam-err',
      'rtsp://bad-url',
      '/tmp/streams/cam-err',
      (err) => {
        expect(err.message).toBe('FFmpeg crash');
        done();
      },
    );

    mockProcess.emit('error', new Error('FFmpeg crash'));
  });
  it('reports clean source EOF once and ignores exits from replaced streams', () => {
    const makeProcess = () => Object.assign(new EventEmitter(), {
      pid: 123, killed: false, kill: jest.fn(), stderr: new EventEmitter(),
    });
    const oldProcess = makeProcess();
    const newProcess = makeProcess();
    jest.spyOn(child_process, 'spawn')
      .mockReturnValueOnce(oldProcess as any)
      .mockReturnValueOnce(newProcess as any);
    const onError = jest.fn();
    service.startStream('cam-1', 'rtsp://localhost/live', '/tmp/streams/cam-1', onError);
    service.startStream('cam-1', 'rtsp://localhost/live', '/tmp/streams/cam-1', onError);
    oldProcess.emit('exit', 1, null);
    expect(service.isStreaming('cam-1')).toBe(true);
    expect(onError).not.toHaveBeenCalled();
    newProcess.emit('exit', 0, null);
    newProcess.emit('error', new Error('late error'));
    expect(service.isStreaming('cam-1')).toBe(false);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('stops a stalled stream after 15 seconds and reports one error', async () => {
    jest.useFakeTimers();
    const process = Object.assign(new EventEmitter(), {
      pid: 12, killed: false, kill: jest.fn(), stderr: new EventEmitter(),
    });
    jest.spyOn(child_process, 'spawn').mockReturnValue(process as any);
    const onError = jest.fn();
    service.startStream('timeout-test', 'rtsp://camera/live', '/tmp/streams/timeout-test', onError);
    await jest.advanceTimersByTimeAsync(15000);
    expect(process.kill).toHaveBeenCalledWith('SIGTERM');
    expect(service.isStreaming('timeout-test')).toBe(false);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('timed out') }));
    process.emit('exit', 1, null);
    expect(onError).toHaveBeenCalledTimes(1);
    jest.clearAllTimers();
    jest.useRealTimers();
  });

});
