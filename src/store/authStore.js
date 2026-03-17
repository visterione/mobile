import React, {createContext, useContext, useState, useCallback} from 'react';
import * as Keychain from 'react-native-keychain';
import {auth as authApi} from '../services/api';
import SocketService from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({children}) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Called once on app start — checks for stored token
  const initialize = useCallback(async () => {
    setIsLoading(true);
    try {
      const credentials = await Keychain.getGenericPassword({service: 'alfa-wiki'});
      if (credentials) {
        const response = await authApi.me();
        setUser(response.data.user ?? response.data);
        await SocketService.connect(response.data.user?.id ?? response.data.id);
      }
    } catch {
      // Token invalid or server unreachable — clear it
      await Keychain.resetGenericPassword({service: 'alfa-wiki'});
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (username, password) => {
    const response = await authApi.login(username, password);
    const {token, user: userData} = response.data;

    // Store token securely (Keychain on iOS, Keystore on Android)
    await Keychain.setGenericPassword('token', token, {
      service: 'alfa-wiki',
    });

    setUser(userData);
    await SocketService.connect(userData.id);
    return userData;
  }, []);

  const logout = useCallback(async () => {
    SocketService.disconnect();
    await Keychain.resetGenericPassword({service: 'alfa-wiki'});
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{user, isLoading, initialize, login, logout}}>
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
