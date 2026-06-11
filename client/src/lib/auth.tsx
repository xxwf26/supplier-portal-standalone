import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '@/api';

interface AuthUser { username: string; role: 'admin' | 'viewer'; }
interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null, token: null,
  login: async () => {}, logout: () => {},
  isAdmin: false, isLoggedIn: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('auth');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUser(parsed.user);
        setToken(parsed.token);
      } catch {}
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await api.post('/api/auth/login', { username, password });
    const auth = { user: res.data.user, token: res.data.access_token };
    localStorage.setItem('auth', JSON.stringify(auth));
    setUser(auth.user);
    setToken(auth.token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth');
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, token, login, logout,
      isAdmin: user?.role === 'admin',
      isLoggedIn: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);