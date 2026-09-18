import React, { useEffect, useState } from 'react';
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
  const [manualAddress, setManualAddress] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

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
    mutationFn: async (device: DiscoveredDevice) => {
      setErrorMsg('');
      const input: CreateCameraInput = {
        name: device.name || 'ONVIF Camera',
        pluginType: 'ONVIF',
        connectionConfig: {
          deviceUrl: device.address,
          username,
          password,
          rtspUrl: device.metadata?.rtspUrl,
          hardware: device.metadata?.hardware,
        },
      };
      const camera = await camerasApi.create(input);
      try {
        await camerasApi.connect(camera.id);
      } catch (err: any) {
        setErrorMsg(err.response?.data?.message || 'Camera saved, but ONVIF connection failed. Check its ONVIF credentials in camera settings and reconnect.');
      }
      return camera;
    },
    onError: (err: any) => setErrorMsg(err.response?.data?.message || 'Could not add camera'),
    onSuccess: (_, device) => {
      setAddedIds((prev) => ({ ...prev, [device.id]: true }));
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      onCameraAdded?.();
      setPassword('');
    },
  });

  useEffect(() => {
    if (isOpen) scanMutation.mutate();
    else setPassword('');
  }, [isOpen]);

  const addByAddress = () => {
    try {
      const value = manualAddress.trim();
      const url = new URL(value.includes('://') ? value : `http://${value}`);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error();
      if (url.pathname === '/') url.pathname = '/onvif/device_service';
      addMutation.mutate({ id: url.href, name: `ONVIF Camera (${url.hostname})`, address: url.href });
    } catch {
      setErrorMsg('Enter the camera IP address or its HTTP/HTTPS ONVIF device service URL.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#F8F4EB] backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-[#FFFFFF] border border-[#DCE3D9] rounded-2xl p-6 shadow-sm space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#DCE3D9]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Radar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#253D2C]">Network Discovery</h2>
              <p className="text-xs text-[#617166] mt-0.5">
                Scan local subnet for ONVIF-compatible IP cameras via WS-Discovery
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#617166] hover:text-[#253D2C] rounded-lg hover:bg-[#EDF1EA] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scan Actions & Alert */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[#253D2C] font-medium text-xs py-2 px-4 rounded-xl transition-all shadow-sm shadow-indigo-600/20"
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
            <span className="text-xs text-[#617166] font-sans">
              {devices.length} {devices.length === 1 ? 'device' : 'devices'} discovered
            </span>
          )}
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-[#A4483B] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-[#617166]">ONVIF username
            <input className="mt-1 w-full bg-[#F8F4EB] border border-[#DCE3D9] rounded p-2" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
          </label>
          <label className="text-xs text-[#617166]">ONVIF password
            <input className="mt-1 w-full bg-[#F8F4EB] border border-[#DCE3D9] rounded p-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </label>
        </div>
        <div className="space-y-2">
          <label className="block text-xs text-[#617166]">Camera IP or ONVIF service URL
            <input value={manualAddress} onChange={e => setManualAddress(e.target.value)} placeholder="192.168.1.120:80"
              className="mt-1 w-full bg-[#F8F4EB] border border-[#DCE3D9] rounded p-2" />
          </label>
          <button onClick={addByAddress} disabled={!manualAddress.trim() || addMutation.isPending}
            className="text-xs text-indigo-300 disabled:opacity-50">Add and connect by address</button>
          <p className="text-xs text-[#617166]">Use the camera’s ONVIF account. Address entry also works when multicast discovery is blocked.</p>
        </div>
        {/* Discovered List */}
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {devices.map((device) => {
            const isAdded = addedIds[device.id];
            return (
              <div
                key={device.id}
                className="p-4 bg-[#F8F4EB] border border-[#DCE3D9] rounded-xl flex items-center justify-between gap-4 hover:border-[#DCE3D9] transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-[#EDF1EA] text-indigo-400 rounded-lg shrink-0 mt-0.5">
                    <Video className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#253D2C]">{device.name}</h4>
                    <p className="text-xs text-[#617166] font-sans mt-0.5 break-all">
                      {device.address}
                    </p>
                    {device.metadata?.hardware && (
                      <span className="inline-block mt-1 text-[10px] font-sans px-1.5 py-0.5 rounded bg-[#EDF1EA] text-[#253D2C]">
                        {device.metadata.hardware}
                      </span>
                    )}
                  </div>
                </div>

                <div className="shrink-0">
                  {isAdded ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E6F40] py-1.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
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
                      Add and Connect
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {hasScanned && !scanMutation.isPending && devices.length === 0 && (
            <div className="p-8 text-center bg-[#F8F4EB] rounded-xl border border-dashed border-[#DCE3D9]">
              <Radar className="w-8 h-8 text-[#617166] mx-auto mb-2 opacity-60" />
              <p className="text-sm font-medium text-[#253D2C]">No ONVIF Cameras Found</p>
              <p className="text-xs text-[#617166] mt-1 max-w-sm mx-auto">
                Ensure your IP camera is connected to the same subnet with ONVIF and WS-Discovery enabled, or enter its ONVIF address above. The scan runs on the backend computer’s network.
              </p>
            </div>
          )}

          {!hasScanned && !scanMutation.isPending && (
            <div className="p-8 text-center bg-[#F8F4EB] rounded-xl border border-dashed border-[#DCE3D9]">
              <Radar className="w-8 h-8 text-indigo-400 mx-auto mb-2 opacity-70 animate-pulse" />
              <p className="text-sm font-medium text-[#253D2C]">Ready to Scan Subnet</p>
              <p className="text-xs text-[#617166] mt-1">
                Click &ldquo;Scan Network Now&rdquo; to broadcast a probe and locate ONVIF cameras.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#DCE3D9] flex items-center justify-between text-xs text-[#617166]">
          <div className="flex items-center gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Port 3702 UDP Multicast</span>
          </div>
          <button
            onClick={onClose}
            className="text-[#617166] hover:text-[#253D2C] px-3 py-1.5 rounded-lg hover:bg-[#EDF1EA] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
