import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface ReconnectionConfig {
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  maxAttempts?: number;
}

interface ReconnectionState {
  cameraId: string;
  userId: string;
  attempts: number;
  nextDelayMs: number;
  timer?: NodeJS.Timeout;
}

@Injectable()
export class ReconnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(ReconnectionService.name);
  private readonly states = new Map<string, ReconnectionState>();

  private initialDelayMs = 2000;
  private maxDelayMs = 60000;
  private backoffFactor = 2;
  private maxAttempts = 5;

  constructor() {}

  configure(config: ReconnectionConfig) {
    if (config.initialDelayMs !== undefined)
      this.initialDelayMs = config.initialDelayMs;
    if (config.maxDelayMs !== undefined) this.maxDelayMs = config.maxDelayMs;
    if (config.backoffFactor !== undefined)
      this.backoffFactor = config.backoffFactor;
    if (config.maxAttempts !== undefined) this.maxAttempts = config.maxAttempts;
  }

  onModuleDestroy() {
    for (const [cameraId, state] of this.states.entries()) {
      if (state.timer) {
        clearTimeout(state.timer);
      }
      this.states.delete(cameraId);
    }
  }

  isReconnecting(cameraId: string): boolean {
    return this.states.has(cameraId);
  }

  getAttemptCount(cameraId: string): number {
    return this.states.get(cameraId)?.attempts ?? 0;
  }

  /**
   * Schedules an automatic reconnection attempt with exponential backoff
   */
  scheduleReconnection(
    userId: string,
    cameraId: string,
    connectFn: () => Promise<unknown>,
  ) {
    let state = this.states.get(cameraId);

    if (!state) {
      state = {
        cameraId,
        userId,
        attempts: 0,
        nextDelayMs: this.initialDelayMs,
      };
      this.states.set(cameraId, state);
    }

    if (state.attempts >= this.maxAttempts) {
      this.logger.warn(
        `Max reconnection attempts (${this.maxAttempts}) reached for camera ${cameraId}. Abandoning auto-reconnect.`,
      );
      this.cancelReconnection(cameraId);
      return;
    }

    if (state.timer) {
      clearTimeout(state.timer);
    }

    const currentAttempt = state.attempts + 1;
    const delay = state.nextDelayMs;

    this.logger.log(
      `Scheduling reconnection attempt #${currentAttempt} for camera ${cameraId} in ${delay}ms`,
    );

    state.timer = setTimeout(async () => {
      state.timer = undefined;
      state.attempts = currentAttempt;
      state.nextDelayMs = Math.min(
        state.nextDelayMs * this.backoffFactor,
        this.maxDelayMs,
      );

      try {
        await connectFn();
        this.logger.log(
          `Camera ${cameraId} successfully reconnected on attempt #${currentAttempt}`,
        );
        this.cancelReconnection(cameraId);
      } catch (err) {
        this.logger.warn(
          `Reconnection attempt #${currentAttempt} for camera ${cameraId} failed: ${(err as Error).message}`,
        );
        // Recursively schedule next attempt
        this.scheduleReconnection(userId, cameraId, connectFn);
      }
    }, delay);

    state.timer.unref();
  }

  cancelReconnection(cameraId: string) {
    const state = this.states.get(cameraId);
    if (state) {
      if (state.timer) {
        clearTimeout(state.timer);
      }
      this.states.delete(cameraId);
    }
  }
}
