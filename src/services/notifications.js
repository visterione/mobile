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
    try {
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

      // Request permission (iOS / Android 13+)
      await notifee.requestPermission();
    } catch (e) {
      console.warn('[NotificationService] setup error:', e);
    }
  },

  /**
   * Show a local push notification for a new message.
   */
  async showMessageNotification({chatId, chatName, senderName, content}) {
    try {
      await notifee.displayNotification({
        title: chatName || senderName || 'Новое сообщение',
        body: senderName && chatName !== senderName
          ? `${senderName}: ${content}`
          : content,
        android: {
          channelId: CHANNEL_MESSAGES,
          pressAction: {id: 'open_chat', launchActivity: 'default'},
          extras: {chatId},
          smallIcon: 'ic_notification',
          color: '#2563EB',
        },
        ios: {
          sound: 'default',
          threadId: chatId,
        },
        data: {chatId},
      });
    } catch (e) {
      console.warn('[NotificationService] showMessageNotification error:', e);
    }
  },

  /**
   * Start Android foreground service — keeps Socket.IO alive in background.
   */
  async startForegroundService() {
    if (Platform.OS !== 'android') return;
    try {
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
    } catch (e) {
      console.warn('[NotificationService] startForegroundService error:', e);
    }
  },

  async stopForegroundService() {
    if (Platform.OS !== 'android') return;
    try {
      await notifee.stopForegroundService();
    } catch (e) {
      console.warn('[NotificationService] stopForegroundService error:', e);
    }
  },

  /**
   * Register handler for background notification events.
   * Called from index.js (outside React tree).
   */
  registerBackgroundHandler() {
    notifee.onBackgroundEvent(async ({type, detail}) => {
      if (type === EventType.PRESS) {
        const chatId = detail.notification?.data?.chatId;
        if (chatId) {
          // Navigation handled in App.js via linking
        }
      }
    });
  },

  /**
   * Attach to Socket.IO 'new_message' event and show notifications.
   * NOTE: SocketService.on(key, event, callback) — 3 args required.
   */
  attachSocketListeners(currentUserId) {
    SocketService.on('notify:new_message', 'new_message', async data => {
      // Don't notify for own messages
      if (data.message?.senderId === currentUserId) return;

      await NotificationService.showMessageNotification({
        chatId: data.chat?.id ?? data.chatId,
        chatName: data.chat?.displayName,
        senderName: data.message?.sender?.displayName,
        content: data.message?.content || 'Новое сообщение',
      });
    });
  },

  detachSocketListeners() {
    SocketService.off('notify:new_message');
  },
};

export default NotificationService;
