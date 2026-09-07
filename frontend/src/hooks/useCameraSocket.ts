import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, CameraStatus } from '../api/cameras.api';

const WS_URL =
  import.meta.env.VITE_WS_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:3000';

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
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on('camera:status', (data: CameraStatusPayload) => {
      updateCache(data);
    });

    if (activeCameraId) {
      socket.emit('subscribe:camera', { cameraId: activeCameraId });
    }

    return () => {
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
