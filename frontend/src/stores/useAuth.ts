import { create } from 'zustand';
import { useConfig } from './useConfig';

interface AuthStore {
  token: string | null;
  username: string | null;
  login: (token: string, username: string) => void;
  logout: () => void;
}

export const useAuth = create<AuthStore>((set) => ({
  token: localStorage.getItem('token'),
  username: localStorage.getItem('username'),
  login: (token, username) => {
    localStorage.setItem('token', token);
    localStorage.setItem('username', username);
    set({ token, username });
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
    set({ token: null, username: null });
    config.resetToDefaults();
  },
}));
