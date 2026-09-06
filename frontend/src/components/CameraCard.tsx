import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, camerasApi } from '../api/cameras.api';
import { CameraStatusBadge } from './CameraStatusBadge';
import { Video, Trash2, Settings, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface Props {
  camera: Camera;
}

export function CameraCard({ camera }: Props) {
  const queryClient = useQueryClient();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => camerasApi.delete(camera.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
    },
  });

  const getPluginBadgeColor = (type: string) => {
    switch (type) {
      case 'MOCK':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'RTSP':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'ONVIF':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 transition-all rounded-xl p-5 shadow-lg flex flex-col justify-between group">
      <div>
        {/* Header with Camera Icon and Status */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-slate-800 border border-slate-700/60 text-indigo-400 group-hover:text-indigo-300 transition-colors">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-base tracking-tight line-clamp-1">
                {camera.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded border ${getPluginBadgeColor(
                    camera.pluginType,
                  )}`}
                >
                  {camera.pluginType}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {camera.id.slice(0, 8)}...
                </span>
              </div>
            </div>
          </div>
          <CameraStatusBadge status={camera.status} />
        </div>

        {/* Info Grid */}
        <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800/80 mb-4 text-xs space-y-1.5">
          <div className="flex justify-between text-slate-400">
            <span>Added</span>
            <span className="text-slate-300">
              {new Date(camera.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Configuration</span>
            <span className="text-slate-300 font-mono">
              {Object.keys(camera.connectionConfig || {}).length > 0
                ? `${Object.keys(camera.connectionConfig).length} keys set`
                : 'Default'}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <Link
          to={`/cameras/${camera.id}`}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 px-3 rounded-lg border border-slate-700/60 transition-colors"
        >
          <Settings className="w-3.5 h-3.5 text-slate-400" />
          Manage
        </Link>

        {isConfirmingDelete ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="text-xs bg-rose-600 hover:bg-rose-500 text-white px-2.5 py-2 rounded-lg font-medium transition-colors"
            >
              {deleteMutation.isPending ? '...' : 'Confirm'}
            </button>
            <button
              onClick={() => setIsConfirmingDelete(false)}
              className="text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 px-2.5 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsConfirmingDelete(true)}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            title="Delete Camera"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {deleteMutation.isError && (
        <div className="mt-2 text-[11px] text-rose-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          <span>Failed to delete camera</span>
        </div>
      )}
    </div>
  );
}
