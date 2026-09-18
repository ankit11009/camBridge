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
    <header className="border-b border-[#DCE3D9] bg-[#FFFFFF] backdrop-blur z-40 px-6 py-3.5 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <Link to="/" className="flex items-center space-x-2.5 group">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30 group-hover:border-indigo-500/50 transition-colors">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-[#253D2C] flex items-center gap-2">
              CamBridge

            </div>
            <div className="text-[11px] text-[#617166]">Spaces, connected.</div>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <Link
          to="/health-check"
          className="text-xs text-[#617166] hover:text-[#253D2C] flex items-center gap-1.5 transition-colors hidden sm:flex"
        >
          <Activity className="w-3.5 h-3.5 text-[#2E6F40]" />
          System Health
        </Link>

        {user && <NotificationBell />}

        {user && (
          <div className="flex items-center gap-3 pl-4 border-l border-[#DCE3D9]">
            <div className="flex items-center gap-2 text-xs text-[#253D2C]">
              <div className="w-7 h-7 rounded-full bg-[#EDF1EA] border border-[#DCE3D9] flex items-center justify-center text-[#617166]">
                <User className="w-3.5 h-3.5" />
              </div>
              <span className="font-sans text-xs hidden md:inline">{user.email}</span>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 text-[#617166] hover:text-[#A4483B] hover:bg-rose-500/10 rounded-lg transition-colors"
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
