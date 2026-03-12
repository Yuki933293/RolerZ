import { create } from 'zustand';
import { useConfig } from './useConfig';
import { useGenerateSession } from './useGenerateSession';

interface AuthStore {
  token: string | null;
  username: string | null;
  isAdmin: boolean;
  login: (token: string, username: string, isAdmin?: boolean) => void;
  logout: () => void;
}

export const useAuth = create<AuthStore>((set) => ({
  token: localStorage.getItem('token'),
  username: localStorage.getItem('username'),
  isAdmin: localStorage.getItem('isAdmin') === 'true',
  login: (token, username, isAdmin = false) => {
    localStorage.setItem('token', token);
    localStorage.setItem('username', username);
    localStorage.setItem('isAdmin', String(isAdmin));
    set({ token, username, isAdmin });
    // Load user config from server
    useConfig.getState().loadFromServer();
  },
  logout: () => {
    // Save current config before logout
    const config = useConfig.getState();
    if (localStorage.getItem('token')) {
      config.saveToServer();
    }
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('isAdmin');
    set({ token: null, username: null, isAdmin: false });
    config.resetToDefaults();
    useGenerateSession.getState().clearSession();
  },
}));
