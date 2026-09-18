import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, camerasApi } from '../api/cameras.api';

export function OnvifCredentialsForm({ camera }: { camera: Camera }) {
  const client = useQueryClient();
  const [deviceUrl, setDeviceUrl] = useState(String(camera.connectionConfig.deviceUrl || camera.connectionConfig.address || ''));
  const [username, setUsername] = useState(String(camera.connectionConfig.username || ''));
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState(false);
  const mutation = useMutation({
    mutationFn: async () => {
      setSaved(false);
      await camerasApi.update(camera.id, { connectionConfig: {
        ...camera.connectionConfig, deviceUrl: deviceUrl.trim(), username: username.trim(),
        password: password || camera.connectionConfig.password || '',
      } });
      setSaved(true);
      setPassword('');
      return camerasApi.connect(camera.id);
    },
    onSettled: () => {
      client.invalidateQueries({ queryKey: ['camera', camera.id] });
      client.invalidateQueries({ queryKey: ['cameras'] });
      client.invalidateQueries({ queryKey: ['camera-stream', camera.id] });
    },
  });
  return <form className="p-4 rounded-xl border border-[#DCE3D9] space-y-3" onSubmit={e => { e.preventDefault(); mutation.mutate(); }}>
    <h3 className="text-sm font-semibold text-[#253D2C]">ONVIF camera credentials</h3>
    <p className="text-xs text-[#617166]">Use the ONVIF account configured on the camera. Some cameras require enabling ONVIF and creating a separate ONVIF user.</p>
    <label className="block text-xs text-[#253D2C]">ONVIF service URL
      <input required={!camera.connectionConfig.rtspUrl} type="url" value={deviceUrl} onChange={e => setDeviceUrl(e.target.value)} placeholder="http://192.168.1.120/onvif/device_service" className="block w-full mt-1 p-2 border rounded" />
    </label>
    <label className="block text-xs text-[#253D2C]">ONVIF username
      <input required value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" className="block w-full mt-1 p-2 bg-[#F8F4EB] border border-[#DCE3D9] rounded" />
    </label>
    <label className="block text-xs text-[#253D2C]">ONVIF password
      <input type="password" required={!camera.connectionConfig.password} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" placeholder={camera.connectionConfig.password ? 'Leave blank to keep saved password' : ''} className="block w-full mt-1 p-2 bg-[#F8F4EB] border border-[#DCE3D9] rounded" />
    </label>
    <button disabled={mutation.isPending} className="px-3 py-2 rounded bg-indigo-600 text-[#253D2C] text-xs disabled:opacity-50">{mutation.isPending ? 'Connecting…' : 'Save and reconnect'}</button>
    {mutation.isError && <p role="alert" className="text-xs text-[#A4483B]">{saved ? 'Credentials saved. ' : ''}{(mutation.error as any).response?.data?.message || 'Could not save or connect to the camera.'}</p>}
    {mutation.isSuccess && <p role="status" className="text-xs text-[#2E6F40]">Credentials saved. Connection requested.</p>}
  </form>;
}
