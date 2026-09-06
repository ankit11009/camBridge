import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Navbar } from './Navbar';

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl mx-auto w-full p-6">
        <Outlet />
      </main>
      <footer className="border-t border-slate-900 py-4 px-6 text-center text-xs text-slate-500">
        CamBridge Platform &bull; Phase 2: Auth & Camera CRUD
      </footer>
    </div>
  );
}
