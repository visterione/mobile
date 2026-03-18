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
    // Run in parallel — setup errors are caught internally, won't block auth
    NotificationService.setup();
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!user) return;

    // Both calls are async — wrap in try/catch so any failure is a warning,
    // not an unhandled rejection that crashes the JS runtime.
    NotificationService.startForegroundService().catch(e =>
      console.warn('[App] foreground service error:', e),
    );
    NotificationService.attachSocketListeners(user.id);

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        // App came to foreground — socket reconnects automatically
      }
    });

    return () => {
      subscription.remove();
      NotificationService.detachSocketListeners();
      NotificationService.stopForegroundService().catch(() => {});
    };
  }, [user]);

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0056CC" translucent={false} />
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
