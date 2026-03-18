import React, {createContext, useContext, useState, useCallback} from 'react';
import * as Keychain from 'react-native-keychain';
import {auth as authApi, setCachedToken, clearCachedToken} from '../services/api';
import SocketService from '../services/socket';

const KEYCHAIN_OPTIONS = {service: 'alfa-wiki'};
const AuthContext = createContext(null);

export function AuthProvider({children}) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Called once on app start — checks for stored token
  const initialize = useCallback(async () => {
    setIsLoading(true);
    try {
      const credentials = await Keychain.getGenericPassword(KEYCHAIN_OPTIONS);
      if (credentials) {
        // Cache token immediately — all subsequent API calls use memory, not Keychain
        setCachedToken(credentials.password);
        const response = await authApi.me();
        const userData = response.data.user ?? response.data;
        setUser(userData);
        // Connect socket in background — don't block showing the UI
        SocketService.connect(userData.id, credentials.password).catch(() => {});
      }
    } catch {
      // Token invalid or server unreachable — clear it
      clearCachedToken();
      await Keychain.resetGenericPassword(KEYCHAIN_OPTIONS);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Called after successful login (instead of re-calling initialize)
  const loginComplete = useCallback((userData) => {
    setUser(userData);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await authApi.me();
      setUser(response.data.user ?? response.data);
    } catch {}
  }, []);

  const logout = useCallback(async () => {
    SocketService.disconnect();
    clearCachedToken();
    await Keychain.resetGenericPassword(KEYCHAIN_OPTIONS);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{user, isLoading, initialize, loginComplete, refreshUser, logout}}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
