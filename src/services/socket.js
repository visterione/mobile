import {io} from 'socket.io-client';
import * as Keychain from 'react-native-keychain';
import CONFIG from '../config';

let socket = null;
let _userId = null;
const listeners = new Map();

const SocketService = {
  async connect(userId) {
    if (socket?.connected) {
      return;
    }

    _userId = userId;
    const credentials = await Keychain.getGenericPassword({service: 'alfa-wiki'});
    const token = credentials?.password;

    socket = io(CONFIG.SOCKET_URL, {
      transports: ['websocket'],
      auth: {token},
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected');
      // Rejoin user room and re-attach all listeners on every connect/reconnect
      socket.emit('join', _userId);
      listeners.forEach((callback, event) => {
        socket.off(event, callback);
        socket.on(event, callback);
      });
    });

    socket.on('disconnect', reason => {
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', err => {
      console.warn('[Socket] Connection error:', err.message);
    });
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  on(event, callback) {
    listeners.set(event, callback);
    if (socket) {
      socket.on(event, callback);
    }
  },

  off(event) {
    const callback = listeners.get(event);
    if (callback && socket) {
      socket.off(event, callback);
    }
    listeners.delete(event);
  },

  emit(event, data) {
    if (socket?.connected) {
      socket.emit(event, data);
    }
  },

  isConnected() {
    return socket?.connected ?? false;
  },
};

export default SocketService;
