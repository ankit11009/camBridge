import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { detectionApi, MotionZone } from '../api/detection.api';

const fullFrame: MotionZone = { x: 0, y: 0, width: 1, height: 1 };

export function MotionDetectionPanel({ cameraId }: { cameraId: string }) {
  const queryClient = useQueryClient();
  const canvas = useRef<HTMLCanvasElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [zone, setZone] = useState<MotionZone | null>(null);
  const [hasFrame, setHasFrame] = useState(false);
  const [message, setMessage] = useState('');
  const { data: status, isLoading, isError } = useQuery({
    queryKey: ['detection-status', cameraId],
    queryFn: () => detectionApi.getStatus(cameraId),
    retry: false,
    refetchInterval: (query) => (query.state.error as any)?.response?.status === 404 ? false : 2000,
  });
  const selected = zone || status?.zone || fullFrame;
  const toggle = useMutation({
    mutationFn: () => detectionApi.toggleDetection(cameraId, !status?.enabled, 2000, selected),
    onSuccess: (data) => {
      queryClient.setQueryData(['detection-status', cameraId], data);
      setMessage('');
    },
    onError: () => setMessage('Could not change person detection. Please try again.'),
  });
  const capture = () => {
    const video = Array.from(document.querySelectorAll('video')).find(v => v.dataset.cameraId === cameraId);
    if (!video || !video.videoWidth || video.readyState < 2 || !canvas.current) {
      setMessage('Connect the camera and wait for live video before selecting a zone.');
      return;
    }
    canvas.current.width = video.videoWidth;
    canvas.current.height = video.videoHeight;
    canvas.current.getContext('2d')?.drawImage(video, 0, 0);
    setHasFrame(true);
    setMessage('');
  };
  return <section data-testid="person-detection-card" className="detection-card p-4 rounded-xl border border-[#DCE3D9] bg-[#F8F4EB] space-y-3">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-[#253D2C]">Person detection</h3>
      <button type="button" disabled={isLoading || isError || toggle.isPending} onClick={() => toggle.mutate()}
        className="px-3 py-2 rounded-lg bg-indigo-600 text-[#253D2C] text-xs disabled:opacity-50">
        {toggle.isPending ? 'Updating…' : status?.enabled ? 'Stop Detection' : 'Start Detection'}
      </button>
    </div>
    <p className="text-xs text-[#617166]">Know when someone enters your zone. Receive alerts while you work elsewhere.</p>
    <p role="status" className="text-xs text-[#253D2C]">{isError ? 'Detection status unavailable.' : status?.enabled ? status.error || (status.running ? 'Monitoring people' : 'Waiting for camera stream') : 'Detection is off'}</p>
    <div className="flex gap-3 text-xs text-indigo-300">
      <button type="button" disabled={status?.enabled} onClick={capture}>Select zone from current frame</button>
      <button type="button" disabled={status?.enabled} onClick={() => setZone(fullFrame)}>Use whole frame</button>
    </div>
    <p className="text-xs text-[#617166]">{status?.enabled ? 'Stop detection to change the zone.' : 'Capture a frame, then drag a rectangle over the area to monitor. Default: whole frame.'}</p>
    <div className={`relative ${hasFrame ? '' : 'hidden'}`}>
      <canvas ref={canvas} className="w-full block touch-none rounded-lg"
        aria-label="Drag to select person detection zone"
        onPointerDown={e => {
          if (status?.enabled) return;
          const r = e.currentTarget.getBoundingClientRect();
          start.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={e => {
          if (!start.current || status?.enabled) return;
          const r = e.currentTarget.getBoundingClientRect();
          const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
          const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
          const width = Math.abs(x - start.current.x), height = Math.abs(y - start.current.y);
          if (width >= 0.01 && height >= 0.01) setZone({ x: Math.min(x, start.current.x), y: Math.min(y, start.current.y), width, height });
        }}
        onPointerUp={() => { start.current = null; }}
        onPointerCancel={() => { start.current = null; }} />
      <div className="absolute border-2 border-emerald-400 bg-emerald-400/10 pointer-events-none" style={{ left: `${selected.x * 100}%`, top: `${selected.y * 100}%`, width: `${selected.width * 100}%`, height: `${selected.height * 100}%` }} />
    </div>
    <p className="text-xs text-[#617166]">Zone: left {Math.round(selected.x * 100)}%, top {Math.round(selected.y * 100)}%, width {Math.round(selected.width * 100)}%, height {Math.round(selected.height * 100)}%.</p>
    {message && <p role="alert" className="text-xs text-[#A4483B]">{message}</p>}
  </section>;
}
