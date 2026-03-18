import {io} from 'socket.io-client';
import * as Keychain from 'react-native-keychain';
import CONFIG from '../config';

let socket = null;
let _userId = null;

// key → {event, callback}  — supports multiple listeners per event via unique keys
const pendingListeners = new Map();

const SocketService = {
  // token param lets callers pass an already-known token and skip Keychain read
  async connect(userId, token) {
    if (socket?.connected) {
      return;
    }

    _userId = userId;
    // Only read Keychain if token wasn't provided by the caller
    const actualToken = token ?? (await Keychain.getGenericPassword({service: 'alfa-wiki'}))?.password;

    socket = io(CONFIG.SOCKET_URL, {
      transports: ['websocket'],
      auth: {token: actualToken},
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected');
      socket.emit('join', _userId);
      // Re-attach all listeners after (re)connect
      pendingListeners.forEach(({event, callback}) => {
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
    _userId = null;
  },

  /**
   * Register a listener with a unique key.
   * Using a key allows multiple components to subscribe to the same event
   * without overwriting each other.
   *
   * @param {string} key    - unique identifier, e.g. 'chatlist:new_message'
   * @param {string} event  - socket event name
   * @param {function} callback
   */
  on(key, event, callback) {
    // Remove previous listener for this key (if any)
    this.off(key);

    pendingListeners.set(key, {event, callback});
    if (socket?.connected) {
      socket.on(event, callback);
    }
  },

  /**
   * Remove a listener by its unique key.
   * @param {string} key
   */
  off(key) {
    const entry = pendingListeners.get(key);
    if (entry) {
      if (socket) socket.off(entry.event, entry.callback);
      pendingListeners.delete(key);
    }
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
