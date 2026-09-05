import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Activity, Camera, Database, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface HealthResponse {
  status: string;
  database: string;
  timestamp: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default function App() {
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              CamBridge
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Phase 1: Foundation
              </span>
            </h1>
            <p className="text-xs text-slate-400">Plugin-based camera integration & monitoring platform</p>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-md transition-colors border border-slate-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh Status
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full p-6 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
            <div>
              <h2 className="text-lg font-semibold text-white">System Health Check</h2>
              <p className="text-sm text-slate-400">Verifying end-to-end communication with backend API and PostgreSQL database</p>
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
                All Systems Operational
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Backend API status */}
            <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start gap-4">
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

            {/* Database status */}
            <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start gap-4">
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

        {/* Phase Roadmap Overview */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">Architecture & Pipeline Status</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            <div className="p-3 bg-indigo-950/40 border border-indigo-500/40 rounded-lg text-indigo-200">
              <div className="font-semibold">Phase 1</div>
              <div className="text-[11px] text-indigo-400 mt-1">Foundation (Active)</div>
            </div>
            <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg text-slate-500">
              <div className="font-semibold">Phase 2</div>
              <div className="text-[11px] text-slate-600 mt-1">Auth & Camera CRUD</div>
            </div>
            <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg text-slate-500">
              <div className="font-semibold">Phase 3</div>
              <div className="text-[11px] text-slate-600 mt-1">Plugin System & WS</div>
            </div>
            <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-lg text-slate-500">
              <div className="font-semibold">Phase 4</div>
              <div className="text-[11px] text-slate-600 mt-1">RTSP & HLS Video</div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-800/60 py-3 px-6 text-center text-xs text-slate-500">
        CamBridge Platform &bull; Built with NestJS 10, React 18, Vite, Prisma & Tailwind
      </footer>
    </div>
  );
}
