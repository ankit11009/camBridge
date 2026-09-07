import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { camerasApi } from '../api/cameras.api';
import { CameraCard } from '../components/CameraCard';
import { CreateCameraModal } from '../components/CreateCameraModal';
import { useCameraSocket } from '../hooks/useCameraSocket';
import { Plus, RefreshCw, Video, AlertCircle } from 'lucide-react';

export function DashboardPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Establish WebSocket connection for real-time camera status updates
  useCameraSocket();

  const {
    data: cameras = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['cameras'],
    queryFn: camerasApi.list,
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Camera Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your connected camera streams, plugin configurations, and live monitors.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2.5 rounded-xl border border-slate-700/60 transition-colors disabled:opacity-50"
            title="Refresh camera list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all hover:shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" />
            Add Camera
          </button>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <div>
            <div className="font-semibold">Failed to load cameras</div>
            <div className="text-slate-400">{(error as Error)?.message || 'An unexpected error occurred'}</div>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 animate-pulse space-y-4"
            >
              <div className="flex justify-between items-center">
                <div className="w-1/2 h-5 bg-slate-800 rounded" />
                <div className="w-20 h-5 bg-slate-800 rounded-full" />
              </div>
              <div className="h-14 bg-slate-950/60 rounded" />
              <div className="h-8 bg-slate-800 rounded" />
            </div>
          ))}
        </div>
      ) : cameras.length === 0 ? (
        /* Empty State */
        <div className="text-center py-16 px-4 bg-slate-900/40 border border-slate-800/60 rounded-2xl">
          <div className="inline-flex p-4 bg-slate-800/80 rounded-2xl border border-slate-700/60 text-slate-400 mb-4">
            <Video className="w-8 h-8" />
          </div>
          <h2 className="text-base font-semibold text-white">No cameras connected yet</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-6">
            Add a simulated Mock camera, an RTSP video stream, or discover local ONVIF cameras.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add your first camera
          </button>
        </div>
      ) : (
        /* Camera Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cameras.map((camera) => (
            <CameraCard key={camera.id} camera={camera} />
          ))}
        </div>
      )}

      {/* Modal */}
      <CreateCameraModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
