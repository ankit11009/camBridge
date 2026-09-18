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
  const [deviceUrl, setDeviceUrl] = useState('');
  const [onvifUsername, setOnvifUsername] = useState('');
  const [onvifPassword, setOnvifPassword] = useState('');
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
          deviceUrl: deviceUrl.trim(), username: onvifUsername.trim(), password: onvifPassword,
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
    setDeviceUrl(''); setOnvifUsername(''); setOnvifPassword('');
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
      <div className="bg-[#FFFFFF] border border-[#DCE3D9] rounded-2xl max-w-md w-full p-6 shadow-sm relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={resetAndClose}
          className="absolute top-5 right-5 text-[#617166] hover:text-[#253D2C] p-1 rounded-lg hover:bg-[#EDF1EA] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
            <Plus className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-[#253D2C]">Add New Camera</h2>
        </div>
        <p className="text-xs text-[#617166] mb-5">
          Configure a camera using a supported integration plugin.
        </p>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-[#A4483B] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#253D2C] mb-1">Camera Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Front Door / Backyard"
              className="w-full px-3.5 py-2.5 bg-[#F8F4EB] border border-[#DCE3D9] rounded-lg text-sm text-[#253D2C] placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#253D2C] mb-1">Plugin Type</label>
            <select
              value={pluginType}
              onChange={(e) => setPluginType(e.target.value as PluginType)}
              className="w-full px-3.5 py-2.5 bg-[#F8F4EB] border border-[#DCE3D9] rounded-lg text-sm text-[#253D2C] focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="MOCK">MOCK — Simulated camera (Phase 1–3 tests)</option>
              <option value="RTSP">RTSP — Real-Time Streaming Protocol</option>
              <option value="ONVIF">ONVIF — IP Device Discovery & Profile S</option>
            </select>
          </div>

          {/* Dynamic Configuration based on Plugin Type */}
          {pluginType === 'MOCK' && (
            <div className="p-3 bg-[#F8F4EB] border border-[#DCE3D9] rounded-lg space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-[#66516F] font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                Mock Camera Options
              </div>
              <div>
                <label className="block text-[11px] text-[#617166] mb-1">Simulation Interval (ms)</label>
                <input
                  type="number"
                  value={simulateIntervalMs}
                  onChange={(e) => setSimulateIntervalMs(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#FFFFFF] border border-[#DCE3D9] rounded text-xs text-[#253D2C]"
                />
              </div>
            </div>
          )}

          {pluginType === 'RTSP' && (
            <div className="p-3 bg-[#F8F4EB] border border-[#DCE3D9] rounded-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs text-[#38646A] font-medium">RTSP Stream URL</label>
                <span className="text-[10px] text-[#617166]">MediaMTX / IP Camera</span>
              </div>
              <input
                type="text"
                value={rtspUrl}
                onChange={(e) => setRtspUrl(e.target.value)}
                placeholder="rtsp://localhost:8554/webcam"
                className="w-full px-3 py-1.5 bg-[#FFFFFF] border border-[#DCE3D9] rounded text-xs text-[#253D2C] font-sans focus:outline-none focus:border-cyan-500"
              />
              <div className="space-y-1 pt-1">
                <div className="text-[11px] text-[#617166]">Quick Presets:</div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRtspUrl('rtsp://localhost:8554/webcam')}
                    className="px-2 py-0.5 rounded text-[10px] bg-cyan-950/80 border border-cyan-800/60 text-[#38646A] hover:bg-cyan-900/90 transition-colors"
                  >
                    📹 MediaMTX Webcam
                  </button>
                  <button
                    type="button"
                    onClick={() => setRtspUrl('rtsp://localhost:8554/sample')}
                    className="px-2 py-0.5 rounded text-[10px] bg-[#EDF1EA] border border-[#DCE3D9] text-[#253D2C] hover:bg-[#EDF1EA] transition-colors"
                  >
                    🎬 MediaMTX Sample
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setRtspUrl('rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4')
                    }
                    className="px-2 py-0.5 rounded text-[10px] bg-[#EDF1EA] border border-[#DCE3D9] text-[#253D2C] hover:bg-[#EDF1EA] transition-colors"
                  >
                    🐰 BigBuckBunny
                  </button>
                </div>
              </div>
            </div>
          )}

          {pluginType === 'ONVIF' && (
            <div className="p-3 bg-[#F8F4EB] border border-[#DCE3D9] rounded-lg text-xs text-[#87622B]/90">
              <p>Enter the camera’s ONVIF service address, or use Scan Network to find it.</p>
              <label className="block mt-3">ONVIF service URL<input required type="url" placeholder="http://192.168.1.120/onvif/device_service" value={deviceUrl} onChange={e => setDeviceUrl(e.target.value)} className="block w-full p-2 border rounded mt-1" /></label>
              <label className="block mt-3">ONVIF username<input value={onvifUsername} onChange={e => setOnvifUsername(e.target.value)} className="block w-full p-2 border rounded mt-1" /></label>
              <label className="block mt-3">ONVIF password<input type="password" autoComplete="new-password" value={onvifPassword} onChange={e => setOnvifPassword(e.target.value)} className="block w-full p-2 border rounded mt-1" /></label>
            </div>
          )}

          <div className="pt-3 border-t border-[#DCE3D9] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="px-4 py-2 bg-[#EDF1EA] hover:bg-[#EDF1EA] text-[#253D2C] rounded-lg text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-[#253D2C] rounded-lg text-xs font-semibold shadow-sm shadow-indigo-600/20 transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Camera'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
