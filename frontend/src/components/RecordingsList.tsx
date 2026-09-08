import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { camerasApi, Recording } from '../api/cameras.api';
import { useNotificationStore } from '../store/notificationStore';
import {
  Film,
  Play,
  Clock,
  HardDrive,
  Calendar,
  X,
  Download,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Loader2,
} from 'lucide-react';

interface RecordingsListProps {
  cameraId: string;
}

export function RecordingsList({ cameraId }: RecordingsListProps) {
  const queryClient = useQueryClient();
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(
    null,
  );
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const detectRecordingMutation = useMutation({
    mutationFn: (recordingId: string) =>
      camerasApi.detectRecording(cameraId, recordingId),
    onSuccess: (event, recordingId) => {
      setAnalyzingId(null);
      queryClient.invalidateQueries({ queryKey: ['camera-events', cameraId] });
      const label =
        event.payload?.primaryDetection?.label ||
        event.payload?.detections?.[0]?.label ||
        'person';
      useNotificationStore.getState().addNotification({
        type: 'info',
        title: 'Clip AI Analyzed',
        message: `Detected ${label} in recorded clip ${recordingId.slice(0, 8)}. Event added to timeline.`,
      });
    },
    onError: (err: any) => {
      setAnalyzingId(null);
      useNotificationStore.getState().addNotification({
        type: 'error',
        title: 'Analysis Failed',
        message: err.response?.data?.message || 'Failed to analyze recording clip',
      });
    },
  });

  const {
    data: recordings,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['camera-recordings', cameraId],
    queryFn: () => camerasApi.listRecordings(cameraId),
    enabled: !!cameraId,
    refetchInterval: 10000, // periodically refresh in case an event recording finishes
  });

  const formatDuration = (seconds: number | null) => {
    if (seconds === null || seconds === undefined) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSize = (bytes: number | null) => {
    if (bytes === null || bytes === undefined || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getTriggerBadge = (trigger: string) => {
    switch (trigger) {
      case 'EVENT':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Motion Event
          </span>
        );
      case 'SCHEDULE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Scheduled
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            Manual
          </span>
        );
    }
  };

  const getFullVideoUrl = (videoUrl: string) => {
    const apiBase =
      import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
    if (videoUrl.startsWith('http')) return videoUrl;
    return `${apiBase}${videoUrl}`;
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/20">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Recorded Clips</h3>
            <p className="text-[11px] text-slate-400">
              Captured MP4 sessions and event triggers
            </p>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh recordings"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-500">
          Loading recordings...
        </div>
      ) : isError ? (
        <div className="py-6 text-center text-xs text-rose-400 flex items-center justify-center gap-1.5">
          <AlertCircle className="w-4 h-4" />
          Failed to load recordings
        </div>
      ) : !recordings || recordings.length === 0 ? (
        <div className="py-8 text-center bg-slate-950/40 rounded-xl border border-dashed border-slate-800 text-xs text-slate-500">
          <Film className="w-6 h-6 mx-auto mb-2 text-slate-600" />
          No recordings found for this camera.
          <div className="text-[11px] text-slate-600 mt-1">
            Start manual recording above or simulate motion events to capture clips.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
          {recordings.map((recording) => (
            <div
              key={recording.id}
              className="p-3.5 bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 rounded-xl flex flex-col justify-between space-y-3 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                  <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="font-mono text-[11px]">
                    {formatDate(recording.startedAt)}
                  </span>
                </div>
                {getTriggerBadge(recording.trigger)}
              </div>

              <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>{formatDuration(recording.duration)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5 text-slate-500" />
                  <span>{formatSize(recording.sizeBytes)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSelectedRecording(recording)}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold transition-all group-hover:border-indigo-500"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Play Clip
                </button>

                <button
                  onClick={() => {
                    setAnalyzingId(recording.id);
                    detectRecordingMutation.mutate(recording.id);
                  }}
                  disabled={analyzingId === recording.id}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-300 border border-violet-500/20 text-xs font-semibold transition-all disabled:opacity-50"
                  title="Run AI detection analysis on this clip"
                >
                  {analyzingId === recording.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  )}
                  {analyzingId === recording.id ? 'Analyzing...' : 'AI Inspect'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Playback Modal */}
      {selectedRecording && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-4 p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-semibold text-white">
                  Playback: {formatDate(selectedRecording.startedAt)}
                </span>
              </div>
              <button
                onClick={() => setSelectedRecording(null)}
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-800">
              <video
                controls
                autoPlay
                className="w-full h-full object-contain"
                src={getFullVideoUrl(selectedRecording.videoUrl)}
              >
                Your browser does not support HTML5 video playback.
              </video>
            </div>

            <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
              <div className="flex items-center gap-3">
                {getTriggerBadge(selectedRecording.trigger)}
                <span>Duration: {formatDuration(selectedRecording.duration)}</span>
                <span>Size: {formatSize(selectedRecording.sizeBytes)}</span>
              </div>
              <a
                href={getFullVideoUrl(selectedRecording.videoUrl)}
                download
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                Download MP4
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
