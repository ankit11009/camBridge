import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { camerasApi } from '../api/cameras.api';
import { CameraStatusBadge } from '../components/CameraStatusBadge';
import { ArrowLeft, Save, Trash2, Video, CheckCircle2, AlertCircle } from 'lucide-react';

export function CameraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

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

  const deleteMutation = useMutation({
    mutationFn: () => camerasApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      navigate('/');
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
      <div className="p-8 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Loading camera details...
      </div>
    );
  }

  if (isError || !camera) {
    return (
      <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
        <h2 className="text-base font-semibold text-white">Camera not found</h2>
        <p className="text-xs text-slate-400 mt-1 mb-5">This camera may have been deleted or does not belong to you.</p>
        <Link to="/" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
          &larr; Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <button
          onClick={() => {
            if (confirm('Are you sure you want to delete this camera?')) {
              deleteMutation.mutate();
            }
          }}
          className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 py-1.5 px-3 rounded-lg border border-rose-500/20 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete Camera
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 shadow-xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{camera.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  {camera.pluginType}
                </span>
                <span className="text-xs text-slate-500 font-mono">{camera.id}</span>
              </div>
            </div>
          </div>
          <CameraStatusBadge status={camera.status} />
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Edit Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Camera Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Connection Config (Decrypted)</label>
            <pre className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-300 overflow-x-auto">
              {JSON.stringify(camera.connectionConfig || {}, null, 2)}
            </pre>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex items-center gap-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
