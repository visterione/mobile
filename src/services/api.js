import axios from 'axios';
import * as Keychain from 'react-native-keychain';
import CONFIG from '../config';

const KEYCHAIN_OPTIONS = {service: 'alfa-wiki'};

const api = axios.create({
  baseURL: CONFIG.API_URL,
  timeout: 30000,
});

// Attach JWT token to every request
api.interceptors.request.use(async config => {
  const credentials = await Keychain.getGenericPassword(KEYCHAIN_OPTIONS);
  if (credentials) {
    config.headers.Authorization = `Bearer ${credentials.password}`;
  }
  return config;
});

// Handle 401
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      await Keychain.resetGenericPassword(KEYCHAIN_OPTIONS);
    }
    return Promise.reject(error);
  },
);

// ── Auth ────────────────────────────────────────────────────────────────────
export const auth = {
  login: (username, password) =>
    api.post('/auth/login', {username, password}),
  me: () => api.get('/auth/me'),
  verify2FA: (userId, code) =>
    api.post('/auth/verify-2fa', {userId, code}),
  resend2FA: userId =>
    api.post('/auth/resend-2fa', {userId}),
};

// ── Media ────────────────────────────────────────────────────────────────────
export const media = {
  upload: async file => {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type || 'application/octet-stream',
      name: file.name || 'file',
    });
    return api.post('/media/upload', formData, {
      headers: {'Content-Type': 'multipart/form-data'},
    });
  },
};

// ── Chat ────────────────────────────────────────────────────────────────────
export const chat = {
  list: () => api.get('/chat'),
  search: query => api.get('/chat/search', {params: {q: query}}),
  getUnreadCount: () => api.get('/chat/unread/count'),
  getMessages: (chatId, params) =>
    api.get(`/chat/${chatId}/messages`, {params}),
  getUsers: () => api.get('/chat/users'),
  sendMessage: (chatId, content, attachments = [], replyToId = null) =>
    api.post(`/chat/${chatId}/messages`, {content, attachments, replyToId}),
  markAsRead: chatId => api.post(`/chat/${chatId}/read`),
  startPrivate: userId => api.post('/chat/private', {userId}),
  createGroup: (name, memberIds) =>
    api.post('/chat/group', {name, memberIds}),
  editMessage: (chatId, messageId, content) =>
    api.put(`/chat/${chatId}/messages/${messageId}`, {content}),
  deleteMessage: (chatId, messageId) =>
    api.delete(`/chat/${chatId}/messages/${messageId}`),
  hideChat: (chatId, hidden) => api.patch(`/chat/${chatId}/hide`, {hidden}),
  addReaction: (chatId, messageId, emoji) =>
    api.post(`/chat/${chatId}/messages/${messageId}/reactions`, {emoji}),
  removeReaction: (chatId, messageId) =>
    api.delete(`/chat/${chatId}/messages/${messageId}/reactions`),
  getReactionDetails: (chatId, messageId) =>
    api.get(`/chat/${chatId}/messages/${messageId}/reactions`),
  addMember: (chatId, userId) =>
    api.post(`/chat/${chatId}/members`, {userId}),
  removeMember: (chatId, userId) =>
    api.delete(`/chat/${chatId}/members/${userId}`),
  leave: chatId => api.delete(`/chat/${chatId}/leave`),
  forwardMessages: (targetChatId, messageIds) =>
    api.post('/chat/forward', {targetChatId, messageIds}),
  uploadFiles: async (chatId, files) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', {
        uri: file.uri,
        type: file.type || 'application/octet-stream',
        name: file.name || 'file',
      });
    });
    return api.post(`/chat/${chatId}/upload`, formData, {
      headers: {'Content-Type': 'multipart/form-data'},
    });
  },
};

export default api;
