import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Activity, Database, CheckCircle2, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HealthResponse {
  status: string;
  database: string;
  timestamp: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export function HealthCheckPage() {
  const {
    data: health,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE_URL}/health`);
      return response.data;
    },
    refetchInterval: 10000,
  });

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
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div>
            <h1 className="text-lg font-bold text-white">System Health Check</h1>
            <p className="text-xs text-slate-400">Verifying live communication with backend API and PostgreSQL database</p>
          </div>
          {isLoading ? (
            <span className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Checking...
            </span>
          ) : isError ? (
            <span className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
              <AlertCircle className="w-3.5 h-3.5" />
              Unhealthy
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Operational
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-slate-800 text-slate-300">
              <Activity className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-400">Backend API</div>
              <div className="text-sm font-semibold text-white mt-0.5">
                {isLoading ? 'Connecting...' : isError ? 'Connection Failed' : 'HTTP 200 OK'}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono truncate">{API_BASE_URL}/health</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-slate-800 text-slate-300">
              <Database className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-400">PostgreSQL (Prisma)</div>
              <div className="text-sm font-semibold text-white mt-0.5">
                {isLoading
                  ? 'Probing database...'
                  : isError
                  ? 'DB Disconnected'
                  : health?.database === 'connected'
                  ? 'Connected (SELECT 1 OK)'
                  : 'Unknown'}
              </div>
              <div className="text-xs text-slate-500 mt-1 font-mono truncate">
                {health?.timestamp ? `Verified: ${new Date(health.timestamp).toLocaleTimeString()}` : 'No response'}
              </div>
            </div>
          </div>
        </div>

        {isError && (
          <div className="mt-5 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Could not reach backend at {API_BASE_URL}. Ensure backend service is running. {(error as Error)?.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
