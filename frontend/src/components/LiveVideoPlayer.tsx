import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  AlertCircle,
  Loader2,
  Radio,
  VideoOff,
  RefreshCw,
} from 'lucide-react';
import { CameraStatus, StreamSource } from '../api/cameras.api';
import { API_BASE_URL } from '../api/client';

export interface LiveVideoPlayerProps {
  cameraId: string;
  cameraStatus: CameraStatus;
  streamSource?: StreamSource | null;
  className?: string;
  onRetry?: () => void;
}

export const LiveVideoPlayer: React.FC<LiveVideoPlayerProps> = ({
  cameraId,
  cameraStatus,
  streamSource,
  className = '',
  onRetry,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  const isConnected = cameraStatus === 'CONNECTED';
  const isConnecting = cameraStatus === 'CONNECTING';
  const isError = cameraStatus === 'ERROR';

  // Construct absolute stream URL
  const streamUrl = streamSource?.url
    ? streamSource.url.startsWith('http')
      ? streamSource.url
      : `${API_BASE_URL}${streamSource.url}`
    : `/streams/${cameraId}/stream.m3u8`.startsWith('http')
      ? `/streams/${cameraId}/stream.m3u8`
      : `${API_BASE_URL}/streams/${cameraId}/stream.m3u8`;

  // Attach / Detach HLS player
  useEffect(() => {
    if (!isConnected || !videoRef.current) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }

    const video = videoRef.current;
    setPlayerError(null);
    setIsBuffering(true);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 10,
        maxBufferLength: 10,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 6,
      });
      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsBuffering(false);
        video.play().catch(() => {
          // Autoplay policy might pause until user interaction
          setIsPlaying(false);
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // Try to recover network error
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              setPlayerError('Stream interrupted. Could not load video segments.');
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari / iOS)
      video.src = streamUrl;
      const onLoaded = () => {
        setIsBuffering(false);
        video.play().catch(() => setIsPlaying(false));
      };
      video.addEventListener('loadedmetadata', onLoaded);

      return () => {
        video.removeEventListener('loadedmetadata', onLoaded);
      };
    } else {
      setPlayerError('HLS playback is not supported by your browser.');
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isConnected, streamUrl]);

  // Video event handlers
  const handlePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleMuteToggle = useCallback(() => {
    if (!videoRef.current) return;
    const nextMuted = !videoRef.current.muted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  }, []);

  const handleFullscreenToggle = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="live-video-player"
      className={`relative group bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl aspect-video flex items-center justify-center ${className}`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        data-testid="video-element"
        playsInline
        muted={isMuted}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        className={`w-full h-full object-contain ${
          isConnected && !playerError ? 'opacity-100' : 'opacity-0'
        } transition-opacity duration-300`}
      />

      {/* State: Offline / Disconnected */}
      {!isConnected && !isConnecting && !isError && (
        <div
          data-testid="player-offline-state"
          className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 z-10"
        >
          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3 shadow-inner">
            <VideoOff className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">Camera is Offline</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Connect to the camera to initiate RTSP streaming and watch live video.
          </p>
        </div>
      )}

      {/* State: Connecting */}
      {isConnecting && (
        <div
          data-testid="player-connecting-state"
          className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 z-10"
        >
          <Loader2 className="w-9 h-9 text-indigo-500 animate-spin mb-3" />
          <h3 className="text-sm font-semibold text-white">Starting Live Stream...</h3>
          <p className="text-xs text-slate-400 mt-1">
            Transcoding RTSP to HLS chunks via FFmpeg
          </p>
        </div>
      )}

      {/* State: Camera Error or Playback Error */}
      {(isError || playerError) && (
        <div
          data-testid="player-error-state"
          className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/95 z-10"
        >
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white">Stream Unavailable</h3>
          <p className="text-xs text-rose-400 mt-1 max-w-sm">
            {playerError || 'Camera encountered an error while connecting or streaming.'}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Connection
            </button>
          )}
        </div>
      )}

      {/* State: Buffering Overlay while Connected */}
      {isConnected && isBuffering && !playerError && (
        <div
          data-testid="player-buffering-state"
          className="absolute inset-0 flex items-center justify-center bg-black/40 z-10 pointer-events-none"
        >
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-700 text-xs text-slate-200 shadow-xl">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span>Buffering live feed...</span>
          </div>
        </div>
      )}

      {/* Overlay: Live Badge */}
      {isConnected && !playerError && (
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-600/90 border border-rose-500 text-white text-[11px] font-bold tracking-wider uppercase shadow-lg shadow-rose-900/30">
            <Radio className="w-3 h-3 animate-pulse" />
            LIVE
          </div>
          <div className="px-2 py-1 rounded-md bg-slate-900/80 border border-slate-700/60 text-slate-300 text-[10px] font-mono backdrop-blur-sm">
            HLS 1080p
          </div>
        </div>
      )}

      {/* Overlay: Control Bar */}
      {isConnected && !playerError && (
        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-slate-950/90 via-slate-950/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePlayPause}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white transition-colors"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>
            <button
              onClick={handleMuteToggle}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white transition-colors"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-slate-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleFullscreenToggle}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-white transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
