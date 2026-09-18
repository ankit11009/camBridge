import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { Activity, Database, CheckCircle2, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface HealthResponse {
  status: string;
  database: string;
  timestamp: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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
          className="inline-flex items-center gap-2 text-xs text-[#617166] hover:text-[#253D2C] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs bg-[#EDF1EA] hover:bg-[#EDF1EA] text-[#253D2C] px-3 py-1.5 rounded-lg border border-[#DCE3D9] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="bg-[#FFFFFF] border border-[#DCE3D9] rounded-2xl p-7 shadow-sm ">
        <div className="flex items-center justify-between border-b border-[#DCE3D9] pb-4 mb-5">
          <div>
            <h1 className="text-lg font-bold text-[#253D2C]">System Health Check</h1>
            <p className="text-xs text-[#617166]">Verifying live communication with backend API and PostgreSQL database</p>
          </div>
          {isLoading ? (
            <span className="flex items-center gap-1.5 text-xs text-[#87622B] bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Checking...
            </span>
          ) : isError ? (
            <span className="flex items-center gap-1.5 text-xs text-[#A4483B] bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
              <AlertCircle className="w-3.5 h-3.5" />
              Unhealthy
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-[#2E6F40] bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Operational
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-[#F8F4EB] border border-[#DCE3D9] flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-[#EDF1EA] text-[#253D2C]">
              <Activity className="w-5 h-5 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[#617166]">Backend API</div>
              <div className="text-sm font-semibold text-[#253D2C] mt-0.5">
                {isLoading ? 'Connecting...' : isError ? 'Connection Failed' : 'HTTP 200 OK'}
              </div>
              <div className="text-xs text-[#617166] mt-1 font-sans truncate">{API_BASE_URL}/health</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#F8F4EB] border border-[#DCE3D9] flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-[#EDF1EA] text-[#253D2C]">
              <Database className="w-5 h-5 text-[#2E6F40]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-[#617166]">PostgreSQL (Prisma)</div>
              <div className="text-sm font-semibold text-[#253D2C] mt-0.5">
                {isLoading
                  ? 'Probing database...'
                  : isError
                  ? 'DB Disconnected'
                  : health?.database === 'connected'
                  ? 'Connected (SELECT 1 OK)'
                  : 'Unknown'}
              </div>
              <div className="text-xs text-[#617166] mt-1 font-sans truncate">
                {health?.timestamp ? `Verified: ${new Date(health.timestamp).toLocaleTimeString()}` : 'No response'}
              </div>
            </div>
          </div>
        </div>

        {isError && (
          <div className="mt-5 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[#A4483B] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Could not reach backend at {API_BASE_URL}. Ensure backend service is running. {(error as Error)?.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
