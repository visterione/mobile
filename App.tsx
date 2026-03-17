import React, {useEffect} from 'react';
import {StatusBar, AppState} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {AuthProvider, useAuth} from './src/store/authStore';
import AppNavigator from './src/navigation/AppNavigator';
import NotificationService from './src/services/notifications';

// Register background notification handler (outside React tree)
NotificationService.registerBackgroundHandler();

function AppInner() {
  const {user, initialize} = useAuth();

  useEffect(() => {
    NotificationService.setup();
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!user) return;

    NotificationService.startForegroundService();
    NotificationService.attachSocketListeners(user.id);

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        // App came to foreground — socket reconnects automatically
      }
    });

    return () => {
      subscription.remove();
      NotificationService.detachSocketListeners();
    };
  }, [user]);

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AppNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
