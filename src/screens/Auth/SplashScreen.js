import React, {useEffect} from 'react';
import {View, ActivityIndicator, StyleSheet, Text, Image} from 'react-native';
import {useAuth} from '../../store/authStore';

export default function SplashScreen({navigation}) {
  const {initialize, user, isLoading} = useAuth();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        navigation.replace('ChatList');
      } else {
        navigation.replace('Login');
      }
    }
  }, [isLoading, user, navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>alfa-wiki</Text>
      <ActivityIndicator size="large" color="#2563EB" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2563EB',
    letterSpacing: 1,
    marginBottom: 32,
  },
  spinner: {
    marginTop: 8,
  },
});
