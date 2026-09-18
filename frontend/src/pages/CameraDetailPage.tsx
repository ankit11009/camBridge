import { RecordingsDrawer } from '../components/RecordingsDrawer';
import { OnvifCredentialsForm } from '../components/OnvifCredentialsForm';
import { MotionDetectionPanel } from '../components/MotionDetectionPanel';
import React, { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { camerasApi, Camera } from '../api/cameras.api';
import { CameraStatusBadge } from '../components/CameraStatusBadge';
import { LiveVideoPlayer } from '../components/LiveVideoPlayer';
import { EventTimeline } from '../components/EventTimeline';
import { useNotificationStore } from '../store/notificationStore';
import { useCameraSocket } from '../hooks/useCameraSocket';
import {
  ArrowLeft,
  Save,
  Trash2,
  AlertCircle,
  Power,
  Circle,
  Square,
  MoreHorizontal,
  Film,
  X,
} from 'lucide-react';

export function CameraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Listen to WebSocket updates for this camera specifically
  useCameraSocket(id);

  const [recordingsOpen, setRecordingsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const connectLock = useRef(false);
  const [name, setName] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
    };
  }, []);

  const {
    data: camera,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['camera', id],
    queryFn: async () => {
      const data = await camerasApi.getById(id!);
      if (!isInitialized) {
        setName(data.name);
        setIsInitialized(true);
      }
      return data;
    },
    enabled: !!id,
  });

  const { data: streamData } = useQuery({
    queryKey: ['camera-stream', id],
    queryFn: () => camerasApi.getStreamSource(id!),
    enabled: !!id && camera?.status === 'CONNECTED',
    refetchInterval: false,
  });

  const startRecordingMutation = useMutation({
    mutationFn: () => camerasApi.startRecording(id!),
    onSuccess: () => {
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
      useNotificationStore.getState().addNotification({
        type: 'info',
        title: 'Recording Started',
        message: `Manual recording started for ${camera?.name || 'camera'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['camera-recordings', id] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to start recording';
      setErrorMsg(msg);
      useNotificationStore.getState().addNotification({
        type: 'error',
        title: 'Recording Failed',
        message: msg,
      });
    },
  });

  const stopRecordingMutation = useMutation({
    mutationFn: () => camerasApi.stopRecording(id!),
    onSuccess: (rec) => {
      setIsRecording(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      queryClient.invalidateQueries({ queryKey: ['camera-recordings', id] });
      useNotificationStore.getState().addNotification({
        type: 'success',
        title: 'Recording Saved',
        message: `Recording clip saved (${rec.duration || 0}s).`,
      });
      setSuccessMsg('Recording saved successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: (err: any) => {
      setIsRecording(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      const msg = err.response?.data?.message || 'Failed to stop recording';
      setErrorMsg(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: () => camerasApi.update(id!, { name: name.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      queryClient.invalidateQueries({ queryKey: ['camera', id] });
      setSuccessMsg('Camera settings updated successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to update camera');
    },
  });

  const connectMutation = useMutation({
    mutationFn: () => camerasApi.connect(id!),
    onMutate: () => { setErrorMsg(''); setSuccessMsg(''); },
    onSettled: () => { connectLock.current = false; },
    onSuccess: (res) => {
      queryClient.setQueryData<Camera>(['camera', id], (old) => {
        if (!old) return old;
        if (res.lastSeenAt && old.lastSeenAt && Date.parse(res.lastSeenAt) < Date.parse(old.lastSeenAt)) return old;
        return { ...old, status: res.status, lastSeenAt: res.lastSeenAt || old.lastSeenAt };
      });
      queryClient.invalidateQueries({ queryKey: ['camera-stream', id] });
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to connect camera');
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => camerasApi.disconnect(id!),
    onSuccess: (res) => {
      queryClient.setQueryData<Camera>(['camera', id], (old) => {
        if (!old) return old;
        return { ...old, status: res.status };
      });
      queryClient.invalidateQueries({ queryKey: ['camera-stream', id] });
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to disconnect camera');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => camerasApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      useNotificationStore.getState().addNotification({
        type: 'info',
        title: 'Camera Deleted',
        message: `Camera ${camera?.name || id} was successfully removed.`,
      });
      navigate('/');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to delete camera';
      setErrorMsg(msg);
      useNotificationStore.getState().addNotification({
        type: 'error',
        title: 'Delete Failed',
        message: msg,
      });
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    updateMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[#617166]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Loading camera details...
      </div>
    );
  }

  if (isError || !camera) {
    return (
      <div className="p-8 text-center bg-[#FFFFFF] border border-[#DCE3D9] rounded-2xl">
        <AlertCircle className="w-8 h-8 text-[#A4483B] mx-auto mb-3" />
        <h2 className="text-base font-semibold text-[#253D2C]">Camera not found</h2>
        <p className="text-xs text-[#617166] mt-1 mb-5">This camera may have been deleted or does not belong to you.</p>
        <Link to="/" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
          &larr; Return to Dashboard
        </Link>
      </div>
    );
  }

  const isConnected = camera.status === 'CONNECTED';
  const isConnecting = camera.status === 'CONNECTING' || connectMutation.isPending;

  const connect = () => {
    if (connectLock.current || isConnecting) return;
    connectLock.current = true;
    connectMutation.mutate();
  };

  return (
    <div className="camera-workspace">
      <Link to="/" className="workspace-back"><ArrowLeft size={15} /> All cameras</Link>
      <header className="workspace-heading">
        <div><h1>{camera.name}</h1></div>
        <div className="workspace-actions">
          <CameraStatusBadge status={isConnecting ? 'CONNECTING' : camera.status} />
          <button className="primary-button" onClick={isConnected ? () => disconnectMutation.mutate() : connect} disabled={isConnecting || disconnectMutation.isPending}>
            <Power size={15} />{isConnecting ? 'Connecting…' : disconnectMutation.isPending ? 'Disconnecting…' : isConnected ? 'Disconnect' : 'Connect camera'}
          </button>
          <button className="secondary-button" aria-expanded={recordingsOpen} aria-controls="recordings-drawer" onClick={() => setRecordingsOpen(true)}><Film size={15} />Recorded videos</button>
          <button className="icon-button" aria-label="Edit camera settings" aria-expanded={editing} onClick={() => setEditing(true)}><MoreHorizontal size={21} /></button>
        </div>
      </header>
      {(errorMsg || successMsg) && <p role={errorMsg ? 'alert' : 'status'} className={`workspace-message ${errorMsg ? 'is-error' : ''}`}>{errorMsg || successMsg}</p>}
      <div className="monitor-layout">
        <section className="monitor-main" aria-label="Live monitoring">
          <div className="video-and-detection">
            <div className="video-card">
              <div className="section-heading"><div><span className="eyebrow">01 / LIVE VIEW</span><h2>Live camera</h2></div><span className="subtle-tag">{camera.pluginType}</span></div>
              <LiveVideoPlayer cameraId={camera.id} cameraStatus={isConnecting ? 'CONNECTING' : camera.status} streamSource={streamData?.streamSource} onRetry={connect} />
              <div className="video-footer"><span>{isRecording ? `Recording · ${Math.floor(recordSeconds / 60)}:${String(recordSeconds % 60).padStart(2, '0')}` : 'Live view · Private connection'}</span>
                <button className="secondary-button" disabled={!isConnected || startRecordingMutation.isPending || stopRecordingMutation.isPending} onClick={() => isRecording ? stopRecordingMutation.mutate() : startRecordingMutation.mutate()}>
                  {isRecording ? <Square size={13} /> : <Circle size={13} />}{isRecording ? 'Stop recording' : 'Record clip'}
                </button>
              </div>
            </div>
            <MotionDetectionPanel key={`detection-${camera.id}`} cameraId={camera.id} />
          </div>
        </section>
        <aside className="activity-column" aria-label="Camera activity"><EventTimeline cameraId={camera.id} pluginType={camera.pluginType} /></aside>
      </div>
      {recordingsOpen && <RecordingsDrawer cameraId={camera.id} cameraName={camera.name} onClose={() => setRecordingsOpen(false)} />}

      {editing && <div className="editor-backdrop" onClick={() => setEditing(false)}>
        <section role="dialog" aria-modal="true" aria-labelledby="edit-camera-title" className="camera-editor" onClick={e => e.stopPropagation()} onKeyDown={e => {
            if (e.key === 'Escape') setEditing(false);
            if (e.key === 'Tab') {
              const nodes = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'));
              const first = nodes[0], last = nodes[nodes.length - 1];
              if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
              else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
            }
          }}>
          <div className="section-heading"><h2 id="edit-camera-title">Camera settings</h2><button className="icon-button" aria-label="Close camera settings" onClick={() => setEditing(false)}><X size={18} /></button></div>
          <form onSubmit={handleSave}><label className="editor-label">Camera name<input autoFocus required value={name} onChange={e => setName(e.target.value)} /></label><button className="primary-button" disabled={updateMutation.isPending}><Save size={14} />{updateMutation.isPending ? 'Saving…' : 'Save changes'}</button></form>
          {camera.pluginType === 'ONVIF' && <OnvifCredentialsForm key={`credentials-${camera.id}`} camera={camera} />}
          <div className="editor-danger"><p>Remove this camera and its history.</p><button className="secondary-button" disabled={deleteMutation.isPending} onClick={() => { if (confirm('Delete this camera and its history?')) deleteMutation.mutate(); }}><Trash2 size={14} />Delete camera</button></div>
        </section>
      </div>}
    </div>
  );
}
