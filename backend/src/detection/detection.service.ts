import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { RecordingsService } from '../recordings/recordings.service';
import { DetectionEventPayload, DetectionResult } from './detection.interface';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';

export interface MotionZone { x: number; y: number; width: number; height: number; }

export interface CameraDetectionStatus {
  zone?: MotionZone;
  error?: string | null;
  personCount?: number;
  enabled: boolean;
  running: boolean;
  intervalMs: number;
  lastDetectedAt?: string | null;
  lastDetection?: DetectionResult | null;
}

@Injectable()
export class DetectionService implements OnModuleDestroy {
  private readonly logger = new Logger(DetectionService.name);
  private readonly activeMonitors = new Map<string, NodeJS.Timeout>();
  private readonly zonePresence = new Map<string, { occupied: boolean; misses: number }>();
  private readonly lastAlertTimes = new Map<string, number>();
  private readonly detectionStates = new Map<string, CameraDetectionStatus>();
  private readonly sessions = new Map<string, string>();
  private readonly isRunningTick = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
    @Optional() private readonly recordingsService?: RecordingsService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  onModuleDestroy() {
    this.logger.log('Stopping all automated detection monitoring loops...');
    for (const [, timer] of this.activeMonitors.entries()) {
      clearInterval(timer);
    }
    this.activeMonitors.clear();
    this.detectionStates.clear();
    this.sessions.clear();
    this.zonePresence.clear();
  }

  /**
   * Toggles automated continuous motion & human detection mode for a camera
   */
  async toggleDetectionMode(
    userId: string,
    cameraId: string,
    enabled: boolean,
    intervalMs = 2000,
    zone: MotionZone = { x: 0, y: 0, width: 1, height: 1 },
  ): Promise<CameraDetectionStatus> {
    const camera = await this.prisma.camera.findFirst({
      where: { id: cameraId, ownerId: userId },
    });

    if (!camera) {
      throw new NotFoundException(`Camera ${cameraId} not found`);
    }

    if (![zone.x, zone.y, zone.width, zone.height].every(Number.isFinite) ||
      zone.x < 0 || zone.y < 0 || zone.width <= 0 || zone.height <= 0 ||
      zone.x + zone.width > 1.000001 || zone.y + zone.height > 1.000001) {
      throw new BadRequestException('Zone must fit inside the video frame');
    }
    this.sessions.set(cameraId, randomUUID());
    this.lastAlertTimes.delete(cameraId);
    this.zonePresence.delete(cameraId);

    // Clear any active interval monitor
    const existingTimer = this.activeMonitors.get(cameraId);
    if (existingTimer) {
      clearInterval(existingTimer);
      this.activeMonitors.delete(cameraId);
    }

    const safeInterval = Math.max(2000, Math.min(intervalMs, 30000));
    const isConnected = camera.status === 'CONNECTED';

    const currentStatus: CameraDetectionStatus = {
      enabled,
      personCount: 0,
      zone,
      error: null,
      running: enabled && isConnected,
      intervalMs: safeInterval,
      lastDetectedAt:
        this.detectionStates.get(cameraId)?.lastDetectedAt || null,
      lastDetection: this.detectionStates.get(cameraId)?.lastDetection || null,
    };
    this.detectionStates.set(cameraId, currentStatus);

    if (enabled) {
      this.logger.log(
        `Automated detection mode ARMED for camera ${cameraId} (interval: ${safeInterval}ms, status: ${camera.status})`,
      );

      // Trigger immediate first check
      this.runMonitoringTick(userId, cameraId).catch((err) => {
        this.logger.debug(
          `Initial automated detection tick failed: ${err.message}`,
        );
      });

      // Schedule periodic inspection
      const timer = setInterval(() => {
        this.runMonitoringTick(userId, cameraId).catch((err) => {
          this.logger.debug(
            `Automated detection tick failed for ${cameraId}: ${err.message}`,
          );
        });
      }, safeInterval);

      this.activeMonitors.set(cameraId, timer);
    } else {
      this.logger.log(
        `Automated detection mode DISARMED for camera ${cameraId}`,
      );
    }

    return currentStatus;
  }

  /**
   * Retrieves current automated detection status for a camera
   */
  async getDetectionStatus(
    userId: string,
    cameraId: string,
  ): Promise<CameraDetectionStatus> {
    const camera = await this.prisma.camera.findFirst({
      where: { id: cameraId, ownerId: userId },
    });

    if (!camera) {
      throw new NotFoundException(`Camera ${cameraId} not found`);
    }

    const state = this.detectionStates.get(cameraId);
    if (!state) {
      return {
        enabled: false,
        running: false,
        intervalMs: 4000,
        lastDetectedAt: null,
        lastDetection: null,
      };
    }

    return {
      ...state,
      running: state.running && state.enabled && camera.status === 'CONNECTED',
    };
  }

  /**
   * Performs an automated inspection tick against the camera feed
   */
  private async runMonitoringTick(
    userId: string,
    cameraId: string,
  ): Promise<void> {
    const sessionState = this.detectionStates.get(cameraId);
    if (!sessionState?.enabled || this.isRunningTick.has(cameraId)) {
      return;
    }
    this.isRunningTick.add(cameraId);
    const sessionId = this.sessions.get(cameraId);

    try {
      const camera = await this.prisma.camera.findFirst({
        where: { id: cameraId, ownerId: userId },
      });

      if (!camera || camera.status !== 'CONNECTED') {
        const state = this.detectionStates.get(cameraId);
        if (state) state.running = false;
        return;
      }

      const streamDir = path.join(
        this.config?.get<string>('STREAMS_PATH') ||
          path.join(process.cwd(), 'streams'),
        cameraId,
      );
      const m3u8Path = path.join(streamDir, 'stream.m3u8');
      let frameCaptured = false;
      const snapshotPath = path.join(streamDir, `auto_snapshot_${sessionId}.jpg`);

      if (fs.existsSync(m3u8Path)) {
        try {
          await this.extractFrame(m3u8Path, snapshotPath);
          frameCaptured = fs.existsSync(snapshotPath);
        } catch (err) {
          this.logger.debug(
            `Automated frame extraction skipped for ${cameraId}: ${(err as Error).message}`,
          );
        }
      }

      const detections = await this.runDetectionInference(
        frameCaptured ? snapshotPath : null,
        camera.pluginType,
        sessionState.zone,
      );

      const activeState = this.detectionStates.get(cameraId);
      if (!activeState?.enabled || activeState !== sessionState) return;
      activeState.running = true;
      activeState.error = null;
      const people = detections.filter(d => d.label === 'person');
      activeState.personCount = people.length;
      const presence = this.zonePresence.get(cameraId) || { occupied: false, misses: 0 };
      this.zonePresence.set(cameraId, presence);
      let eventType: string | null = null;
      const now = Date.now();
      if (people.length) {
        eventType = !presence.occupied ? 'PERSON_ENTERED' :
          now - (this.lastAlertTimes.get(cameraId) || 0) >= 10000 ? 'PERSON_PRESENT' : null;
        presence.occupied = true;
        presence.misses = 0;
        activeState.lastDetectedAt = new Date().toISOString();
        activeState.lastDetection = people[0];
      } else if (presence.occupied && ++presence.misses >= 2) {
        presence.occupied = false;
        eventType = 'PERSON_EXITED';
      }
      if (eventType) {
        this.lastAlertTimes.set(cameraId, now);
        await this.eventsService.recordAndEmitEvent(cameraId, 'DETECTION', {
          source: 'automated_monitor', sourceId: cameraId,
          eventType, cameraName: camera.name, zone: sessionState.zone,
          personCount: people.length, detections: people,
          primaryDetection: people[0], analyzedAt: new Date().toISOString(), frameCount: 1,
        });
      }

    } catch (err) {
      const state = this.detectionStates.get(cameraId);
      if (state === sessionState) {
        state.running = false;
        state.error = err instanceof ServiceUnavailableException ? err.message : 'Waiting for camera frames. Check the stream and detector setup.';
      }
      throw err;
    } finally {
      this.isRunningTick.delete(cameraId);
    }
  }

  /**
   * Detect people with YOLO against a live camera frame
   */
  async analyzeCamera(userId: string, cameraId: string): Promise<any> {
    const camera = await this.prisma.camera.findFirst({
      where: { id: cameraId, ownerId: userId },
    });

    if (!camera) {
      throw new NotFoundException(`Camera ${cameraId} not found`);
    }

    this.logger.log(`Detecting people with YOLO on live camera feed for ${cameraId}`);

    // Grab frame from live HLS stream or generate snapshot buffer
    const streamDir = path.join(
      this.config?.get<string>('STREAMS_PATH') ||
        path.join(process.cwd(), 'streams'),
      cameraId,
    );
    const m3u8Path = path.join(streamDir, 'stream.m3u8');
    let frameCaptured = false;
    const snapshotPath = path.join(streamDir, 'snapshot.jpg');

    if (fs.existsSync(m3u8Path)) {
      try {
        await this.extractFrame(m3u8Path, snapshotPath);
        frameCaptured = fs.existsSync(snapshotPath);
      } catch (err) {
        this.logger.debug(
          `Snapshot extraction from HLS failed: ${(err as Error).message}`,
        );
      }
    }

    // Detect people with YOLO pipeline
    const detections = await this.runDetectionInference(
      frameCaptured ? snapshotPath : null,
      camera.pluginType,
      this.detectionStates.get(cameraId)?.zone,
    );

    const payload: DetectionEventPayload = {
      source: 'live_frame',
      sourceId: cameraId,
      detections,
      primaryDetection: detections[0],
      analyzedAt: new Date().toISOString(),
      frameCount: 1,
    };

    const event = await this.eventsService.recordAndEmitEvent(
      cameraId,
      'DETECTION',
      payload,
    );

    return event;
  }

  /**
   * Detect people with YOLO against a recorded video clip
   */
  async analyzeRecording(
    userId: string,
    cameraId: string,
    recordingId: string,
  ): Promise<any> {
    const camera = await this.prisma.camera.findFirst({
      where: { id: cameraId, ownerId: userId },
    });

    if (!camera) {
      throw new NotFoundException(`Camera ${cameraId} not found`);
    }

    const recording = await this.prisma.recording.findFirst({
      where: { id: recordingId, cameraId },
    });

    if (!recording) {
      throw new NotFoundException(`Recording ${recordingId} not found`);
    }

    this.logger.log(
      `Detecting people with YOLO on recorded clip ${recordingId} (${recording.filePath})`,
    );

    let frameCaptured = false;
    const snapshotPath = path.join(
      path.dirname(recording.filePath),
      `snap_${recordingId}.jpg`,
    );

    if (fs.existsSync(recording.filePath)) {
      try {
        await this.extractFrame(recording.filePath, snapshotPath);
        frameCaptured = fs.existsSync(snapshotPath);
      } catch (err) {
        this.logger.debug(
          `Snapshot extraction from recording failed: ${(err as Error).message}`,
        );
      }
    }

    // Detect people with YOLO pipeline
    const detections = await this.runDetectionInference(
      frameCaptured ? snapshotPath : null,
      'RECORDING',
      this.detectionStates.get(cameraId)?.zone,
    );

    const payload: DetectionEventPayload = {
      source: 'recording_clip',
      sourceId: recordingId,
      detections,
      primaryDetection: detections[0],
      analyzedAt: new Date().toISOString(),
      frameCount: 1,
    };

    const event = await this.eventsService.recordAndEmitEvent(
      cameraId,
      'DETECTION',
      payload,
    );

    return event;
  }

  /** Analyze an actual frame; an empty result is a successful negative detection. */
  async runDetectionInference(
    framePath: string | null,
    context: string,
    zone?: MotionZone,
  ): Promise<DetectionResult[]> {
    if (!framePath || !fs.existsSync(framePath)) {
      throw new ServiceUnavailableException(
        'No video frame available. Connect the camera and wait for its stream, or check that the recording exists.',
      );
    }
    const externalScript = path.join(process.cwd(), 'scripts', 'detect.py');
    try {
      return await this.invokeExternalDetector(externalScript, framePath, zone);
    } catch (err) {
      this.logger.warn(`Detection failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException(
        'YOLO unavailable. Install scripts/requirements.txt, run scripts/setup_detector.py, and check DETECTION_PYTHON / DETECTION_MODEL.',
      );
    }
  }

  private extractFrame(inputPath: string, outputPath: string, seekSeconds = 0): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-y',
        '-nostdin',
        '-loglevel',
        'error',
        ...(inputPath.endsWith('.m3u8') ? ['-live_start_index', '-1'] : []),
        ...(seekSeconds ? ['-ss', String(seekSeconds)] : []),
        '-i',
        inputPath,
        '-vframes',
        '1',
        '-q:v',
        '2',
        outputPath,
      ]);

      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error('Detection process timed out'));
      }, 30000);
      proc.stderr.resume();
      proc.stdout.resume();
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else
          reject(new Error(`FFmpeg frame extraction exited with code ${code}`));
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  private invokeExternalDetector(
    scriptPath: string,
    imagePath: string,
    zone?: MotionZone,
  ): Promise<DetectionResult[]> {
    return new Promise((resolve, reject) => {
      const proc = spawn(
        this.config?.get<string>('DETECTION_PYTHON') ||
          (fs.existsSync(path.join(process.cwd(), '.venv/bin/python'))
            ? path.join(process.cwd(), '.venv/bin/python')
            : 'python3'),
        [scriptPath, imagePath, JSON.stringify(zone || { x: 0, y: 0, width: 1, height: 1 })],
        { env: { ...process.env,
          DETECTION_MODEL: this.config?.get<string>('DETECTION_MODEL') || process.env.DETECTION_MODEL,
          DETECTION_CONFIDENCE: this.config?.get<string>('DETECTION_CONFIDENCE') || process.env.DETECTION_CONFIDENCE || '0.5',
          DETECTION_DEVICE: this.config?.get<string>('DETECTION_DEVICE') || process.env.DETECTION_DEVICE || 'cpu',
        } },
      );
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => (stdout += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));

      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error('Detection process timed out'));
      }, 60000);
      proc.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          try {
            const parsed = JSON.parse(stdout.trim());
            if (
              !Array.isArray(parsed) ||
              parsed.some(
                (d) =>
                  !d ||
                  typeof d.label !== 'string' ||
                  !Number.isFinite(d.confidence) ||
                  d.confidence < 0 ||
                  d.confidence > 1 ||
                  !d.box ||
                  ['x', 'y', 'width', 'height'].some(
                    (key) => !Number.isFinite(d.box[key]),
                  ),
              )
            )
              throw new Error('Invalid detector output');
            resolve(parsed);
          } catch {
            reject(
              new Error(`Failed to parse external detector output: ${stdout}`),
            );
          }
        } else {
          reject(
            new Error(`External detector error (code ${code}): ${stderr}`),
          );
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
