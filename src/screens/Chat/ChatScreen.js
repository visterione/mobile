import React, {useEffect, useState, useRef, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  Alert,
  Linking,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import {launchImageLibrary, launchCamera} from 'react-native-image-picker';
import {pick as pickDocument} from '@react-native-documents/picker';
import {
  Send,
  Paperclip,
  Smile,
  X,
  Reply,
  Pencil,
  Trash2,
  Forward,
  Image as ImageIcon,
  Camera,
  File,
  Video,
  FileText,
  Archive,
  Search,
  ChevronUp,
  ChevronDown,
} from 'lucide-react-native';
import {chat as chatApi} from '../../services/api';
import SocketService from '../../services/socket';
import {useAuth} from '../../store/authStore';
import avatarUrl from '../../utils/avatarUrl';
import CONFIG from '../../config';
import {colors, radius, shadow, font} from '../../theme';

const BASE_URL = CONFIG.API_URL.replace('/api', '');
const {width: SCREEN_WIDTH} = Dimensions.get('window');

const REACTIONS = ['👍', '👎', '❤️', '😂', '😮', '🎉', '🔥'];
const COMMON_EMOJI = [
  '😀','😂','🥹','😊','😍','🤩','😎','🥳','😢','😭','😤','🤔',
  '👍','👎','👏','🙌','🤝','💪','🫡','🫶','❤️','🔥','⭐','✅',
  '❌','⚡','🎉','🎊','💯','🚀','💀','🤣',
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function fixUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) {
    try {
      const url = new URL(path);
      const p = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
      return `${BASE_URL}/${p}`;
    } catch {return null;}
  }
  const p = path.startsWith('/') ? path.slice(1) : path;
  return `${BASE_URL}/${p}`;
}

function formatTime(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function formatDateSep(iso) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (msgDay.getTime() === today.getTime()) return 'Сегодня';
  if (msgDay.getTime() === yesterday.getTime()) return 'Вчера';
  return `${d.getDate()} ${['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][d.getMonth()]} ${d.getFullYear()}`;
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function sameDay(a, b) {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate();
}

// Inject date separators into newest-first message array
function withSeparators(messages) {
  const result = [];
  for (let i = 0; i < messages.length; i++) {
    result.push({...messages[i], _itemType: 'message'});
    const next = messages[i + 1];
    if (!next || !sameDay(messages[i].createdAt, next.createdAt)) {
      result.push({
        _itemType: 'separator',
        _id: `sep_${i}_${messages[i].createdAt}`,
        date: messages[i].createdAt,
      });
    }
  }
  return result;
}

// ── Avatar component ─────────────────────────────────────────────────────────
function Avatar({uri, name, size = 32}) {
  const url = avatarUrl(uri);
  if (url) {
    return (
      <Image
        source={{uri: url}}
        style={{width: size, height: size, borderRadius: size / 2}}
      />
    );
  }
  const initials = (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <View style={[styles.avatarPlaceholder, {width: size, height: size, borderRadius: size / 2}]}>
      <Text style={[styles.avatarText, {fontSize: size * 0.38}]}>{initials}</Text>
    </View>
  );
}

// ── Attachment renderer ───────────────────────────────────────────────────────
function Attachments({attachments, isOwn, onImagePress}) {
  if (!attachments?.length) return null;

  return (
    <View style={styles.attachmentsWrap}>
      {attachments.map((att, idx) => {
        const url = fixUrl(att.url || att.path);
        const mime = att.mimeType || '';

        if (mime.startsWith('image/')) {
          return (
            <TouchableOpacity key={idx} onPress={() => onImagePress(url)}>
              <Image
                source={{uri: url}}
                style={styles.attachImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          );
        }

        if (mime.startsWith('video/')) {
          const iconColor = isOwn ? 'rgba(255,255,255,0.9)' : colors.textPrimary;
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.attachFile, isOwn && styles.attachFileOwn]}
              onPress={() => url && Linking.openURL(url)}>
              <Video size={22} color={iconColor} />
              <View style={styles.attachFileInfo}>
                <Text style={[styles.attachFileName, isOwn && styles.attachFileNameOwn]} numberOfLines={1}>{att.name}</Text>
                <Text style={[styles.attachFileSize, isOwn && styles.attachFileSizeOwn]}>{formatFileSize(att.size)}</Text>
              </View>
            </TouchableOpacity>
          );
        }

        const FileIcon = mime.includes('pdf') ? FileText
          : mime.includes('zip') || mime.includes('rar') ? Archive
          : File;
        const iconColor = isOwn ? 'rgba(255,255,255,0.9)' : colors.textPrimary;

        return (
          <TouchableOpacity
            key={idx}
            style={[styles.attachFile, isOwn && styles.attachFileOwn]}
            onPress={() => url && Linking.openURL(url)}>
            <FileIcon size={22} color={iconColor} />
            <View style={styles.attachFileInfo}>
              <Text style={[styles.attachFileName, isOwn && styles.attachFileNameOwn]} numberOfLines={1}>{att.name}</Text>
              <Text style={[styles.attachFileSize, isOwn && styles.attachFileSizeOwn]}>{formatFileSize(att.size)}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────
function MessageBubble({message, isOwn, chatType, isHighlighted, onLongPress, onReactionTap, onImagePress}) {
  if (message.type === 'system') {
    return (
      <View style={styles.systemMsgWrap}>
        <Text style={styles.systemMsgText}>{message.content}</Text>
      </View>
    );
  }

  const isDeleted = message.content === 'Сообщение удалено';

  return (
    <Pressable
      onLongPress={() => !isDeleted && onLongPress(message)}
      style={[styles.bubbleRow, isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther, isHighlighted && styles.bubbleRowHighlighted]}>
      {!isOwn && chatType === 'group' && (
        <View style={styles.bubbleAvatar}>
          <Avatar uri={message.sender?.avatar} name={message.sender?.displayName} size={28} />
        </View>
      )}

      <View style={[styles.bubbleContent, isOwn ? {alignItems: 'flex-end'} : {alignItems: 'flex-start'}]}>
        {!isOwn && chatType === 'group' && message.sender && (
          <Text style={styles.senderName}>{message.sender.displayName || message.sender.username}</Text>
        )}

        {/* Forwarded label */}
        {message.forwardedFrom && (
          <View style={[styles.forwardBadge, isOwn && styles.forwardBadgeOwn]}>
            <Forward size={11} color={isOwn ? 'rgba(255,255,255,0.75)' : colors.textSecondary} style={{marginRight: 4}} />
            <Text style={[styles.forwardLabel, isOwn && styles.forwardLabelOwn]}>
              Переслано от {message.forwardedFrom.senderName || 'пользователя'}
            </Text>
          </View>
        )}

        {/* Reply to */}
        {message.replyTo && (
          <View style={[styles.replyBadge, isOwn && styles.replyBadgeOwn]}>
            <Text style={[styles.replyAuthor, isOwn && styles.replyAuthorOwn]} numberOfLines={1}>
              {message.replyTo.sender?.displayName || 'Сообщение'}
            </Text>
            <Text style={[styles.replyText, isOwn && styles.replyTextOwn]} numberOfLines={1}>
              {message.replyTo.content}
            </Text>
          </View>
        )}

        <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          {/* Attachments */}
          <Attachments
            attachments={message.attachments}
            isOwn={isOwn}
            onImagePress={onImagePress}
          />

          {/* Text content */}
          {(message.content && !isDeleted) ? (
            <Text style={[styles.msgText, isOwn && styles.msgTextOwn]}>
              {message.content}
            </Text>
          ) : isDeleted ? (
            <Text style={styles.deletedText}>Сообщение удалено</Text>
          ) : null}

          {/* Meta: time + edited */}
          <View style={styles.bubbleMeta}>
            {message.isEdited && (
              <Text style={[styles.editedLabel, isOwn && styles.editedLabelOwn]}>ред. </Text>
            )}
            <Text style={[styles.timeText, isOwn && styles.timeTextOwn]}>
              {formatTime(message.createdAt)}
            </Text>
          </View>
        </View>

        {/* Reactions */}
        {message.reactions?.length > 0 && (
          <View style={styles.reactionsRow}>
            {message.reactions.map(r => (
              <TouchableOpacity
                key={r.emoji}
                style={[styles.reactionChip, r.hasReacted && styles.reactionChipActive]}
                onPress={() => onReactionTap(message.id, r.emoji, r.hasReacted)}>
                <Text style={styles.reactionChipText}>{r.emoji} {r.count}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ── Chat header title with avatar + status ───────────────────────────────────
function ChatHeaderTitle({name, avatar, isOnline, isTyping, chatType}) {
  const url = avatarUrl(avatar);
  const initials = (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <View style={headerStyles.wrap}>
      <View style={headerStyles.avatarWrap}>
        {url ? (
          <Image source={{uri: url}} style={headerStyles.avatar} />
        ) : (
          <View style={headerStyles.avatarPlaceholder}>
            <Text style={headerStyles.avatarText}>{initials}</Text>
          </View>
        )}
        {chatType === 'private' && isOnline && <View style={headerStyles.onlineDot} />}
      </View>
      <View>
        <Text style={headerStyles.name} numberOfLines={1}>{name || 'Чат'}</Text>
        {chatType === 'private' && (
          <Text style={headerStyles.status}>
            {isTyping ? 'печатает...' : isOnline ? 'онлайн' : 'офлайн'}
          </Text>
        )}
      </View>
    </View>
  );
}

const headerStyles = StyleSheet.create({
  wrap: {flexDirection: 'row', alignItems: 'center'},
  avatarWrap: {marginRight: 10, position: 'relative'},
  avatar: {width: 34, height: 34, borderRadius: 17},
  avatarPlaceholder: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {fontSize: 13, color: '#FFFFFF', fontFamily: font.semiBold},
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#34C759', borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  name: {fontSize: 16, color: '#FFFFFF', fontFamily: font.semiBold},
  status: {fontSize: 11, color: 'rgba(255,255,255,0.75)', fontFamily: font.regular},
});

// ── Main screen ──────────────────────────────────────────────────────────────
export default function ChatScreen({route, navigation}) {
  const {chatId, chatName, chatType, chatAvatar, otherUserId, otherUserIsOnline} = route.params;
  const {user} = useAuth();

  const [isOnline, setIsOnline] = useState(otherUserIsOnline ?? false);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimer = useRef(null);      // incoming typing auto-clear
  const sendTypingTimer = useRef(null);  // outgoing typing_stop debounce

  const [messages, setMessages] = useState([]); // newest-first
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // In-chat search
  const flatListRef = useRef(null);
  const searchInputRef = useRef(null);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState([]);
  const [searchIdx, setSearchIdx] = useState(0);
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);

  // Modes
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [forwardMode, setForwardMode] = useState(false);
  const [selectedForForward, setSelectedForForward] = useState([]);

  // Pending attachments (before sending)
  const [pendingFiles, setPendingFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  // UI modals
  const [contextMenu, setContextMenu] = useState(null); // {message}
  const [showReactionPicker, setShowReactionPicker] = useState(null); // messageId
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [chatsList, setChatsList] = useState([]);

  // ── Load messages ──────────────────────────────────────────────────────────
  const loadMessages = useCallback(async (before = null) => {
    try {
      const params = {limit: 50};
      if (before) params.before = before;
      const res = await chatApi.getMessages(chatId, params);
      const raw = Array.isArray(res.data) ? res.data : (res.data.messages ?? []);
      // Backend: ORDER DESC then .reverse() → oldest-first (ASC)
      // We need newest-first for inverted FlatList → reverse again
      const fetched = [...raw].reverse();
      if (raw.length < 50) setHasMore(false);
      if (before) {
        // fetched = older messages, newest-first → append to END (visually: top)
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          return [...prev, ...fetched.filter(m => !ids.has(m.id))];
        });
      } else {
        setMessages(fetched);
      }
    } catch (err) {
      console.warn('[Chat] load error:', err?.response?.data || err.message);
    }
  }, [chatId]);

  useEffect(() => {
    loadMessages().finally(() => setLoading(false));
    chatApi.markAsRead(chatId).catch(() => {});
    // Join socket room for typing indicators
    SocketService.emit('join_chat', {chatId});
    return () => { SocketService.emit('leave_chat', {chatId}); };
  }, [chatId, loadMessages]);

  // Update header whenever online/typing/searchMode state changes
  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <ChatHeaderTitle
          name={chatName}
          avatar={chatAvatar}
          isOnline={isOnline}
          isTyping={isTyping}
          chatType={chatType}
        />
      ),
      headerRight: () => (
        <TouchableOpacity
          style={{padding: 4, marginRight: 4}}
          onPress={() => setSearchMode(v => !v)}>
          {searchMode
            ? <X size={22} color="#FFFFFF" />
            : <Search size={22} color="#FFFFFF" />}
        </TouchableOpacity>
      ),
    });
  }, [navigation, chatName, chatAvatar, isOnline, isTyping, chatType, searchMode]);

  // Online status + typing listeners
  useEffect(() => {
    SocketService.on('chat:user_status', 'user_status_changed', data => {
      if (String(data.userId) === String(otherUserId)) {
        setIsOnline(data.isOnline);
      }
    });
    SocketService.on('chat:user_typing', 'user_typing', data => {
      if (String(data.chatId) === String(chatId) && String(data.userId) !== String(user?.id)) {
        setIsTyping(data.isTyping);
        if (data.isTyping) {
          if (typingTimer.current) clearTimeout(typingTimer.current);
          typingTimer.current = setTimeout(() => setIsTyping(false), 4000);
        }
      }
    });
    return () => {
      SocketService.off('chat:user_status');
      SocketService.off('chat:user_typing');
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (sendTypingTimer.current) clearTimeout(sendTypingTimer.current);
    };
  }, [chatId, otherUserId, user]);

  // ── Socket real-time ───────────────────────────────────────────────────────
  useEffect(() => {
    const handleNewMessage = data => {
      // Backend emits {message, chat: {id, ...}} — chatId is at data.chat.id
      const incomingChatId = data.chat?.id ?? data.chatId;
      if (String(incomingChatId) !== String(chatId)) return;
      setMessages(prev => {
        if (prev.some(m => m.id === data.message.id)) return prev;
        return [data.message, ...prev]; // prepend newest-first
      });
      chatApi.markAsRead(chatId).catch(() => {});
    };

    const handleReactionUpdate = data => {
      const incomingChatId = data.chat?.id ?? data.chatId;
      if (String(incomingChatId) !== String(chatId)) return;
      setMessages(prev =>
        prev.map(m => m.id === data.messageId ? {...m, reactions: data.reactions} : m),
      );
    };

    const handleMsgEdit = data => {
      const incomingChatId = data.chat?.id ?? data.chatId;
      if (String(incomingChatId) !== String(chatId)) return;
      setMessages(prev =>
        prev.map(m => m.id === data.messageId ? {...m, content: data.content, isEdited: true} : m),
      );
    };

    SocketService.on('chat:new_message', 'new_message', handleNewMessage);
    SocketService.on('chat:reaction_updated', 'message_reaction_updated', handleReactionUpdate);
    SocketService.on('chat:msg_edited', 'message_edited', handleMsgEdit);

    return () => {
      SocketService.off('chat:new_message');
      SocketService.off('chat:reaction_updated');
      SocketService.off('chat:msg_edited');
    };
  }, [chatId]);

  // ── In-chat search ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (searchMode) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery('');
      setSearchHits([]);
      setSearchIdx(0);
      setHighlightedMsgId(null);
    }
  }, [searchMode]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchHits([]);
      setHighlightedMsgId(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await chatApi.searchMessages(chatId, q);
        setSearchHits(res.data);
        setSearchIdx(0);
      } catch {}
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, chatId]);

  useEffect(() => {
    if (!searchHits.length) return;
    const target = searchHits[searchIdx];
    if (!target) return;
    setHighlightedMsgId(target.id);
    // Find in loaded messages
    const listIdx = listData.findIndex(item => item.id === target.id);
    if (listIdx !== -1) {
      flatListRef.current?.scrollToIndex({index: listIdx, animated: true, viewPosition: 0.5});
    } else if (hasMore) {
      // Message not loaded yet — load more and retry
      loadMore();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchIdx, searchHits]);

  // ── Load more (older messages) ─────────────────────────────────────────────
  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || messages.length === 0) return;
    const oldest = messages[messages.length - 1]; // oldest = last in newest-first array
    setLoadingMore(true);
    loadMessages(oldest.createdAt).finally(() => setLoadingMore(false));
  }, [hasMore, loadingMore, messages, loadMessages]);

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSend = async () => {
    const content = text.trim();
    if (!content && pendingFiles.length === 0) return;
    if (sending) return;

    setSending(true);
    const savedText = content;
    const savedFiles = [...pendingFiles];
    setText('');
    setPendingFiles([]);
    setShowEmojiPicker(false);

    try {
      if (editingMessage) {
        await chatApi.editMessage(chatId, editingMessage.id, content);
        setMessages(prev =>
          prev.map(m => m.id === editingMessage.id ? {...m, content, isEdited: true} : m),
        );
        setEditingMessage(null);
        return;
      }

      let attachments = [];
      if (savedFiles.length > 0) {
        setUploading(true);
        try {
          const res = await chatApi.uploadFiles(chatId, savedFiles);
          attachments = res.data;
        } catch {
          Alert.alert('Ошибка', 'Не удалось загрузить файлы');
          setPendingFiles(savedFiles);
          setText(savedText);
          return;
        } finally {
          setUploading(false);
        }
      }

      const res = await chatApi.sendMessage(chatId, content, attachments, replyTo?.id ?? null);
      setMessages(prev => {
        if (prev.some(m => m.id === res.data.id)) return prev;
        return [res.data, ...prev];
      });
      setReplyTo(null);
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось отправить сообщение');
      setText(savedText);
      setPendingFiles(savedFiles);
    } finally {
      setSending(false);
    }
  };

  // ── File/image picking ─────────────────────────────────────────────────────
  const pickFromGallery = () => {
    setShowAttachMenu(false);
    launchImageLibrary({mediaType: 'mixed', selectionLimit: 10, includeBase64: false}, res => {
      if (res.didCancel || res.errorCode) return;
      const files = (res.assets || []).map(a => ({
        uri: a.uri,
        type: a.type || 'image/jpeg',
        name: a.fileName || `photo_${Date.now()}.jpg`,
        size: a.fileSize,
      }));
      setPendingFiles(prev => [...prev, ...files].slice(0, 10));
    });
  };

  const pickFromCamera = () => {
    setShowAttachMenu(false);
    launchCamera({mediaType: 'photo', includeBase64: false}, res => {
      if (res.didCancel || res.errorCode) return;
      const a = res.assets?.[0];
      if (!a) return;
      setPendingFiles(prev =>
        [...prev, {uri: a.uri, type: a.type || 'image/jpeg', name: a.fileName || `photo_${Date.now()}.jpg`, size: a.fileSize}].slice(0, 10),
      );
    });
  };

  const pickFile = async () => {
    setShowAttachMenu(false);
    try {
      const results = await pickDocument({allowMultiSelection: true});
      const files = results.map(r => ({uri: r.uri, type: r.type, name: r.name, size: r.size}));
      setPendingFiles(prev => [...prev, ...files].slice(0, 10));
    } catch {}
  };

  // ── Message actions ────────────────────────────────────────────────────────
  const handleLongPress = msg => {
    setContextMenu({message: msg});
  };

  const startEdit = msg => {
    setContextMenu(null);
    setEditingMessage(msg);
    setText(msg.content);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setText('');
  };

  const handleDelete = msg => {
    setContextMenu(null);
    Alert.alert('Удалить сообщение?', '', [
      {text: 'Отмена', style: 'cancel'},
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          try {
            await chatApi.deleteMessage(chatId, msg.id);
            setMessages(prev =>
              prev.map(m => m.id === msg.id ? {...m, content: 'Сообщение удалено', type: 'system', attachments: []} : m),
            );
          } catch {
            Alert.alert('Ошибка', 'Не удалось удалить сообщение');
          }
        },
      },
    ]);
  };

  const openReactionPicker = msg => {
    setContextMenu(null);
    setShowReactionPicker(msg.id);
  };

  const handleAddReaction = async (messageId, emoji) => {
    setShowReactionPicker(null);
    try {
      await chatApi.addReaction(chatId, messageId, emoji);
    } catch {}
  };

  const handleReactionTap = async (messageId, emoji, hasReacted) => {
    try {
      if (hasReacted) {
        await chatApi.removeReaction(chatId, messageId);
      } else {
        await chatApi.addReaction(chatId, messageId, emoji);
      }
    } catch {}
  };

  const startForward = msg => {
    setContextMenu(null);
    setSelectedForForward([msg.id]);
    chatApi.list().then(r => setChatsList(r.data)).catch(() => {});
    setShowForwardModal(true);
  };

  const doForward = async targetChatId => {
    setShowForwardModal(false);
    try {
      await chatApi.forwardMessages(targetChatId, selectedForForward);
      Alert.alert('Готово', 'Сообщение переслано');
    } catch {
      Alert.alert('Ошибка', 'Не удалось переслать сообщение');
    }
    setSelectedForForward([]);
  };

  // ── Processed list with date separators ────────────────────────────────────
  const listData = useMemo(() => withSeparators(messages), [messages]);

  // ── Render item ────────────────────────────────────────────────────────────
  const renderItem = useCallback(({item}) => {
    if (item._itemType === 'separator') {
      return (
        <View style={styles.dateSep}>
          <Text style={styles.dateSepText}>{formatDateSep(item.date)}</Text>
        </View>
      );
    }
    return (
      <MessageBubble
        message={item}
        isOwn={String(item.senderId) === String(user?.id)}
        chatType={chatType}
        isHighlighted={item.id === highlightedMsgId}
        onLongPress={handleLongPress}
        onReactionTap={handleReactionTap}
        onImagePress={url => setLightboxUrl(url)}
      />
    );
  }, [user, chatType, highlightedMsgId]);

  const keyExtractor = useCallback(item =>
    item._id || (item.id != null ? String(item.id) : item._itemType + '_' + item.date), []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>

      {/* In-chat search bar */}
      {searchMode && (
        <View style={styles.searchBar}>
          <TextInput
            ref={searchInputRef}
            style={styles.searchBarInput}
            placeholder="Поиск в чате..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchHits.length > 0 && (
            <>
              <Text style={styles.searchCount}>{searchIdx + 1}/{searchHits.length}</Text>
              <TouchableOpacity
                style={styles.searchNavBtn}
                onPress={() => setSearchIdx(i => Math.max(0, i - 1))}>
                <ChevronUp size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.searchNavBtn}
                onPress={() => setSearchIdx(i => Math.min(searchHits.length - 1, i + 1))}>
                <ChevronDown size={20} color={colors.primary} />
              </TouchableOpacity>
            </>
          )}
          {searchQuery.length > 0 && searchHits.length === 0 && (
            <Text style={styles.searchNone}>Не найдено</Text>
          )}
        </View>
      )}

      {/* Messages list (inverted = newest at bottom) */}
      <FlatList
        ref={flatListRef}
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        inverted
        contentContainerStyle={styles.msgList}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={10}
        removeClippedSubviews={false}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{marginVertical: 12}} /> : null}
        onScrollToIndexFailed={info => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({index: info.index, animated: true, viewPosition: 0.5});
          }, 300);
        }}
      />

      {/* Reaction quick-pick (after long press → reaction) */}
      {showReactionPicker && (
        <View style={styles.reactionQuickPick}>
          {REACTIONS.map(emoji => (
            <TouchableOpacity
              key={emoji}
              onPress={() => handleAddReaction(showReactionPicker, emoji)}
              style={styles.reactionQuickBtn}>
              <Text style={styles.reactionQuickText}>{emoji}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setShowReactionPicker(null)} style={styles.reactionQuickClose}>
            <X size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Edit mode banner */}
      {editingMessage && (
        <View style={styles.editBanner}>
          <Pencil size={14} color={colors.primary} style={{marginRight: 6}} />
          <Text style={styles.editBannerLabel}>Редактирование</Text>
          <Text style={styles.editBannerText} numberOfLines={1}>{editingMessage.content}</Text>
          <TouchableOpacity onPress={cancelEdit}>
            <X size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Reply banner */}
      {replyTo && !editingMessage && (
        <View style={styles.replyBanner}>
          <View style={styles.replyBannerBar} />
          <View style={styles.replyBannerContent}>
            <Text style={styles.replyBannerName}>
              {replyTo.sender?.displayName || 'Сообщение'}
            </Text>
            <Text style={styles.replyBannerText} numberOfLines={1}>
              {replyTo.content}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <X size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Pending attachments preview */}
      {pendingFiles.length > 0 && (
        <ScrollView horizontal style={styles.pendingRow} showsHorizontalScrollIndicator={false}>
          {pendingFiles.map((f, idx) => (
            <View key={idx} style={styles.pendingItem}>
              {f.type?.startsWith('image/') ? (
                <Image source={{uri: f.uri}} style={styles.pendingImage} />
              ) : (
                <View style={styles.pendingFile}>
                  <File size={28} color={colors.textSecondary} />
                </View>
              )}
              <Text style={styles.pendingName} numberOfLines={1}>{f.name}</Text>
              <TouchableOpacity
                style={styles.pendingRemove}
                onPress={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}>
                <X size={10} color="#FFF" strokeWidth={3} />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Emoji picker panel */}
      {showEmojiPicker && (
        <View style={styles.emojiPanel}>
          <ScrollView contentContainerStyle={styles.emojiGrid}>
            {COMMON_EMOJI.map(e => (
              <TouchableOpacity
                key={e}
                style={styles.emojiBtn}
                onPress={() => setText(prev => prev + e)}>
                <Text style={styles.emojiBtnText}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {setShowAttachMenu(true); setShowEmojiPicker(false);}}>
          <Paperclip size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          placeholder={editingMessage ? 'Редактировать...' : 'Сообщение...'}
          placeholderTextColor="#9CA3AF"
          value={text}
          onChangeText={val => {
            setText(val);
            SocketService.emit('typing_start', {chatId});
            if (sendTypingTimer.current) clearTimeout(sendTypingTimer.current);
            sendTypingTimer.current = setTimeout(() => {
              SocketService.emit('typing_stop', {chatId});
            }, 2000);
          }}
          multiline
          maxLength={4000}
        />

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {setShowEmojiPicker(v => !v); setShowAttachMenu(false);}}>
          <Smile size={22} color={showEmojiPicker ? colors.primary : colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() && pendingFiles.length === 0) && styles.sendBtnOff]}
          onPress={handleSend}
          disabled={(!text.trim() && pendingFiles.length === 0) || sending || uploading}>
          {sending || uploading
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Send size={18} color="#FFF" />}
        </TouchableOpacity>
      </View>

      {/* ── Attach menu modal ── */}
      <Modal transparent visible={showAttachMenu} animationType="fade" onRequestClose={() => setShowAttachMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAttachMenu(false)}>
          <View style={styles.attachMenu}>
            <TouchableOpacity style={styles.attachMenuItem} onPress={pickFromGallery}>
              <View style={styles.attachMenuIconWrap}>
                <ImageIcon size={26} color={colors.primary} />
              </View>
              <Text style={styles.attachMenuLabel}>Галерея</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachMenuItem} onPress={pickFromCamera}>
              <View style={styles.attachMenuIconWrap}>
                <Camera size={26} color={colors.primary} />
              </View>
              <Text style={styles.attachMenuLabel}>Камера</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachMenuItem} onPress={pickFile}>
              <View style={styles.attachMenuIconWrap}>
                <File size={26} color={colors.primary} />
              </View>
              <Text style={styles.attachMenuLabel}>Файл</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Context menu modal ── */}
      <Modal transparent visible={!!contextMenu} animationType="fade" onRequestClose={() => setContextMenu(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setContextMenu(null)}>
          <View style={styles.contextMenu}>
            {/* Reactions row */}
            <View style={styles.contextReactions}>
              {REACTIONS.map(emoji => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.contextReactionBtn}
                  onPress={() => {
                    setContextMenu(null);
                    handleAddReaction(contextMenu?.message?.id, emoji);
                  }}>
                  <Text style={styles.contextReactionText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.contextDivider} />

            <TouchableOpacity
              style={styles.contextItem}
              onPress={() => {setContextMenu(null); setReplyTo(contextMenu?.message);}}>
              <Reply size={18} color={colors.textPrimary} style={styles.contextItemIcon} />
              <Text style={styles.contextItemText}>Ответить</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contextItem}
              onPress={() => startForward(contextMenu?.message)}>
              <Forward size={18} color={colors.textPrimary} style={styles.contextItemIcon} />
              <Text style={styles.contextItemText}>Переслать</Text>
            </TouchableOpacity>

            {String(contextMenu?.message?.senderId) === String(user?.id) && (
              <>
                <TouchableOpacity
                  style={styles.contextItem}
                  onPress={() => startEdit(contextMenu?.message)}>
                  <Pencil size={18} color={colors.textPrimary} style={styles.contextItemIcon} />
                  <Text style={styles.contextItemText}>Редактировать</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contextItem}
                  onPress={() => handleDelete(contextMenu?.message)}>
                  <Trash2 size={18} color={colors.error} style={styles.contextItemIcon} />
                  <Text style={[styles.contextItemText, styles.contextItemDanger]}>Удалить</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* ── Forward modal ── */}
      <Modal transparent visible={showForwardModal} animationType="slide" onRequestClose={() => setShowForwardModal(false)}>
        <View style={styles.forwardModal}>
          <View style={styles.forwardModalHeader}>
            <Text style={styles.forwardModalTitle}>Переслать в чат</Text>
            <TouchableOpacity onPress={() => setShowForwardModal(false)}>
              <X size={22} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={chatsList}
            keyExtractor={item => item.id?.toString() || String(Math.random())}
            renderItem={({item}) => (
              <TouchableOpacity style={styles.forwardChatItem} onPress={() => doForward(item.id)}>
                <Avatar uri={item.avatar} name={item.displayName} size={40} />
                <Text style={styles.forwardChatName}>{item.displayName}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* ── Lightbox ── */}
      <Modal transparent visible={!!lightboxUrl} animationType="fade" onRequestClose={() => setLightboxUrl(null)}>
        <Pressable style={styles.lightboxOverlay} onPress={() => setLightboxUrl(null)}>
          <Image source={{uri: lightboxUrl}} style={styles.lightboxImage} resizeMode="contain" />
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxUrl(null)}>
            <X size={20} color="#FFF" />
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.bgSecondary},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  msgList: {paddingVertical: 8, paddingHorizontal: 10},

  // Date separator
  dateSep: {alignItems: 'center', marginVertical: 10},
  dateSepText: {
    fontSize: 12, fontFamily: font.regular, color: colors.textSecondary,
    backgroundColor: colors.borderLight, paddingHorizontal: 12, paddingVertical: 3,
    borderRadius: radius.md,
  },

  // System message
  systemMsgWrap: {alignItems: 'center', marginVertical: 4},
  systemMsgText: {fontSize: 12, fontFamily: font.regular, color: colors.textTertiary, fontStyle: 'italic'},

  // Bubble row
  bubbleRow: {flexDirection: 'row', marginVertical: 2, paddingHorizontal: 4},
  bubbleRowOwn: {justifyContent: 'flex-end'},
  bubbleRowOther: {justifyContent: 'flex-start'},
  bubbleRowHighlighted: {backgroundColor: 'rgba(255, 214, 0, 0.25)', borderRadius: 8},
  bubbleAvatar: {marginRight: 6, marginTop: 4},
  avatarPlaceholder: {backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center'},
  avatarText: {fontFamily: font.bold, color: colors.primary},

  bubbleContent: {maxWidth: '78%'},
  senderName: {fontSize: 12, fontFamily: font.regular, color: colors.primary, marginBottom: 2, marginLeft: 12},

  // Forward / reply
  forwardBadge: {
    flexDirection: 'row', alignItems: 'center',
    borderLeftWidth: 3, borderLeftColor: colors.textTertiary,
    paddingLeft: 8, marginBottom: 3,
    backgroundColor: colors.bgSecondary, borderRadius: 4, paddingVertical: 2, paddingRight: 8,
  },
  forwardBadgeOwn: {backgroundColor: 'rgba(255,255,255,0.2)', borderLeftColor: 'rgba(255,255,255,0.6)'},
  forwardLabel: {fontSize: 11, fontFamily: font.regular, color: colors.textSecondary, fontStyle: 'italic'},
  forwardLabelOwn: {color: 'rgba(255,255,255,0.75)'},

  replyBadge: {
    borderLeftWidth: 3, borderLeftColor: colors.primary,
    paddingLeft: 8, marginBottom: 3,
    backgroundColor: colors.primaryLight, borderRadius: 4, paddingVertical: 2, paddingRight: 8,
  },
  replyBadgeOwn: {backgroundColor: 'rgba(255,255,255,0.2)', borderLeftColor: 'rgba(255,255,255,0.6)'},
  replyAuthor: {fontSize: 11, fontFamily: font.semiBold, color: colors.primary},
  replyAuthorOwn: {color: 'rgba(255,255,255,0.9)'},
  replyText: {fontSize: 12, fontFamily: font.regular, color: colors.textSecondary},
  replyTextOwn: {color: 'rgba(255,255,255,0.75)'},

  // Bubble
  bubble: {borderRadius: radius.lg, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6},
  bubbleOther: {backgroundColor: colors.bgPrimary, borderBottomLeftRadius: 4, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: {width: 0, height: 1}},
  bubbleOwn: {backgroundColor: colors.primary, borderBottomRightRadius: 4},
  msgText: {fontSize: 15, fontFamily: font.regular, color: colors.textPrimary, lineHeight: 21},
  msgTextOwn: {color: colors.bgPrimary},
  deletedText: {fontSize: 14, fontFamily: font.regular, color: colors.textTertiary, fontStyle: 'italic'},
  bubbleMeta: {flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2, alignItems: 'center'},
  timeText: {fontSize: 11, fontFamily: font.regular, color: colors.textTertiary},
  timeTextOwn: {color: 'rgba(255,255,255,0.65)'},
  editedLabel: {fontSize: 11, fontFamily: font.regular, color: colors.textTertiary, fontStyle: 'italic'},
  editedLabelOwn: {color: 'rgba(255,255,255,0.6)'},

  // Reactions
  reactionsRow: {flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 4},
  reactionChip: {
    backgroundColor: colors.bgSecondary, borderRadius: radius.md, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  reactionChipActive: {backgroundColor: colors.primaryLight, borderColor: colors.primary},
  reactionChipText: {fontSize: 13, fontFamily: font.regular},

  // Attachments
  attachmentsWrap: {marginBottom: 4},
  attachImage: {width: SCREEN_WIDTH * 0.55, height: SCREEN_WIDTH * 0.45, borderRadius: 8, marginBottom: 4},
  attachFile: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgSecondary, borderRadius: 8, padding: 8, marginBottom: 4,
  },
  attachFileOwn: {backgroundColor: 'rgba(255,255,255,0.15)'},
  attachFileIcon: {fontSize: 22, marginRight: 8},
  attachFileInfo: {flex: 1},
  attachFileName: {fontSize: 13, color: colors.textPrimary, fontFamily: font.medium},
  attachFileNameOwn: {color: colors.bgPrimary},
  attachFileSize: {fontSize: 11, fontFamily: font.regular, color: colors.textSecondary, marginTop: 1},
  attachFileSizeOwn: {color: 'rgba(255,255,255,0.7)'},

  // Reaction quick pick
  reactionQuickPick: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgPrimary, paddingVertical: 10, paddingHorizontal: 12,
    borderTopWidth: 1, borderTopColor: colors.bgSecondary,
    elevation: 4,
  },
  reactionQuickBtn: {paddingHorizontal: 6},
  reactionQuickText: {fontSize: 26},
  reactionQuickClose: {marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 4},

  // Edit / reply banners
  editBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primaryLight, paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#BFDBFE',
  },
  editBannerLabel: {fontSize: 12, color: colors.primary, fontFamily: font.semiBold, marginRight: 8},
  editBannerText: {flex: 1, fontSize: 13, fontFamily: font.regular, color: colors.textPrimary},
  replyBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  replyBannerBar: {width: 3, height: '100%', backgroundColor: colors.primary, borderRadius: 2, marginRight: 10},
  replyBannerContent: {flex: 1},
  replyBannerName: {fontSize: 12, fontFamily: font.semiBold, color: colors.primary},
  replyBannerText: {fontSize: 13, fontFamily: font.regular, color: colors.textSecondary},

  // Pending files
  pendingRow: {
    backgroundColor: colors.bgPrimary, paddingVertical: 8, paddingHorizontal: 10,
    borderTopWidth: 1, borderTopColor: colors.bgSecondary, maxHeight: 90,
  },
  pendingItem: {alignItems: 'center', marginRight: 10, width: 70},
  pendingImage: {width: 60, height: 60, borderRadius: 6},
  pendingFile: {width: 60, height: 60, backgroundColor: colors.bgSecondary, borderRadius: 6, alignItems: 'center', justifyContent: 'center'},
  pendingName: {fontSize: 10, fontFamily: font.regular, color: colors.textSecondary, marginTop: 2},
  pendingRemove: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: colors.error, borderRadius: 8, width: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
  },

  // Emoji panel
  emojiPanel: {
    backgroundColor: colors.bgPrimary, borderTopWidth: 1, borderTopColor: colors.borderLight, maxHeight: 180,
  },
  emojiGrid: {flexDirection: 'row', flexWrap: 'wrap', padding: 8},
  emojiBtn: {padding: 6},
  emojiBtnText: {fontSize: 26},

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: colors.bgPrimary, paddingHorizontal: 8, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: colors.borderLight,
  },
  iconBtn: {width: 40, height: 40, alignItems: 'center', justifyContent: 'center'},
  textInput: {
    flex: 1, backgroundColor: colors.bgSecondary, borderRadius: radius.xl,
    paddingHorizontal: 14, paddingTop: 9, paddingBottom: 9,
    fontSize: 15, fontFamily: font.regular, color: colors.textPrimary, maxHeight: 120,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: radius.xl,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 6,
  },
  sendBtnOff: {backgroundColor: colors.primaryLight},

  // Modals
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end'},
  attachMenu: {
    backgroundColor: colors.bgPrimary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    flexDirection: 'row', paddingVertical: 24, paddingHorizontal: 20, justifyContent: 'space-around',
  },
  attachMenuItem: {alignItems: 'center'},
  attachMenuIconWrap: {
    width: 60, height: 60, borderRadius: radius.lg,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  attachMenuLabel: {fontSize: 13, fontFamily: font.regular, color: colors.textPrimary},

  contextMenu: {
    backgroundColor: colors.bgPrimary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: 16,
  },
  contextReactions: {flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8},
  contextReactionBtn: {padding: 6},
  contextReactionText: {fontSize: 28},
  contextDivider: {height: 1, backgroundColor: colors.bgSecondary, marginVertical: 8},
  contextItem: {flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8},
  contextItemIcon: {marginRight: 14},
  contextItemText: {fontSize: 16, fontFamily: font.regular, color: colors.textPrimary},
  contextItemDanger: {color: colors.error},

  // Forward modal
  forwardModal: {
    flex: 1, marginTop: 80, backgroundColor: colors.bgPrimary,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
  },
  forwardModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: colors.bgSecondary,
  },
  forwardModalTitle: {fontSize: 17, fontFamily: font.bold, color: colors.textPrimary},
  forwardChatItem: {flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12},
  forwardChatName: {fontSize: 15, fontFamily: font.regular, color: colors.textPrimary},

  // Lightbox
  lightboxOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  lightboxImage: {width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2},
  lightboxClose: {
    position: 'absolute', top: 50, right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },

  // In-chat search bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgPrimary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 6,
  },
  searchBarInput: {
    flex: 1,
    height: 36,
    backgroundColor: colors.bgSecondary,
    borderRadius: 18,
    paddingHorizontal: 14,
    fontSize: 14,
    fontFamily: font.regular,
    color: colors.textPrimary,
  },
  searchCount: {
    fontSize: 13,
    fontFamily: font.medium,
    color: colors.textSecondary,
    minWidth: 36,
    textAlign: 'center',
  },
  searchNavBtn: {padding: 4},
  searchNone: {
    fontSize: 13,
    fontFamily: font.regular,
    color: colors.textTertiary,
    paddingRight: 4,
  },
});
