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
  startupTimer?: NodeJS.Timeout;
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

    // When running inside Docker, resolve localhost / 127.0.0.1 to host.docker.internal
    // so FFmpeg inside the container can reach RTSP services (like MediaMTX) on the host.
    let resolvedRtspUrl = rtspUrl;
    if (fs.existsSync('/.dockerenv') || process.env.IS_DOCKER === 'true') {
      resolvedRtspUrl = resolvedRtspUrl.replace(
        /:\/\/(localhost|127\.0\.0\.1)(:|\/)/,
        '://host.docker.internal$2',
      );
    }

    const args = [
      '-analyzeduration',
      '500000',
      '-probesize',
      '262144',
      '-rtsp_transport',
      'tcp',
      '-timeout',
      '10000000', // Stop when the RTSP source stops responding for 10 seconds
      '-i',
      resolvedRtspUrl,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-tune',
      'zerolatency',
      // HLS cuts at keyframes: force one every second instead of waiting
      // for libx264's default GOP (up to 250 frames).
      '-force_key_frames',
      'expr:gte(t,n_forced*1)',
      '-sc_threshold',
      '0',
      '-pix_fmt',
      'yuv420p',
      '-an', // disable audio for camera streaming stability
      '-f',
      'hls',
      '-hls_time',
      '1',
      '-hls_list_size',
      '6',
      '-hls_flags',
      'delete_segments+independent_segments+temp_file',
      '-hls_start_number_source',
      'epoch',
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

    processInfo.startupTimer = setInterval(() => {
      if (this.activeStreams.get(cameraId) !== processInfo || fs.existsSync(playlistPath)) {
        clearInterval(processInfo.startupTimer);
        return;
      }
      if (Date.now() - processInfo.startedAt.getTime() >= 15000) {
        this.stopStream(cameraId);
        onError?.(new Error('Camera connection timed out: no video received within 15 seconds.'));
      }
    }, 250);
    processInfo.startupTimer.unref();

    let errorBuffer = '';
    ffmpegProcess.stderr?.on('data', (data) => {
      const chunk = data.toString();
      errorBuffer += chunk;
      // Keep only recent log buffer to avoid unbounded memory
      if (errorBuffer.length > 2000) {
        errorBuffer = errorBuffer.slice(-2000);
      }
    });

    // Ignore callbacks from a stopped or replaced process, and report failure once.
    const reportFailure = (error: Error) => {
      if (this.activeStreams.get(cameraId) !== processInfo) return;
      clearInterval(processInfo.startupTimer);
      this.activeStreams.delete(cameraId);
      onError?.(error);
    };
    ffmpegProcess.on('error', (err) => {
      this.logger.error(
        `FFmpeg process error for camera ${cameraId} (PID: ${pid}): ${err.message}`,
      );
      reportFailure(err);
    });

    ffmpegProcess.on('exit', (code, signal) => {
      this.logger.log(
        `FFmpeg process for camera ${cameraId} (PID: ${pid}) exited with code ${code}, signal ${signal}`,
      );
      // Even a clean EOF means the live source has stopped.
      reportFailure(new Error(
        `FFmpeg stream ended (code ${code}, signal ${signal}): ${errorBuffer.slice(-300).trim()}`,
      ));
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
    clearInterval(processInfo.startupTimer);

    try {
      if (processInfo.process && !processInfo.process.killed) {
        processInfo.process.kill('SIGTERM');

        // Force kill after 1 second if still alive
        const forceTimer = setTimeout(() => {
          try {
            if (processInfo.process.exitCode === null && processInfo.process.signalCode === null) {
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
