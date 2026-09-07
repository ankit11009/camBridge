import { ReconnectionService } from './reconnection.service';

describe('ReconnectionService', () => {
  let service: ReconnectionService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new ReconnectionService();
    service.configure({
      initialDelayMs: 100,
      maxDelayMs: 1000,
      backoffFactor: 2,
      maxAttempts: 3,
    });
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('should be defined and initialize cleanly', () => {
    expect(service).toBeDefined();
    expect(service.isReconnecting('cam-1')).toBe(false);
  });

  it('schedules reconnection and calls connectFn', async () => {
    const connectFn = jest.fn().mockResolvedValue('CONNECTED');

    service.scheduleReconnection('user-1', 'cam-1', connectFn);

    expect(service.isReconnecting('cam-1')).toBe(true);
    expect(connectFn).not.toHaveBeenCalled();

    // Advance past initial delay
    await jest.advanceTimersByTimeAsync(100);

    expect(connectFn).toHaveBeenCalledTimes(1);
    expect(service.isReconnecting('cam-1')).toBe(false);
  });

  it('retries with exponential backoff on failure', async () => {
    const connectFn = jest
      .fn()
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockResolvedValueOnce('CONNECTED');

    service.scheduleReconnection('user-1', 'cam-1', connectFn);

    // First attempt at 100ms
    await jest.advanceTimersByTimeAsync(100);
    expect(connectFn).toHaveBeenCalledTimes(1);
    expect(service.isReconnecting('cam-1')).toBe(true);

    // Second attempt at 200ms (100 * 2)
    await jest.advanceTimersByTimeAsync(200);
    expect(connectFn).toHaveBeenCalledTimes(2);
    expect(service.isReconnecting('cam-1')).toBe(false);
  });

  it('cancels scheduled reconnection when cancelReconnection is called', async () => {
    const connectFn = jest.fn().mockResolvedValue('CONNECTED');

    service.scheduleReconnection('user-1', 'cam-1', connectFn);
    expect(service.isReconnecting('cam-1')).toBe(true);

    service.cancelReconnection('cam-1');
    expect(service.isReconnecting('cam-1')).toBe(false);

    await jest.advanceTimersByTimeAsync(500);
    expect(connectFn).not.toHaveBeenCalled();
  });

  it('abandons reconnection after maxAttempts', async () => {
    const connectFn = jest.fn().mockRejectedValue(new Error('Unreachable'));

    service.scheduleReconnection('user-1', 'cam-1', connectFn);

    // Attempt 1 (100ms)
    await jest.advanceTimersByTimeAsync(100);
    expect(connectFn).toHaveBeenCalledTimes(1);

    // Attempt 2 (200ms)
    await jest.advanceTimersByTimeAsync(200);
    expect(connectFn).toHaveBeenCalledTimes(2);

    // Attempt 3 (400ms)
    await jest.advanceTimersByTimeAsync(400);
    expect(connectFn).toHaveBeenCalledTimes(3);

    // Should abandon
    expect(service.isReconnecting('cam-1')).toBe(false);
  });
});
