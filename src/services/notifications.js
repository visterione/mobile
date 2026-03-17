import notifee, {
  AndroidImportance,
  AndroidVisibility,
  EventType,
} from '@notifee/react-native';
import {Platform} from 'react-native';
import SocketService from './socket';

// Channel IDs
const CHANNEL_MESSAGES = 'messages';
const CHANNEL_FOREGROUND = 'foreground_service';

const NotificationService = {
  async setup() {
    if (Platform.OS === 'android') {
      // High-priority channel for incoming messages
      await notifee.createChannel({
        id: CHANNEL_MESSAGES,
        name: 'Сообщения',
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        vibration: true,
        sound: 'default',
      });

      // Silent channel for foreground service persistent notification
      await notifee.createChannel({
        id: CHANNEL_FOREGROUND,
        name: 'Фоновое подключение',
        importance: AndroidImportance.LOW,
        visibility: AndroidVisibility.SECRET,
      });
    }

    // Request permission (iOS)
    await notifee.requestPermission();
  },

  /**
   * Show a local push notification for a new message.
   * Called both from foreground (app visible) and background service.
   */
  async showMessageNotification({chatId, chatName, senderName, content}) {
    await notifee.displayNotification({
      title: chatName || senderName || 'Новое сообщение',
      body: senderName && chatName !== senderName
        ? `${senderName}: ${content}`
        : content,
      android: {
        channelId: CHANNEL_MESSAGES,
        pressAction: {id: 'open_chat', launchActivity: 'default'},
        // Store chatId so we can navigate on tap
        extras: {chatId},
        smallIcon: 'ic_notification', // define in Android res
        color: '#2563EB',
      },
      ios: {
        sound: 'default',
        threadId: chatId, // group notifications by chat
      },
      data: {chatId},
    });
  },

  /**
   * Start Android foreground service — keeps Socket.IO alive in background.
   * The persistent notification is shown in the status bar (silent channel).
   */
  async startForegroundService() {
    if (Platform.OS !== 'android') return;

    await notifee.displayNotification({
      id: 'foreground_service',
      title: 'alfa-wiki',
      body: 'Подключено к мессенджеру',
      android: {
        channelId: CHANNEL_FOREGROUND,
        asForegroundService: true,
        ongoing: true,
        pressAction: {id: 'default'},
        smallIcon: 'ic_notification',
        color: '#2563EB',
      },
    });
  },

  async stopForegroundService() {
    if (Platform.OS !== 'android') return;
    await notifee.stopForegroundService();
  },

  /**
   * Register handler that processes background Socket.IO events
   * and fires local notifications.
   * Called from index.js (outside React tree).
   */
  registerBackgroundHandler() {
    notifee.onBackgroundEvent(async ({type, detail}) => {
      // Handle notification tap — navigate to chat
      if (type === EventType.PRESS) {
        const chatId = detail.notification?.data?.chatId;
        if (chatId) {
          // Navigation will be handled in App.js via linking
        }
      }
    });
  },

  /**
   * Attach to Socket.IO events and show notifications.
   * Called after Socket connects, only when app is in foreground.
   * Background delivery is handled via ForegroundService (Android)
   * and BGTaskScheduler (iOS).
   */
  attachSocketListeners(currentUserId) {
    SocketService.on('new_message_notify', async data => {
      // Don't notify for own messages
      if (data.message?.senderId === currentUserId) return;

      await NotificationService.showMessageNotification({
        chatId: data.chatId,
        chatName: data.chat?.displayName,
        senderName: data.message?.sender?.displayName,
        content: data.message?.content || 'Новое сообщение',
      });
    });
  },

  detachSocketListeners() {
    SocketService.off('new_message_notify');
  },
};

export default NotificationService;
