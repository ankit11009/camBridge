import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { useAuthStore } from './store/authStore';

describe('App Component', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
    useAuthStore.getState().logout();
  });

  it('renders login page when unauthenticated and navigating to root', () => {
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

    expect(screen.getByText('Sign in to CamBridge')).toBeDefined();
    expect(screen.getByText('Sign In')).toBeDefined();
    expect(screen.getByText('Email address')).toBeDefined();
  });

  it('renders dashboard when authenticated and navigating to root', () => {
    useAuthStore.getState().setAuth(
      { id: 'user-1', email: 'demo@cambridge.dev' },
      'access_token',
      'refresh_token',
    );
    window.history.pushState({}, '', '/');

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

    expect(screen.getByText('Camera Dashboard')).toBeDefined();
    expect(screen.getByText('Add Camera')).toBeDefined();
  });
});
