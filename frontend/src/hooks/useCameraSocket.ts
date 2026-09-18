import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, CameraStatus } from '../api/cameras.api';
import { useNotificationStore } from '../store/notificationStore';

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  window.location.origin;

export interface CameraStatusPayload {
  cameraId: string;
  status: CameraStatus;
  lastSeenAt?: string;
}

export function useCameraSocket(activeCameraId?: string) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  const updateCache = useCallback(
    (data: CameraStatusPayload) => {
      const cached = queryClient.getQueryData<Camera>(['camera', data.cameraId]) ||
        queryClient.getQueryData<Camera[]>(['cameras'])?.find(c => c.id === data.cameraId);
      if (cached?.lastSeenAt && data.lastSeenAt &&
        Date.parse(data.lastSeenAt) < Date.parse(cached.lastSeenAt)) return;
      const changed = cached?.status !== data.status;
      // Notify once per status transition.
      if (changed && data.status === 'DISCONNECTED') {
        useNotificationStore.getState().addNotification({
          type: 'warning',
          title: 'Camera Disconnected',
          message: `Camera ${data.cameraId.slice(0, 8)} has been disconnected.`,
        });
      } else if (changed && data.status === 'ERROR') {
        useNotificationStore.getState().addNotification({
          type: 'error',
          title: 'Camera Connection Error',
          message: `Camera ${data.cameraId.slice(0, 8)} failed to connect or stopped receiving video. The attempt has stopped; check the camera and retry.`,
        });
      } else if (changed && data.status === 'CONNECTED') {
        useNotificationStore.getState().addNotification({
          type: 'success',
          title: 'Camera Connected',
          message: `Camera ${data.cameraId.slice(0, 8)} is online and streaming.`,
        });
      }

      // Direct cache mutation for camera list
      queryClient.setQueryData<Camera[]>(['cameras'], (old) => {
        if (!old) return old;
        return old.map((cam) =>
          cam.id === data.cameraId
            ? {
                ...cam,
                status: data.status,
                lastSeenAt: data.lastSeenAt || cam.lastSeenAt,
              }
            : cam,
        );
      });

      // Direct cache mutation for individual camera details
      queryClient.setQueryData<Camera>(['camera', data.cameraId], (old) => {
        if (!old) return old;
        return {
          ...old,
          status: data.status,
          lastSeenAt: data.lastSeenAt || old.lastSeenAt,
        };
      });
    },
    [queryClient],
  );

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['polling', 'websocket'],
      autoConnect: false,
      timeout: 10000,
    });
    socketRef.current = socket;
    const connectTimer = setTimeout(() => socket.connect(), 0);
    let connectionErrorShown = false;
    socket.on('connect', () => { connectionErrorShown = false; });
    socket.on('connect_error', () => {
      if (connectionErrorShown) return;
      connectionErrorShown = true;
      useNotificationStore.getState().addNotification({ type: 'warning', title: 'Live updates unavailable', message: 'Cannot reach the live update service. Check that the backend is running.' });
    });

    socket.on('camera:status', (data: CameraStatusPayload) => {
      updateCache(data);
    });

    socket.on('camera:event', (data: { cameraId: string; type?: string; payload?: { cameraName?: string; eventType?: string; personCount?: number } }) => {
      if (data?.cameraId) {
        queryClient.invalidateQueries({
          queryKey: ['camera-events', data.cameraId],
        });
        queryClient.invalidateQueries({
          queryKey: ['camera-recordings', data.cameraId],
        });
        if (data.type === 'DETECTION' && data.payload?.eventType?.startsWith('PERSON_')) {
          const exited = data.payload.eventType === 'PERSON_EXITED';
          useNotificationStore.getState().addNotification({
            type: exited ? 'info' : 'warning',
            title: exited ? 'Zone cleared' : 'Person detected',
            message: `${data.payload.cameraName || data.cameraId.slice(0, 8)}: ${exited ? 'No people remain in the selected zone.' : `${data.payload.personCount || 1} person(s) in the selected zone.`}`,
          });
        }
        if (data.type === 'MOTION') {
          useNotificationStore.getState().addNotification({
            type: 'info',
            title: 'Motion Detected',
            message: `Movement detected in the selected zone of ${data.payload?.cameraName || data.cameraId.slice(0, 8)}.`,
          });
        }
      }
    });

    if (activeCameraId) {
      socket.emit('subscribe:camera', { cameraId: activeCameraId });
    }

    return () => {
      clearTimeout(connectTimer);
      if (activeCameraId) {
        socket.emit('unsubscribe:camera', { cameraId: activeCameraId });
      }
      socket.disconnect();
    };
  }, [activeCameraId, updateCache]);

  const subscribeToCamera = useCallback((cameraId: string) => {
    socketRef.current?.emit('subscribe:camera', { cameraId });
  }, []);

  const unsubscribeFromCamera = useCallback((cameraId: string) => {
    socketRef.current?.emit('unsubscribe:camera', { cameraId });
  }, []);

  return {
    socket: socketRef.current,
    subscribeToCamera,
    unsubscribeFromCamera,
  };
}
