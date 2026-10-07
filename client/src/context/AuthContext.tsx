import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, apiConfig, gqlRequest } from '../api/client';
import { CHANGE_PASSWORD, LOGIN, ME } from '../api/queries';
import type { User } from '../api/types';
import { DEFAULT_SERVER_URL } from '../config';

const STORAGE = {
  token: 'nodepos.token',
  user: 'nodepos.user',
  server: 'nodepos.serverUrl',
};

interface AuthContextValue {
  ready: boolean;
  user: User | null;
  serverUrl: string;
  login: (username: string, password: string, serverUrl: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Cambia la contraseña propia; guarda la nueva sesión que devuelve el servidor */
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** ADMIN o MANAGER */
  isManager: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);

  const logout = useCallback(async () => {
    apiConfig.setToken(null);
    setUser(null);
    await Promise.all([AsyncStorage.removeItem(STORAGE.token), AsyncStorage.removeItem(STORAGE.user)]);
  }, []);

  // Restaurar sesión guardada
  useEffect(() => {
    (async () => {
      try {
        const [token, userJson, savedServer] = await Promise.all([
          AsyncStorage.getItem(STORAGE.token),
          AsyncStorage.getItem(STORAGE.user),
          AsyncStorage.getItem(STORAGE.server),
        ]);
        if (savedServer) {
          apiConfig.setServerUrl(savedServer);
          setServerUrl(apiConfig.getServerUrl());
        }
        if (token && userJson) {
          apiConfig.setToken(token);
          setUser(JSON.parse(userJson));
          // Verifica que el token siga vigente (si el servidor no responde, se conserva la sesión)
          try {
            const { me } = await gqlRequest<{ me: User | null }>(ME);
            if (me) setUser(me);
            else await logout();
          } catch (err) {
            if (err instanceof ApiError && err.code === 'UNAUTHENTICATED') await logout();
          }
        }
      } finally {
        setReady(true);
      }
    })();
  }, [logout]);

  // Si el servidor responde UNAUTHENTICATED (token vencido o revocado), cerrar sesión.
  // Si responde PASSWORD_CHANGE_REQUIRED, mostrar la pantalla de cambio de contraseña.
  useEffect(() => {
    apiConfig.setUnauthenticatedHandler(() => {
      logout();
    });
    apiConfig.setPasswordChangeRequiredHandler(() => {
      setUser((u) => (u ? { ...u, mustChangePassword: true } : u));
    });
    return () => {
      apiConfig.setUnauthenticatedHandler(null);
      apiConfig.setPasswordChangeRequiredHandler(null);
    };
  }, [logout]);

  const saveSession = useCallback(async (token: string, sessionUser: User) => {
    apiConfig.setToken(token);
    await Promise.all([
      AsyncStorage.setItem(STORAGE.token, token),
      AsyncStorage.setItem(STORAGE.user, JSON.stringify(sessionUser)),
    ]);
    setUser(sessionUser);
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      const { changePassword: result } = await gqlRequest<{
        changePassword: { token: string; user: User };
      }>(CHANGE_PASSWORD, { currentPassword, newPassword });
      await saveSession(result.token, result.user);
    },
    [saveSession],
  );

  const login = useCallback(async (username: string, password: string, server: string) => {
    apiConfig.setServerUrl(server);
    const normalized = apiConfig.getServerUrl();
    setServerUrl(normalized);
    await AsyncStorage.setItem(STORAGE.server, normalized);

    const { login: result } = await gqlRequest<{ login: { token: string; user: User } }>(LOGIN, {
      username,
      password,
    });
    await saveSession(result.token, result.user);
  }, [saveSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      user,
      serverUrl,
      login,
      logout,
      changePassword,
      isManager: user?.role === 'ADMIN' || user?.role === 'MANAGER',
    }),
    [ready, user, serverUrl, login, logout, changePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
