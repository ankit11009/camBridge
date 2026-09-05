import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

describe('App Component', () => {
  it('renders the CamBridge title and Phase 1 badge', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    );

    expect(screen.getByText('CamBridge')).toBeDefined();
    expect(screen.getByText('Phase 1: Foundation')).toBeDefined();
    expect(screen.getByText('System Health Check')).toBeDefined();
  });
});
