import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  logout: () => void;
  loadUser: () => void;
  setUser: (user: User, token: string) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setUser: (user, token) => {
    localStorage.setItem('goapi_token', token);
    localStorage.setItem('goapi_user', JSON.stringify(user));
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('goapi_token');
    localStorage.removeItem('goapi_user');
    set({ user: null, token: null });
  },

  loadUser: () => {
    const token = localStorage.getItem('goapi_token');
    const userStr = localStorage.getItem('goapi_user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ token, user, isLoading: false });
      } catch {
        set({ isLoading: false });
      }
    } else {
      set({ isLoading: false });
    }
  },
}));
