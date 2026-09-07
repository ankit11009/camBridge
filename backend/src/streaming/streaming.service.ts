import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';
import { FfmpegService } from './ffmpeg.service';
import { StreamSource } from '../plugins/camera-plugin.interface';

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);
  private readonly baseStreamsPath: string;

  constructor(
    private readonly ffmpegService: FfmpegService,
    private readonly configService: ConfigService,
  ) {
    this.baseStreamsPath = this.configService.get<string>(
      'STREAMS_PATH',
      path.join(process.cwd(), 'streams'),
    );
    // Ensure base streams directory exists
    if (!fs.existsSync(this.baseStreamsPath)) {
      fs.mkdirSync(this.baseStreamsPath, { recursive: true });
    }
  }

  getStreamDirectory(cameraId: string): string {
    return path.join(this.baseStreamsPath, cameraId);
  }

  startStream(
    cameraId: string,
    rtspUrl: string,
    onError?: (error: Error) => void,
  ): StreamSource {
    const outputDir = this.getStreamDirectory(cameraId);
    this.ffmpegService.startStream(cameraId, rtspUrl, outputDir, onError);

    return this.getStreamSource(cameraId);
  }

  stopStream(cameraId: string): boolean {
    const stopped = this.ffmpegService.stopStream(cameraId);

    // Clean up segment files on stop
    const outputDir = this.getStreamDirectory(cameraId);
    if (fs.existsSync(outputDir)) {
      try {
        const files = fs.readdirSync(outputDir);
        for (const file of files) {
          fs.unlinkSync(path.join(outputDir, file));
        }
      } catch (err) {
        this.logger.warn(
          `Could not clean up stream dir for ${cameraId}: ${(err as Error).message}`,
        );
      }
    }

    return stopped;
  }

  isStreaming(cameraId: string): boolean {
    return this.ffmpegService.isStreaming(cameraId);
  }

  getStreamSource(cameraId: string): StreamSource {
    return {
      url: `/streams/${cameraId}/stream.m3u8`,
      protocol: 'hls',
    };
  }
}
