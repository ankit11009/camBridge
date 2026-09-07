import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Radar,
  Loader2,
  Plus,
  CheckCircle2,
  AlertCircle,
  Video,
  ExternalLink,
} from 'lucide-react';
import { camerasApi, DiscoveredDevice, CreateCameraInput } from '../api/cameras.api';

export interface DiscoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCameraAdded?: () => void;
}

export const DiscoverModal: React.FC<DiscoverModalProps> = ({
  isOpen,
  onClose,
  onCameraAdded,
}) => {
  const queryClient = useQueryClient();
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState('');

  const scanMutation = useMutation({
    mutationFn: () => camerasApi.discover(),
    onSuccess: (data) => {
      setDevices(data);
      setHasScanned(true);
      setErrorMsg('');
    },
    onError: (err: any) => {
      setErrorMsg(
        err.response?.data?.message || 'Failed to scan network for ONVIF cameras',
      );
      setHasScanned(true);
    },
  });

  const addMutation = useMutation({
    mutationFn: (device: DiscoveredDevice) => {
      const input: CreateCameraInput = {
        name: device.name || 'ONVIF Camera',
        pluginType: 'ONVIF',
        connectionConfig: {
          deviceUrl: device.address,
          rtspUrl: device.metadata?.rtspUrl,
          hardware: device.metadata?.hardware,
        },
      };
      return camerasApi.create(input);
    },
    onSuccess: (_, device) => {
      setAddedIds((prev) => ({ ...prev, [device.id]: true }));
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      onCameraAdded?.();
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Radar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Network Discovery</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Scan local subnet for ONVIF-compatible IP cameras via WS-Discovery
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scan Actions & Alert */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs py-2 px-4 rounded-xl transition-all shadow-lg shadow-indigo-600/20"
          >
            {scanMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Scanning Local Subnet...
              </>
            ) : (
              <>
                <Radar className="w-3.5 h-3.5" />
                {hasScanned ? 'Scan Again' : 'Scan Network Now'}
              </>
            )}
          </button>

          {hasScanned && !scanMutation.isPending && (
            <span className="text-xs text-slate-400 font-mono">
              {devices.length} {devices.length === 1 ? 'device' : 'devices'} discovered
            </span>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Discovered List */}
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {devices.map((device) => {
            const isAdded = addedIds[device.id];
            return (
              <div
                key={device.id}
                className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between gap-4 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-slate-800 text-indigo-400 rounded-lg shrink-0 mt-0.5">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{device.name}</h4>
                    <p className="text-xs text-slate-400 font-mono mt-0.5 break-all">
                      {device.address}
                    </p>
                    {device.metadata?.hardware && (
                      <span className="inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {device.metadata.hardware}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {isAdded ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 py-1.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Added
                    </span>
                  ) : (
                    <button
                      onClick={() => addMutation.mutate(device)}
                      disabled={addMutation.isPending}
                      className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 py-1.5 px-3 rounded-lg border border-indigo-500/30 transition-colors disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add to Fleet
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {hasScanned && !scanMutation.isPending && devices.length === 0 && (
            <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
              <Radar className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
              <p className="text-sm font-medium text-slate-300">No ONVIF Cameras Found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Ensure your IP camera is connected to the same subnet with ONVIF and WS-Discovery enabled, or add it manually via RTSP URL.
              </p>
            </div>
          )}

          {!hasScanned && !scanMutation.isPending && (
            <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-dashed border-slate-800">
              <Radar className="w-8 h-8 text-indigo-400 mx-auto mb-2 opacity-70 animate-pulse" />
              <p className="text-sm font-medium text-slate-300">Ready to Scan Subnet</p>
              <p className="text-xs text-slate-500 mt-1">
                Click &ldquo;Scan Network Now&rdquo; to broadcast a probe and locate ONVIF cameras.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Port 3702 UDP Multicast</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
