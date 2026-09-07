import { create } from 'zustand';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface InAppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface NotificationState {
  notifications: InAppNotification[];
  addNotification: (
    notification: Omit<InAppNotification, 'id' | 'timestamp' | 'read'>,
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [
    {
      id: 'welcome-notif',
      type: 'info',
      title: 'CamBridge Initialized',
      message: 'Monitoring platform active. All camera plugins operational.',
      timestamp: new Date().toISOString(),
      read: true,
    },
  ],

  addNotification: ({ type, title, message }) => {
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newNotification: InAppNotification = {
      id,
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 50), // keep latest 50
    }));
  },

  markAsRead: (id: string) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    }));
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  removeNotification: (id: string) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
  },
}));
