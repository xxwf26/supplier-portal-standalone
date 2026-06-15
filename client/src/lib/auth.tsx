import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '@/api';

interface AuthUser { username: string; role: 'admin' | 'viewer'; }
interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isLoggedIn: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null, token: null,
  login: async () => {}, logout: () => {},
  isAdmin: false, isLoggedIn: false,
});

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('auth');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.token && !isTokenExpired(parsed.token)) {
          setUser(parsed.user);
          setToken(parsed.token);
        } else {
          // token 已过期，清除保存的 auth（但保留记住的账号密码）
          localStorage.removeItem('auth');
        }
      } catch {
        localStorage.removeItem('auth');
      }
    }
  }, []);

  const login = useCallback(async (username: string, password: string, rememberMe = false) => {
    const res = await api.post('/api/auth/login', { username, password, rememberMe });
    const auth = { user: res.data.user, token: res.data.access_token };
    localStorage.setItem('auth', JSON.stringify(auth));

    if (rememberMe) {
      localStorage.setItem('__saved_creds', JSON.stringify({ username, password }));
    }

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
