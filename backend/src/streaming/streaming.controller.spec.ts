import * as fs from 'fs';
import { NotFoundException } from '@nestjs/common';
import { StreamingController } from './streaming.controller';
import { StreamingService } from './streaming.service';

describe('StreamingController startup', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function setup() {
    const streaming = {
      getStreamDirectory: () => '/tmp/streams/test',
      isStreaming: jest.fn().mockReturnValue(true),
    };
    const controller = new StreamingController(streaming as unknown as StreamingService);
    const response = { destroyed: false, setHeader: jest.fn() };
    return { streaming, controller, response };
  }

  it('serves the first playlist as soon as it is published', async () => {
    jest.useFakeTimers();
    const { controller, response } = setup();
    const exists = jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const pipe = jest.fn();
    jest.spyOn(fs, 'createReadStream').mockReturnValue({ pipe } as any);
    const pending = controller.getStreamFile('test', 'stream.m3u8', response as any);
    expect(pipe).not.toHaveBeenCalled();
    exists.mockReturnValue(true);
    await jest.advanceTimersByTimeAsync(100);
    await pending;
    expect(pipe).toHaveBeenCalledWith(response);
  });

  it('stops waiting when the source fails', async () => {
    jest.useFakeTimers();
    const { controller, streaming, response } = setup();
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const pending = controller.getStreamFile('test', 'stream.m3u8', response as any);
    const assertion = expect(pending).rejects.toBeInstanceOf(NotFoundException);
    streaming.isStreaming.mockReturnValue(false);
    await jest.advanceTimersByTimeAsync(100);
    await assertion;
  });

  it('bounds the startup wait if no playlist arrives', async () => {
    jest.useFakeTimers();
    const { controller, response } = setup();
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    const pending = controller.getStreamFile('test', 'stream.m3u8', response as any);
    const assertion = expect(pending).rejects.toBeInstanceOf(NotFoundException);
    await jest.advanceTimersByTimeAsync(8000);
    await assertion;
    expect(jest.getTimerCount()).toBe(0);
  });
});
