import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventTimeline } from './EventTimeline';
import { camerasApi } from '../api/cameras.api';

// Mock camerasApi
vi.mock('../api/cameras.api', () => ({
  camerasApi: {
    getEvents: vi.fn(),
    triggerEvent: vi.fn(),
  },
}));

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn().mockReturnValue({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

describe('EventTimeline Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('renders loading and then displays events list', async () => {
    (camerasApi.getEvents as any).mockResolvedValue([
      {
        id: 'ev-1',
        cameraId: 'cam-101',
        type: 'STATUS',
        payload: { status: 'CONNECTED' },
        createdAt: new Date().toISOString(),
      },
      {
        id: 'ev-2',
        cameraId: 'cam-101',
        type: 'MOTION',
        payload: { zone: 'front_door', confidence: 0.95 },
        createdAt: new Date().toISOString(),
      },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <EventTimeline cameraId="cam-101" pluginType="MOCK" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Activity Timeline')).toBeDefined();
      expect(screen.getByText('STATUS')).toBeDefined();
      expect(screen.getByText('MOTION')).toBeDefined();
      expect(screen.getByText('Simulate Motion')).toBeDefined();
    });
  });

  it('triggers simulated motion event when Simulate Motion is clicked', async () => {
    (camerasApi.getEvents as any).mockResolvedValue([]);
    (camerasApi.triggerEvent as any).mockResolvedValue({
      id: 'ev-sim',
      cameraId: 'cam-101',
      type: 'MOTION',
      payload: { zone: 'front_porch', confidence: 0.96 },
      createdAt: new Date().toISOString(),
    });

    render(
      <QueryClientProvider client={queryClient}>
        <EventTimeline cameraId="cam-101" pluginType="MOCK" />
      </QueryClientProvider>,
    );

    const btn = screen.getByText('Simulate Motion');
    fireEvent.click(btn);

    await waitFor(() => {
      expect(camerasApi.triggerEvent).toHaveBeenCalledWith(
        'cam-101',
        'MOTION',
        expect.any(Object),
      );
    });
  });
});
