import { create } from 'zustand';

export interface UserProfile {
  id: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: UserProfile, accessToken: string, refreshToken: string) => void;
  setAccessToken: (accessToken: string) => void;
  logout: () => void;
}

const STORAGE_KEY = 'cambridge_auth';

const loadSavedState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saved = loadSavedState();

export const useAuthStore = create<AuthState>((set) => ({
  user: saved?.user ?? null,
  accessToken: saved?.accessToken ?? null,
  refreshToken: saved?.refreshToken ?? null,
  isAuthenticated: !!saved?.accessToken,

  setAuth: (user, accessToken, refreshToken) => {
    const newState = {
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch {}
    set(newState);
  },

  setAccessToken: (accessToken) => {
    set((state) => {
      const updated = { ...state, accessToken };
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            user: state.user,
            accessToken,
            refreshToken: state.refreshToken,
          }),
        );
      } catch {}
      return updated;
    });
  },

  logout: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  },
}));
