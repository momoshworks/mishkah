import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [demoMode, setDemoMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const refreshNotifications = useCallback(async (activeUser) => {
    if (!activeUser) {
      setUnreadNotifications(0);
      return;
    }
    try {
      const data = await apiFetch('/api/notifications');
      setUnreadNotifications(data.unreadCount || 0);
    } catch {
      setUnreadNotifications(0);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const [meData, cfgData] = await Promise.all([
        apiFetch('/api/auth/me'),
        apiFetch('/api/auth/config').catch(() => ({ demoMode: false })),
      ]);
      setUser(meData.user || null);
      setDemoMode(Boolean(cfgData.demoMode));
      await refreshNotifications(meData.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [refreshNotifications]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const openAuthModal = (mode = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => setAuthModalOpen(false);

  const login = async (email, password) => {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setUser(res.user);
    await refreshNotifications(res.user);
    setAuthModalOpen(false);
    return res.user;
  };

  const register = async (payload) => {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: payload,
    });
    setUser(res.user);
    await refreshNotifications(res.user);
    setAuthModalOpen(false);
    return res.user;
  };

  const demoLogin = async (role) => {
    const res = await apiFetch('/api/auth/demo-login', {
      method: 'POST',
      body: { role },
    });
    setUser(res.user);
    await refreshNotifications(res.user);
    setAuthModalOpen(false);
    return res.user;
  };

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setUnreadNotifications(0);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        demoMode,
        loading,
        unreadNotifications,
        refreshUser,
        refreshNotifications,
        authModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        login,
        register,
        demoLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
