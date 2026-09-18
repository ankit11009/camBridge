import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Navbar } from './Navbar';

export function ProtectedRoute() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#F8F4EB] text-[#253D2C] flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-[1680px] mx-auto w-full p-6">
        <Outlet />
      </main>
      <footer className="border-t border-[#DCE3D9] py-4 px-6 text-center text-xs text-[#617166]">
        CamBridge · A clearer view of your space
      </footer>
    </div>
  );
}
