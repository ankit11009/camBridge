import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CameraCard } from './CameraCard';
import { Camera } from '../api/cameras.api';

describe('CameraCard Component', () => {
  const connectedCamera: Camera = {
    id: 'test-camera-1',
    ownerId: 'user-1',
    name: 'Garage Door Camera',
    pluginType: 'MOCK',
    connectionConfig: { simulateIntervalMs: 5000 },
    status: 'CONNECTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const disconnectedCamera: Camera = {
    id: 'test-camera-2',
    ownerId: 'user-1',
    name: 'Backyard Camera',
    pluginType: 'MOCK',
    connectionConfig: { simulateIntervalMs: 5000 },
    status: 'DISCONNECTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('renders camera details and Disconnect button when connected', () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CameraCard camera={connectedCamera} />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Garage Door Camera')).toBeDefined();
    expect(screen.getByText('MOCK')).toBeDefined();
    expect(screen.getByText('Connected')).toBeDefined();
    expect(screen.getByText('Disconnect')).toBeDefined();
    expect(screen.getByText('Manage')).toBeDefined();
  });

  it('renders Connect button when disconnected', () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CameraCard camera={disconnectedCamera} />
        </BrowserRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByText('Backyard Camera')).toBeDefined();
    expect(screen.getByText('Disconnected')).toBeDefined();
    expect(screen.getByText('Connect')).toBeDefined();
  });
});
