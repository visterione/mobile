import React from 'react';
import {TouchableOpacity, Text, StyleSheet, View, ActivityIndicator} from 'react-native';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {useAuth} from '../store/authStore';
import LoginScreen from '../screens/Auth/LoginScreen';
import ChatListScreen from '../screens/Chat/ChatListScreen';
import ChatScreen from '../screens/Chat/ChatScreen';
import NewChatScreen from '../screens/Chat/NewChatScreen';

const Stack = createNativeStackNavigator();

function AppStack({logout}) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: '#FFFFFF'},
        headerTintColor: '#111827',
        headerTitleStyle: {fontWeight: '600'},
      }}>
      <Stack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{
          title: 'Сообщения',
          headerRight: () => (
            <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Выйти</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{title: 'Чат'}}
      />
      <Stack.Screen
        name="NewChat"
        component={NewChatScreen}
        options={{title: 'Новый чат'}}
      />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const {user, isLoading, logout} = useAuth();

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppStack logout={logout} /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF'},
  logoutBtn: {paddingHorizontal: 8},
  logoutText: {fontSize: 14, color: '#EF4444'},
});
