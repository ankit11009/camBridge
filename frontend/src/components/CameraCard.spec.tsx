import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CameraCard } from './CameraCard';
import { Camera } from '../api/cameras.api';

describe('CameraCard Component', () => {
  const mockCamera: Camera = {
    id: 'test-camera-12345678',
    ownerId: 'user-1',
    name: 'Garage Door Camera',
    pluginType: 'MOCK',
    connectionConfig: { simulateIntervalMs: 5000 },
    status: 'CONNECTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('renders camera name, plugin type, and status badge', () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CameraCard camera={mockCamera} />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Garage Door Camera')).toBeDefined();
    expect(screen.getByText('MOCK')).toBeDefined();
    expect(screen.getByText('Connected')).toBeDefined();
    expect(screen.getByText('Manage')).toBeDefined();
  });
});
