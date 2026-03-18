import React, {useState} from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  View,
  ActivityIndicator,
  Alert,
  Text,
} from 'react-native';
import {NavigationContainer, getFocusedRouteNameFromRoute} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import LinearGradient from 'react-native-linear-gradient';
import {MessageSquare, Settings, Plus} from 'lucide-react-native';

import {useAuth} from '../store/authStore';
import LoginScreen from '../screens/Auth/LoginScreen';
import ChatListScreen from '../screens/Chat/ChatListScreen';
import ChatScreen from '../screens/Chat/ChatScreen';
import NewChatScreen from '../screens/Chat/NewChatScreen';
import SettingsScreen from '../screens/Settings/SettingsScreen';
import {colors, font} from '../theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function HeaderBackground() {
  return (
    <LinearGradient
      colors={[colors.primaryHover, colors.primary]}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 0}}
      style={StyleSheet.absoluteFill}
    />
  );
}

function ChatsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerBackground: () => <HeaderBackground />,
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {fontFamily: font.semiBold, fontSize: 17, color: '#FFFFFF'},
        headerBackTitleVisible: false,
      }}>
      <Stack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={({navigation}) => ({
          title: 'Сообщения',
          headerTitleAlign: 'center',
          headerRight: () => (
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => {
                Alert.alert('Новый чат', '', [
                  {
                    text: 'Личный чат',
                    onPress: () => navigation.navigate('NewChat', {initialMode: 'private'}),
                  },
                  {
                    text: 'Создать группу',
                    onPress: () => navigation.navigate('NewChat', {initialMode: 'group'}),
                  },
                  {text: 'Отмена', style: 'cancel'},
                ]);
              }}>
              <Plus size={24} color="#FFFFFF" />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          title: '',
        }}
      />
      <Stack.Screen
        name="NewChat"
        component={NewChatScreen}
        options={{title: 'Новый чат'}}
      />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerBackground: () => <HeaderBackground />,
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {fontFamily: font.semiBold, fontSize: 17, color: '#FFFFFF'},
      }}>
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{title: 'Настройки'}}
      />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({route}) => {
        const focusedRoute = getFocusedRouteNameFromRoute(route) ?? '';
        const hideTabBar = ['Chat', 'NewChat'].includes(focusedRoute);
        return {
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textTertiary,
          tabBarStyle: hideTabBar
            ? {display: 'none'}
            : {
                backgroundColor: colors.bgPrimary,
                borderTopColor: colors.borderLight,
                borderTopWidth: 1,
                height: 56,
                paddingBottom: 6,
                paddingTop: 6,
              },
          tabBarLabelStyle: {fontFamily: font.medium, fontSize: 11},
          tabBarIcon: ({color, size}) => {
            if (route.name === 'ChatsTab') {
              return <MessageSquare size={size} color={color} />;
            }
            return <Settings size={size} color={color} />;
          },
        };
      }}>
      <Tab.Screen name="ChatsTab" component={ChatsStack} options={{title: 'Чаты'}} />
      <Tab.Screen name="SettingsTab" component={SettingsStack} options={{title: 'Настройки'}} />
    </Tab.Navigator>
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
  const {user, isLoading} = useAuth();

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <LinearGradient
          colors={[colors.primaryHover, colors.primary, colors.secondary]}
          start={{x: 0, y: 0}}
          end={{x: 1, y: 1}}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  headerBtn: {padding: 4},
});
