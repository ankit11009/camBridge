import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, camerasApi } from '../api/cameras.api';
import { CameraStatusBadge } from './CameraStatusBadge';
import { Video, Trash2, Settings, AlertCircle, Power, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNotificationStore } from '../store/notificationStore';

interface Props {
  camera: Camera;
}

export function CameraCard({ camera }: Props) {
  const queryClient = useQueryClient();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const connectMutation = useMutation({
    mutationFn: () => camerasApi.connect(camera.id),
    onSuccess: (res) => {
      queryClient.setQueryData<Camera[]>(['cameras'], (old) => {
        if (!old) return old;
        return old.map((c) => c.id === camera.id && !(res.lastSeenAt && c.lastSeenAt && Date.parse(res.lastSeenAt) < Date.parse(c.lastSeenAt)) ? { ...c, status: res.status, lastSeenAt: res.lastSeenAt || c.lastSeenAt } : c);
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => camerasApi.disconnect(camera.id),
    onSuccess: (res) => {
      queryClient.setQueryData<Camera[]>(['cameras'], (old) => {
        if (!old) return old;
        return old.map((c) => (c.id === camera.id ? { ...c, status: res.status } : c));
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => camerasApi.delete(camera.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      useNotificationStore.getState().addNotification({
        type: 'info',
        title: 'Camera Deleted',
        message: `Camera ${camera.name} was successfully removed.`,
      });
    },
    onError: (err: any) => {
      useNotificationStore.getState().addNotification({
        type: 'error',
        title: 'Delete Failed',
        message: err.response?.data?.message || 'Failed to delete camera',
      });
    },
  });

  const getPluginBadgeColor = (type: string) => {
    switch (type) {
      case 'MOCK':
        return 'bg-purple-500/10 text-[#66516F] border-purple-500/30';
      case 'RTSP':
        return 'bg-cyan-500/10 text-[#38646A] border-cyan-500/30';
      case 'ONVIF':
        return 'bg-amber-500/10 text-[#87622B] border-amber-500/30';
      default:
        return 'bg-[#EDF1EA] text-[#253D2C] border-[#DCE3D9]';
    }
  };

  const isConnecting = camera.status === 'CONNECTING' || connectMutation.isPending;
  const isConnected = camera.status === 'CONNECTED';

  return (
    <div className="bg-[#FFFFFF] border border-[#DCE3D9] hover:border-[#DCE3D9] transition-all rounded-xl p-5 shadow-sm flex flex-col justify-between group">
      <div>
        {/* Header with Camera Icon and Status */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#EDF1EA] border border-[#DCE3D9] text-indigo-400 group-hover:text-indigo-300 transition-colors">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-[#253D2C] text-base tracking-tight line-clamp-1">
                {camera.name}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-[11px] font-sans px-2 py-0.5 rounded border ${getPluginBadgeColor(
                    camera.pluginType,
                  )}`}
                >
                  {camera.pluginType}
                </span>
                <span className="text-xs text-[#617166] font-sans">
                  {camera.id.slice(0, 8)}...
                </span>
              </div>
            </div>
          </div>
          <CameraStatusBadge status={camera.status} />
        </div>

        {/* Info Grid */}
        <div className="bg-[#F8F4EB] rounded-lg p-3 border border-[#DCE3D9] mb-4 text-xs space-y-1.5">
          <div className="flex justify-between text-[#617166]">
            <span>Added</span>
            <span className="text-[#253D2C]">
              {new Date(camera.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="flex justify-between text-[#617166]">
            <span>Last Active</span>
            <span className="text-[#253D2C] font-sans">
              {camera.lastSeenAt
                ? new Date(camera.lastSeenAt).toLocaleTimeString()
                : 'Never'}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-3 border-t border-[#DCE3D9] space-y-2">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <button
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-[#A4483B] py-2 px-3 rounded-lg border border-rose-500/20 transition-colors disabled:opacity-50"
            >
              <Power className="w-3.5 h-3.5" />
              {disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}
            </button>
          ) : (
            <button
              onClick={() => connectMutation.mutate()}
              disabled={isConnecting}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-[#253D2C] py-2 px-3 rounded-lg transition-colors shadow-sm shadow-emerald-600/20 disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Power className="w-3.5 h-3.5" />
                  Connect
                </>
              )}
            </button>
          )}

          <Link
            to={`/cameras/${camera.id}`}
            className="flex items-center justify-center gap-1.5 text-xs font-medium bg-[#EDF1EA] hover:bg-[#EDF1EA] text-[#253D2C] py-2 px-3 rounded-lg border border-[#DCE3D9] transition-colors"
          >
            <Settings className="w-3.5 h-3.5 text-[#617166]" />
            Manage
          </Link>

          {isConfirmingDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="text-xs bg-rose-600 hover:bg-rose-500 text-[#253D2C] px-2 py-2 rounded-lg font-medium transition-colors"
              >
                Del
              </button>
              <button
                onClick={() => setIsConfirmingDelete(false)}
                className="text-xs bg-[#EDF1EA] text-[#253D2C] hover:bg-[#EDF1EA] px-2 py-2 rounded-lg transition-colors"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsConfirmingDelete(true)}
              className="p-2 text-[#617166] hover:text-[#A4483B] hover:bg-rose-500/10 rounded-lg transition-colors"
              title="Delete Camera"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {(connectMutation.isError || disconnectMutation.isError || deleteMutation.isError) && (
          <div className="text-[11px] text-[#A4483B] flex items-center gap-1 pt-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>Action failed. Check console or server logs.</span>
          </div>
        )}
      </div>
    </div>
  );
}
