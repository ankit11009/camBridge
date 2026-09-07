import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RecordingsList } from './RecordingsList';
import { camerasApi } from '../api/cameras.api';

// Mock camerasApi
vi.mock('../api/cameras.api', () => ({
  camerasApi: {
    listRecordings: vi.fn(),
  },
}));

describe('RecordingsList Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  it('renders empty state when no recordings exist', async () => {
    (camerasApi.listRecordings as any).mockResolvedValue([]);

    render(
      <QueryClientProvider client={queryClient}>
        <RecordingsList cameraId="cam-rec-1" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Recorded Clips')).toBeDefined();
      expect(screen.getByText(/No recordings found for this camera/i)).toBeDefined();
    });
  });

  it('renders recordings list and opens video modal on play', async () => {
    (camerasApi.listRecordings as any).mockResolvedValue([
      {
        id: 'rec-1',
        cameraId: 'cam-rec-1',
        filePath: '/recordings/cam-rec-1/rec_1.mp4',
        videoUrl: '/recordings/cam-rec-1/rec_1.mp4',
        duration: 15,
        sizeBytes: 1048576,
        trigger: 'EVENT',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
      },
    ]);

    render(
      <QueryClientProvider client={queryClient}>
        <RecordingsList cameraId="cam-rec-1" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Motion Event')).toBeDefined();
      expect(screen.getByText('0:15')).toBeDefined();
      expect(screen.getByText('1.0 MB')).toBeDefined();
      expect(screen.getByText('Play Clip')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Play Clip'));

    await waitFor(() => {
      expect(screen.getByText('Download MP4')).toBeDefined();
    });
  });
});
