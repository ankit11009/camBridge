import { CameraStatus } from '../api/cameras.api';

interface Props {
  status: CameraStatus;
  className?: string;
}

export function CameraStatusBadge({ status, className = '' }: Props) {
  switch (status) {
    case 'CONNECTED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Connected
        </span>
      );
    case 'CONNECTING':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
          Connecting
        </span>
      );
    case 'DISCONNECTED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Disconnected
        </span>
      );
    case 'ERROR':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          Error
        </span>
      );
    case 'UNKNOWN':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
          Unknown
        </span>
      );
  }
}
