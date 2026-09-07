import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface StreamProcessInfo {
  process: ChildProcess;
  pid: number;
  outputDir: string;
  playlistPath: string;
  startedAt: Date;
  rtspUrl: string;
}

@Injectable()
export class FfmpegService implements OnModuleDestroy {
  private readonly logger = new Logger(FfmpegService.name);
  private readonly activeStreams = new Map<string, StreamProcessInfo>();

  onModuleDestroy() {
    this.logger.log('Stopping all active FFmpeg streams on module shutdown...');
    for (const cameraId of this.activeStreams.keys()) {
      this.stopStream(cameraId);
    }
  }

  /**
   * Spawns an FFmpeg process to transcode RTSP into HLS segments (.m3u8 + .ts)
   */
  startStream(
    cameraId: string,
    rtspUrl: string,
    outputDir: string,
    onError?: (error: Error) => void,
  ): StreamProcessInfo {
    // If stream already exists for this camera, stop it first to prevent duplicate processes
    if (this.activeStreams.has(cameraId)) {
      this.logger.warn(
        `Stream for camera ${cameraId} is already running. Restarting...`,
      );
      this.stopStream(cameraId);
    }

    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true });
    const playlistPath = path.join(outputDir, 'stream.m3u8');

    // Remove stale playlist if present
    if (fs.existsSync(playlistPath)) {
      try {
        fs.unlinkSync(playlistPath);
      } catch {}
    }

    const args = [
      '-fflags',
      'nobuffer',
      '-rtsp_transport',
      'tcp',
      '-i',
      rtspUrl,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-tune',
      'zerolatency',
      '-an', // disable audio for camera streaming stability
      '-f',
      'hls',
      '-hls_time',
      '2',
      '-hls_list_size',
      '6',
      '-hls_flags',
      'delete_segments',
      playlistPath,
    ];

    this.logger.log(
      `Spawning FFmpeg for camera ${cameraId} (output: ${playlistPath}): ffmpeg ${args.join(' ')}`,
    );

    let ffmpegProcess: ChildProcess;
    try {
      ffmpegProcess = spawn('ffmpeg', args, {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
    } catch (err) {
      this.logger.error(
        `Failed to spawn FFmpeg for camera ${cameraId}: ${(err as Error).message}`,
      );
      if (onError) onError(err as Error);
      throw err;
    }

    const pid = ffmpegProcess.pid || 0;
    const processInfo: StreamProcessInfo = {
      process: ffmpegProcess,
      pid,
      outputDir,
      playlistPath,
      startedAt: new Date(),
      rtspUrl,
    };

    this.activeStreams.set(cameraId, processInfo);

    let errorBuffer = '';
    ffmpegProcess.stderr?.on('data', (data) => {
      const chunk = data.toString();
      errorBuffer += chunk;
      // Keep only recent log buffer to avoid unbounded memory
      if (errorBuffer.length > 2000) {
        errorBuffer = errorBuffer.slice(-2000);
      }
    });

    const intentionallyStopped = false;
    ffmpegProcess.on('error', (err) => {
      this.logger.error(
        `FFmpeg process error for camera ${cameraId} (PID: ${pid}): ${err.message}`,
      );
      this.activeStreams.delete(cameraId);
      if (!intentionallyStopped && onError) {
        onError(err);
      }
    });

    ffmpegProcess.on('exit', (code, signal) => {
      this.logger.log(
        `FFmpeg process for camera ${cameraId} (PID: ${pid}) exited with code ${code}, signal ${signal}`,
      );
      this.activeStreams.delete(cameraId);

      if (!intentionallyStopped && code !== 0 && code !== null) {
        const errorMsg = `FFmpeg exited with error code ${code}: ${errorBuffer.slice(-300).trim()}`;
        this.logger.error(`Stream error for camera ${cameraId}: ${errorMsg}`);
        if (onError) {
          onError(new Error(errorMsg));
        }
      }
    });

    return processInfo;
  }

  /**
   * Cleanly stops the FFmpeg process for a camera, ensuring no orphaned processes remain
   */
  stopStream(cameraId: string): boolean {
    const processInfo = this.activeStreams.get(cameraId);
    if (!processInfo) {
      return false;
    }

    this.logger.log(
      `Terminating FFmpeg stream for camera ${cameraId} (PID: ${processInfo.pid})...`,
    );
    this.activeStreams.delete(cameraId);

    try {
      if (processInfo.process && !processInfo.process.killed) {
        processInfo.process.kill('SIGTERM');

        // Force kill after 1 second if still alive
        const forceTimer = setTimeout(() => {
          try {
            if (!processInfo.process.killed) {
              processInfo.process.kill('SIGKILL');
            }
          } catch {}
        }, 1000);
        forceTimer.unref();
      }
    } catch (err) {
      this.logger.warn(
        `Error while killing FFmpeg process PID ${processInfo.pid}: ${(err as Error).message}`,
      );
    }

    return true;
  }

  isStreaming(cameraId: string): boolean {
    return this.activeStreams.has(cameraId);
  }

  getProcessInfo(cameraId: string): StreamProcessInfo | undefined {
    return this.activeStreams.get(cameraId);
  }
}
