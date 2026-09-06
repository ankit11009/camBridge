import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { camerasApi, PluginType } from '../api/cameras.api';
import { X, Plus, AlertCircle, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateCameraModal({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [pluginType, setPluginType] = useState<PluginType>('MOCK');
  const [rtspUrl, setRtspUrl] = useState('rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4');
  const [simulateIntervalMs, setSimulateIntervalMs] = useState('5000');
  const [errorMessage, setErrorMessage] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      let connectionConfig: Record<string, unknown> = {};

      if (pluginType === 'MOCK') {
        connectionConfig = {
          simulateIntervalMs: parseInt(simulateIntervalMs, 10) || 5000,
        };
      } else if (pluginType === 'RTSP') {
        connectionConfig = {
          rtspUrl: rtspUrl.trim(),
        };
      } else if (pluginType === 'ONVIF') {
        connectionConfig = {
          autoDiscover: true,
        };
      }

      return camerasApi.create({
        name: name.trim(),
        pluginType,
        connectionConfig,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      resetAndClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      setErrorMessage(Array.isArray(msg) ? msg.join(', ') : msg || 'Failed to create camera');
    },
  });

  const resetAndClose = () => {
    setName('');
    setPluginType('MOCK');
    setErrorMessage('');
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Camera name is required');
      return;
    }
    setErrorMessage('');
    createMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={resetAndClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
            <Plus className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-white">Add New Camera</h2>
        </div>
        <p className="text-xs text-slate-400 mb-5">
          Configure a camera using a supported integration plugin.
        </p>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Camera Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Front Door / Backyard"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Plugin Type</label>
            <select
              value={pluginType}
              onChange={(e) => setPluginType(e.target.value as PluginType)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="MOCK">MOCK — Simulated camera (Phase 1–3 tests)</option>
              <option value="RTSP">RTSP — Real-Time Streaming Protocol</option>
              <option value="ONVIF">ONVIF — IP Device Discovery & Profile S</option>
            </select>
          </div>

          {/* Dynamic Configuration based on Plugin Type */}
          {pluginType === 'MOCK' && (
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-purple-400 font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                Mock Camera Options
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Simulation Interval (ms)</label>
                <input
                  type="number"
                  value={simulateIntervalMs}
                  onChange={(e) => setSimulateIntervalMs(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                />
              </div>
            </div>
          )}

          {pluginType === 'RTSP' && (
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-2">
              <label className="block text-xs text-cyan-400 font-medium mb-1">RTSP Stream URL</label>
              <input
                type="text"
                value={rtspUrl}
                onChange={(e) => setRtspUrl(e.target.value)}
                placeholder="rtsp://admin:pass@192.168.1.100:554/stream1"
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white font-mono"
              />
            </div>
          )}

          {pluginType === 'ONVIF' && (
            <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs text-amber-300/90">
              ONVIF devices will be discovered and mapped to their RTSP stream profile.
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-indigo-600/20 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Camera'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
