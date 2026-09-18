import { useEffect, useState } from 'react';
import { useNotificationStore } from '../store/notificationStore';

export function ToastNotifications() {
  const notifications = useNotificationStore(s => s.notifications);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  const visible = notifications.filter(n => !n.read && !dismissed.includes(n.id) && now - Date.parse(n.timestamp) < 7000).slice(0, 4);
  return <div className="fixed top-4 right-4 z-[100] w-80 max-w-[90vw] space-y-2" aria-live="polite">
    {visible.map(n => <div key={n.id} role={n.type === 'error' ? 'alert' : 'status'} className={`rounded-xl border p-4 shadow-sm bg-[#FFFFFF] ${n.type === 'error' ? 'border-rose-500' : n.type === 'success' ? 'border-emerald-500' : 'border-indigo-400'}`}>
      <button aria-label="Dismiss notification" className="float-right text-[#617166]" onClick={() => setDismissed(ids => [...ids, n.id])}>×</button>
      <p className="text-sm font-semibold text-[#253D2C]">{n.title}</p>
      <p className="mt-1 text-xs text-[#253D2C]">{n.message}</p>
    </div>)}
  </div>;
}
