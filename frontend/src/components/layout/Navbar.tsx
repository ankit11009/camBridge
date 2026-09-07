import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Camera, LogOut, User, Activity } from 'lucide-react';
import { NotificationBell } from '../NotificationBell';

export function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <Link to="/" className="flex items-center space-x-2.5 group">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30 group-hover:border-indigo-500/50 transition-colors">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              CamBridge
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Phase 6
              </span>
            </div>
            <div className="text-[11px] text-slate-400">Plugin Camera Platform</div>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <Link
          to="/health-check"
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors hidden sm:flex"
        >
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          System Health
        </Link>

        {user && <NotificationBell />}

        {user && (
          <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="font-mono text-xs hidden md:inline">{user.email}</span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
