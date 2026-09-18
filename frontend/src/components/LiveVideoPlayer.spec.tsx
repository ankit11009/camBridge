import Hls from 'hls.js';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LiveVideoPlayer } from './LiveVideoPlayer';

// Mock hls.js
vi.mock('hls.js', () => {
  const isSupportedMock = vi.fn().mockReturnValue(true);
  const HlsMock = vi.fn().mockImplementation(() => ({
    loadSource: vi.fn(),
    attachMedia: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
    startLoad: vi.fn(),
    recoverMediaError: vi.fn(),
  }));
  (HlsMock as any).isSupported = isSupportedMock;
  (HlsMock as any).Events = {
    MANIFEST_PARSED: 'hlsManifestParsed',
    ERROR: 'hlsError',
  };
  (HlsMock as any).ErrorTypes = {
    NETWORK_ERROR: 'networkError',
    MEDIA_ERROR: 'mediaError',
    OTHER_ERROR: 'otherError',
  };
  return { default: HlsMock };
});

describe('LiveVideoPlayer Component', () => {
  const defaultProps = {
    cameraId: 'cam-123',
    streamSource: {
      url: '/streams/cam-123/stream.m3u8',
      protocol: 'hls' as const,
    },
  };

  it('renders offline state when status is DISCONNECTED', () => {
    render(<LiveVideoPlayer {...defaultProps} cameraStatus="DISCONNECTED" />);

    expect(screen.getByTestId('player-offline-state')).toBeDefined();
    expect(screen.getByText('Camera is Offline')).toBeDefined();
    expect(screen.getByTestId('video-element')).toBeDefined();
  });

  it('renders connecting state when status is CONNECTING', () => {
    render(<LiveVideoPlayer {...defaultProps} cameraStatus="CONNECTING" />);

    expect(screen.getByTestId('player-connecting-state')).toBeDefined();
    expect(screen.getByText('Starting Live Stream...')).toBeDefined();
  });

  it('renders error state when status is ERROR', () => {
    const onRetry = vi.fn();
    render(
      <LiveVideoPlayer
        {...defaultProps}
        cameraStatus="ERROR"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByTestId('player-error-state')).toBeDefined();
    expect(screen.getByText('Stream Unavailable')).toBeDefined();

    const retryBtn = screen.getByText('Retry Connection');
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders video element, controls, and LIVE badge when status is CONNECTED', () => {
    render(<LiveVideoPlayer {...defaultProps} cameraStatus="CONNECTED" />);

    expect(screen.getByText('LIVE')).toBeDefined();
    expect(screen.getByText('Live feed')).toBeDefined();
    expect(screen.getByTitle('Play')).toBeDefined();
    expect(screen.getByTitle('Unmute')).toBeDefined();
    expect(screen.getByTitle('Fullscreen')).toBeDefined();
  });
  it('stops fatal playback failures until an explicit retry', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const onRetry = vi.fn();
    render(<LiveVideoPlayer {...defaultProps} cameraStatus="CONNECTED" onRetry={onRetry} />);
    const player = vi.mocked(Hls).mock.results[vi.mocked(Hls).mock.results.length - 1].value;
    const errorHandler = player.on.mock.calls.find((call: any[]) => call[0] === Hls.Events.ERROR)[1];
    act(() => errorHandler(Hls.Events.ERROR, { fatal: true, type: Hls.ErrorTypes.NETWORK_ERROR }));
    expect(player.destroy).toHaveBeenCalledTimes(1);
    expect(player.startLoad).not.toHaveBeenCalled();
    expect(player.recoverMediaError).not.toHaveBeenCalled();
    expect(screen.getByTestId('player-error-state')).toBeDefined();
    expect(screen.queryByTestId('player-buffering-state')).toBeNull();
    fireEvent.click(screen.getByText('Retry Connection'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(vi.mocked(Hls).mock.results[vi.mocked(Hls).mock.results.length - 1].value).toBe(player);
  });

});
