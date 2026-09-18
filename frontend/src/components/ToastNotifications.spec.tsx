import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastNotifications } from './ToastNotifications';
import { useNotificationStore } from '../store/notificationStore';
afterEach(() => { cleanup(); vi.useRealTimers(); useNotificationStore.getState().clearAll(); });
it('shows action notifications and expires them while preserving notification history', () => {
  vi.useFakeTimers();
  render(<ToastNotifications />);
  act(() => useNotificationStore.getState().addNotification({ type: 'success', title: 'Success', message: 'Logged in successfully.' }));
  expect(screen.getByText('Logged in successfully.')).toBeDefined();
  act(() => vi.advanceTimersByTime(7500));
  expect(screen.queryByText('Logged in successfully.')).toBeNull();
  expect(useNotificationStore.getState().notifications.some(n => n.message === 'Logged in successfully.')).toBe(true);
});
it('allows dismissing a failure toast', () => {
  useNotificationStore.getState().addNotification({ type: 'error', title: 'Unable to connect', message: 'Timed out' });
  render(<ToastNotifications />);
  expect(screen.getByRole('alert')).toBeDefined();
  fireEvent.click(screen.getByLabelText('Dismiss notification'));
  expect(screen.queryByRole('alert')).toBeNull();
});
