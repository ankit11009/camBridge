import { useState, useEffect } from 'react';
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
  inlinePlayback?: boolean;
}

export function RecordingsList({ cameraId, inlinePlayback = false }: RecordingsListProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [cameraId]);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(
    null,
  );
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [videoError, setVideoError] = useState(false);

  const detectRecordingMutation = useMutation({
    mutationFn: (recordingId: string) =>
      camerasApi.detectRecording(cameraId, recordingId),
    onSuccess: (event, recordingId) => {
      setAnalyzingId(null);
      queryClient.invalidateQueries({ queryKey: ['camera-events', cameraId] });
      const label =
        event.payload?.primaryDetection?.label ||
        event.payload?.detections?.[0]?.label;
      useNotificationStore.getState().addNotification({
        type: 'info',
        title: 'Person detection complete',
        message: label ? `Detected ${label} in recorded clip ${recordingId.slice(0, 8)}. Event added to timeline.` : 'No objects detected in the sampled recording frame.',
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
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-[#87622B] border border-amber-500/30">
            Motion Event
          </span>
        );
      case 'SCHEDULE':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-[#2E6F40] border border-emerald-500/30">
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
    const apiBase = (
      import.meta.env.VITE_API_BASE_URL || ''
    ).replace(/\/+$/, '');
    if (videoUrl.startsWith('http')) return videoUrl;
    const cleanUrl = videoUrl.startsWith('/') ? videoUrl : `/${videoUrl}`;
    return `${apiBase}${cleanUrl}`;
  };

  return (
    <div className="bg-[#FFFFFF] border border-[#DCE3D9] rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-[#DCE3D9]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-purple-500/10 text-[#66516F] rounded-lg border border-purple-500/20">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#253D2C]">Recorded Clips</h3>
            <p className="text-[11px] text-[#617166]">
              Captured MP4 sessions and event triggers
            </p>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-1.5 text-[#617166] hover:text-[#253D2C] hover:bg-[#EDF1EA] rounded-lg transition-colors disabled:opacity-50"
          title="Refresh recordings"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-xs text-[#617166]">
          Loading recordings...
        </div>
      ) : isError ? (
        <div className="py-6 text-center text-xs text-[#A4483B] flex items-center justify-center gap-1.5">
          <AlertCircle className="w-4 h-4" />
          Failed to load recordings
        </div>
      ) : !recordings || recordings.length === 0 ? (
        <div className="py-8 text-center bg-[#F8F4EB] rounded-xl border border-dashed border-[#DCE3D9] text-xs text-[#617166]">
          <Film className="w-6 h-6 mx-auto mb-2 text-[#617166]" />
          No recordings found for this camera.
          <div className="text-[11px] text-[#617166] mt-1">
            Start manual recording above or simulate motion events to capture clips.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pr-1">
          {recordings.slice(page * 6, page * 6 + 6).map((recording) => (
            <div
              key={recording.id}
              className="p-3.5 bg-[#F8F4EB] border border-[#DCE3D9] hover:border-[#DCE3D9] rounded-xl flex flex-col justify-between space-y-3 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-[#253D2C]">
                  <Calendar className="w-3.5 h-3.5 text-[#617166] shrink-0" />
                  <span className="font-sans text-[11px]">
                    {formatDate(recording.startedAt)}
                  </span>
                </div>
                {getTriggerBadge(recording.trigger)}
              </div>

              <div className="flex items-center gap-4 text-[11px] text-[#617166] font-sans">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#617166]" />
                  <span>{formatDuration(recording.duration)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <HardDrive className="w-3.5 h-3.5 text-[#617166]" />
                  <span>{formatSize(recording.sizeBytes)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setVideoError(false);
                    setSelectedRecording(recording);
                  }}
                  disabled={!recording.finishedAt}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-[#253D2C] border border-indigo-500/30 text-xs font-semibold transition-all group-hover:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {recording.finishedAt ? (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Play Clip
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Recording...
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    setAnalyzingId(recording.id);
                    detectRecordingMutation.mutate(recording.id);
                  }}
                  disabled={analyzingId === recording.id}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 border border-indigo-500/20 text-xs font-semibold transition-all disabled:opacity-50"
                  title="Detect people in a sampled frame from this clip"
                >
                  {analyzingId === recording.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                  {analyzingId === recording.id ? 'Analyzing...' : 'Detect People'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {recordings && recordings.length > 6 && <nav className="list-pagination" aria-label="Recording pages"><button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button><span>{page + 1} / {Math.ceil(recordings.length / 6)}</span><button disabled={(page + 1) * 6 >= recordings.length} onClick={() => setPage(p => p + 1)}>Next</button></nav>}
      {/* Video Playback Modal */}
      {selectedRecording && (
        <div className={inlinePlayback ? "inline-recording-player" : "fixed inset-0 bg-[#F8F4EB] backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in"}>
          <div className="bg-[#FFFFFF] border border-[#DCE3D9] rounded-2xl max-w-2xl w-full overflow-hidden shadow-sm space-y-4 p-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCE3D9]">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-indigo-400" />
                <span className="text-sm font-semibold text-[#253D2C]">
                  Playback: {formatDate(selectedRecording.startedAt)}
                </span>
              </div>
              <button
                aria-label="Close playback"
                onClick={() => {
                  setSelectedRecording(null);
                  setVideoError(false);
                }}
                className="p-1 text-[#617166] hover:text-[#253D2C] hover:bg-[#EDF1EA] rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-[#DCE3D9] flex items-center justify-center">
              {videoError ? (
                <div className="p-6 text-center text-xs text-[#A4483B] space-y-2">
                  <AlertCircle className="w-8 h-8 mx-auto text-[#A4483B]" />
                  <p className="font-semibold">Unable to stream video preview inline.</p>
                  <p className="text-[#617166] text-[11px]">
                    You can download the MP4 file directly to view it in your media player.
                  </p>
                  <a
                    href={getFullVideoUrl(selectedRecording.videoUrl)}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-[#253D2C] rounded-lg text-xs font-semibold mt-2 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download MP4
                  </a>
                </div>
              ) : (
                <video
                  key={selectedRecording.id}
                  controls
                  autoPlay
                  playsInline
                  preload="auto"
                  className="w-full h-full object-contain"
                  src={getFullVideoUrl(selectedRecording.videoUrl)}
                  onError={() => setVideoError(true)}
                >
                  Your browser does not support HTML5 video playback.
                </video>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 text-xs text-[#617166]">
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
