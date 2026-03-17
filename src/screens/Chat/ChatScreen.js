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
import {chat as chatApi} from '../../services/api';
import SocketService from '../../services/socket';
import {useAuth} from '../../store/authStore';
import avatarUrl from '../../utils/avatarUrl';
import CONFIG from '../../config';

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
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.attachFile, isOwn && styles.attachFileOwn]}
              onPress={() => url && Linking.openURL(url)}>
              <Text style={styles.attachFileIcon}>🎬</Text>
              <View style={styles.attachFileInfo}>
                <Text style={[styles.attachFileName, isOwn && styles.attachFileNameOwn]} numberOfLines={1}>{att.name}</Text>
                <Text style={[styles.attachFileSize, isOwn && styles.attachFileSizeOwn]}>{formatFileSize(att.size)}</Text>
              </View>
            </TouchableOpacity>
          );
        }

        const icon = mime.includes('pdf') ? '📄' : mime.includes('word') || mime.includes('doc') ? '📝' : mime.includes('excel') || mime.includes('sheet') ? '📊' : mime.includes('zip') || mime.includes('rar') ? '🗜️' : '📎';

        return (
          <TouchableOpacity
            key={idx}
            style={[styles.attachFile, isOwn && styles.attachFileOwn]}
            onPress={() => url && Linking.openURL(url)}>
            <Text style={styles.attachFileIcon}>{icon}</Text>
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
function MessageBubble({message, isOwn, chatType, onLongPress, onReactionTap, onImagePress}) {
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
      style={[styles.bubbleRow, isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther]}>
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
            <Text style={[styles.forwardLabel, isOwn && styles.forwardLabelOwn]}>
              ↩ Переслано от {message.forwardedFrom.senderName || 'пользователя'}
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

// ── Main screen ──────────────────────────────────────────────────────────────
export default function ChatScreen({route, navigation}) {
  const {chatId, chatName, chatType} = route.params;
  const {user} = useAuth();

  const [messages, setMessages] = useState([]); // newest-first
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

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
      const fetched = Array.isArray(res.data) ? res.data : (res.data.messages ?? []);
      // Backend returns DESC (newest first)
      if (fetched.length < 50) setHasMore(false);
      if (before) {
        // Load older → append to end of array (visually top)
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
    navigation.setOptions({title: chatName || 'Чат'});
  }, [chatId, chatName, loadMessages, navigation]);

  // ── Socket real-time ───────────────────────────────────────────────────────
  useEffect(() => {
    const handleNewMessage = data => {
      if (data.chatId !== chatId) return;
      setMessages(prev => {
        if (prev.some(m => m.id === data.message.id)) return prev;
        return [data.message, ...prev]; // prepend (newest first)
      });
      chatApi.markAsRead(chatId).catch(() => {});
    };

    const handleReactionUpdate = data => {
      if (data.chatId !== chatId) return;
      setMessages(prev =>
        prev.map(m => m.id === data.messageId ? {...m, reactions: data.reactions} : m),
      );
    };

    const handleMsgEdit = data => {
      if (data.chatId !== chatId) return;
      setMessages(prev =>
        prev.map(m => m.id === data.messageId ? {...m, content: data.content, isEdited: true} : m),
      );
    };

    SocketService.on('new_message', handleNewMessage);
    SocketService.on('message_reaction_updated', handleReactionUpdate);
    SocketService.on('message_edited', handleMsgEdit);

    return () => {
      SocketService.off('new_message');
      SocketService.off('message_reaction_updated');
      SocketService.off('message_edited');
    };
  }, [chatId]);

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

      await chatApi.sendMessage(chatId, content, attachments, replyTo?.id ?? null);
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
        isOwn={item.senderId === user?.id}
        chatType={chatType}
        onLongPress={handleLongPress}
        onReactionTap={handleReactionTap}
        onImagePress={url => setLightboxUrl(url)}
      />
    );
  }, [user, chatType]);

  const keyExtractor = useCallback(item =>
    item._id || item.id?.toString() || `item_${Math.random()}`, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>

      {/* Messages list (inverted = newest at bottom) */}
      <FlatList
        data={listData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        inverted
        contentContainerStyle={styles.msgList}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={loadingMore ? <ActivityIndicator color="#2563EB" style={{marginVertical: 12}} /> : null}
        removeClippedSubviews={false}
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
            <Text style={styles.reactionQuickCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Edit mode banner */}
      {editingMessage && (
        <View style={styles.editBanner}>
          <Text style={styles.editBannerLabel}>✏️ Редактирование</Text>
          <Text style={styles.editBannerText} numberOfLines={1}>{editingMessage.content}</Text>
          <TouchableOpacity onPress={cancelEdit}>
            <Text style={styles.editBannerClose}>✕</Text>
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
            <Text style={styles.replyBannerClose}>✕</Text>
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
                  <Text style={styles.pendingFileIcon}>📎</Text>
                </View>
              )}
              <Text style={styles.pendingName} numberOfLines={1}>{f.name}</Text>
              <TouchableOpacity
                style={styles.pendingRemove}
                onPress={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))}>
                <Text style={styles.pendingRemoveText}>✕</Text>
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
          <Text style={styles.iconBtnText}>📎</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          placeholder={editingMessage ? 'Редактировать...' : 'Сообщение...'}
          placeholderTextColor="#9CA3AF"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={4000}
        />

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => {setShowEmojiPicker(v => !v); setShowAttachMenu(false);}}>
          <Text style={styles.iconBtnText}>😊</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() && pendingFiles.length === 0) && styles.sendBtnOff]}
          onPress={handleSend}
          disabled={(!text.trim() && pendingFiles.length === 0) || sending || uploading}>
          {sending || uploading
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={styles.sendBtnText}>➤</Text>}
        </TouchableOpacity>
      </View>

      {/* ── Attach menu modal ── */}
      <Modal transparent visible={showAttachMenu} animationType="fade" onRequestClose={() => setShowAttachMenu(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAttachMenu(false)}>
          <View style={styles.attachMenu}>
            <TouchableOpacity style={styles.attachMenuItem} onPress={pickFromGallery}>
              <Text style={styles.attachMenuIcon}>🖼️</Text>
              <Text style={styles.attachMenuLabel}>Галерея</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachMenuItem} onPress={pickFromCamera}>
              <Text style={styles.attachMenuIcon}>📷</Text>
              <Text style={styles.attachMenuLabel}>Камера</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachMenuItem} onPress={pickFile}>
              <Text style={styles.attachMenuIcon}>📄</Text>
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
              <Text style={styles.contextItemText}>↩️ Ответить</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contextItem}
              onPress={() => startForward(contextMenu?.message)}>
              <Text style={styles.contextItemText}>➡️ Переслать</Text>
            </TouchableOpacity>

            {contextMenu?.message?.senderId === user?.id && (
              <>
                <TouchableOpacity
                  style={styles.contextItem}
                  onPress={() => startEdit(contextMenu?.message)}>
                  <Text style={styles.contextItemText}>✏️ Редактировать</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contextItem}
                  onPress={() => handleDelete(contextMenu?.message)}>
                  <Text style={[styles.contextItemText, styles.contextItemDanger]}>🗑️ Удалить</Text>
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
              <Text style={styles.forwardModalClose}>✕</Text>
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
            <Text style={styles.lightboxCloseText}>✕</Text>
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F3F4F6'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  msgList: {paddingVertical: 8, paddingHorizontal: 10},

  // Date separator
  dateSep: {alignItems: 'center', marginVertical: 10},
  dateSepText: {
    fontSize: 12, color: '#6B7280',
    backgroundColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 3,
    borderRadius: 10,
  },

  // System message
  systemMsgWrap: {alignItems: 'center', marginVertical: 4},
  systemMsgText: {fontSize: 12, color: '#9CA3AF', fontStyle: 'italic'},

  // Bubble row
  bubbleRow: {flexDirection: 'row', marginVertical: 2, paddingHorizontal: 4},
  bubbleRowOwn: {justifyContent: 'flex-end'},
  bubbleRowOther: {justifyContent: 'flex-start'},
  bubbleAvatar: {marginRight: 6, marginTop: 4},
  avatarPlaceholder: {backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center'},
  avatarText: {fontWeight: '700', color: '#2563EB'},

  bubbleContent: {maxWidth: '78%'},
  senderName: {fontSize: 12, color: '#2563EB', marginBottom: 2, marginLeft: 12},

  // Forward / reply
  forwardBadge: {
    borderLeftWidth: 3, borderLeftColor: '#9CA3AF',
    paddingLeft: 8, marginBottom: 3,
    backgroundColor: '#F3F4F6', borderRadius: 4, paddingVertical: 2, paddingRight: 8,
  },
  forwardBadgeOwn: {backgroundColor: 'rgba(255,255,255,0.2)', borderLeftColor: 'rgba(255,255,255,0.6)'},
  forwardLabel: {fontSize: 11, color: '#6B7280', fontStyle: 'italic'},
  forwardLabelOwn: {color: 'rgba(255,255,255,0.75)'},

  replyBadge: {
    borderLeftWidth: 3, borderLeftColor: '#2563EB',
    paddingLeft: 8, marginBottom: 3,
    backgroundColor: '#EFF6FF', borderRadius: 4, paddingVertical: 2, paddingRight: 8,
  },
  replyBadgeOwn: {backgroundColor: 'rgba(255,255,255,0.2)', borderLeftColor: 'rgba(255,255,255,0.6)'},
  replyAuthor: {fontSize: 11, fontWeight: '600', color: '#2563EB'},
  replyAuthorOwn: {color: 'rgba(255,255,255,0.9)'},
  replyText: {fontSize: 12, color: '#4B5563'},
  replyTextOwn: {color: 'rgba(255,255,255,0.75)'},

  // Bubble
  bubble: {borderRadius: 16, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6},
  bubbleOther: {backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, shadowOffset: {width: 0, height: 1}},
  bubbleOwn: {backgroundColor: '#2563EB', borderBottomRightRadius: 4},
  msgText: {fontSize: 15, color: '#111827', lineHeight: 21},
  msgTextOwn: {color: '#FFFFFF'},
  deletedText: {fontSize: 14, color: '#9CA3AF', fontStyle: 'italic'},
  bubbleMeta: {flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2, alignItems: 'center'},
  timeText: {fontSize: 11, color: '#9CA3AF'},
  timeTextOwn: {color: 'rgba(255,255,255,0.65)'},
  editedLabel: {fontSize: 11, color: '#9CA3AF', fontStyle: 'italic'},
  editedLabelOwn: {color: 'rgba(255,255,255,0.6)'},

  // Reactions
  reactionsRow: {flexDirection: 'row', flexWrap: 'wrap', marginTop: 4, gap: 4},
  reactionChip: {
    backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  reactionChipActive: {backgroundColor: '#EFF6FF', borderColor: '#2563EB'},
  reactionChipText: {fontSize: 13},

  // Attachments
  attachmentsWrap: {marginBottom: 4},
  attachImage: {width: SCREEN_WIDTH * 0.55, height: SCREEN_WIDTH * 0.45, borderRadius: 8, marginBottom: 4},
  attachFile: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 8, padding: 8, marginBottom: 4,
  },
  attachFileOwn: {backgroundColor: 'rgba(255,255,255,0.15)'},
  attachFileIcon: {fontSize: 22, marginRight: 8},
  attachFileInfo: {flex: 1},
  attachFileName: {fontSize: 13, color: '#111827', fontWeight: '500'},
  attachFileNameOwn: {color: '#FFFFFF'},
  attachFileSize: {fontSize: 11, color: '#6B7280', marginTop: 1},
  attachFileSizeOwn: {color: 'rgba(255,255,255,0.7)'},

  // Reaction quick pick
  reactionQuickPick: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingVertical: 10, paddingHorizontal: 12,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
    elevation: 4,
  },
  reactionQuickBtn: {paddingHorizontal: 6},
  reactionQuickText: {fontSize: 26},
  reactionQuickClose: {marginLeft: 'auto', paddingHorizontal: 8},
  reactionQuickCloseText: {fontSize: 18, color: '#9CA3AF'},

  // Edit / reply banners
  editBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#EFF6FF', paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#BFDBFE',
  },
  editBannerLabel: {fontSize: 12, color: '#2563EB', fontWeight: '600', marginRight: 8},
  editBannerText: {flex: 1, fontSize: 13, color: '#374151'},
  editBannerClose: {fontSize: 16, color: '#9CA3AF', paddingLeft: 8},
  replyBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F9FAFB', paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  replyBannerBar: {width: 3, height: '100%', backgroundColor: '#2563EB', borderRadius: 2, marginRight: 10},
  replyBannerContent: {flex: 1},
  replyBannerName: {fontSize: 12, fontWeight: '600', color: '#2563EB'},
  replyBannerText: {fontSize: 13, color: '#6B7280'},
  replyBannerClose: {fontSize: 16, color: '#9CA3AF', paddingLeft: 8},

  // Pending files
  pendingRow: {
    backgroundColor: '#FFFFFF', paddingVertical: 8, paddingHorizontal: 10,
    borderTopWidth: 1, borderTopColor: '#F3F4F6', maxHeight: 90,
  },
  pendingItem: {alignItems: 'center', marginRight: 10, width: 70},
  pendingImage: {width: 60, height: 60, borderRadius: 6},
  pendingFile: {width: 60, height: 60, backgroundColor: '#F3F4F6', borderRadius: 6, alignItems: 'center', justifyContent: 'center'},
  pendingFileIcon: {fontSize: 28},
  pendingName: {fontSize: 10, color: '#6B7280', marginTop: 2},
  pendingRemove: {
    position: 'absolute', top: 0, right: 0,
    backgroundColor: '#EF4444', borderRadius: 8, width: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  pendingRemoveText: {color: '#FFF', fontSize: 10, fontWeight: '700'},

  // Emoji panel
  emojiPanel: {
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB', maxHeight: 180,
  },
  emojiGrid: {flexDirection: 'row', flexWrap: 'wrap', padding: 8},
  emojiBtn: {padding: 6},
  emojiBtnText: {fontSize: 26},

  // Input bar
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    backgroundColor: '#FFFFFF', paddingHorizontal: 8, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: '#E5E7EB',
  },
  iconBtn: {width: 40, height: 40, alignItems: 'center', justifyContent: 'center'},
  iconBtnText: {fontSize: 22},
  textInput: {
    flex: 1, backgroundColor: '#F3F4F6', borderRadius: 20,
    paddingHorizontal: 14, paddingTop: 9, paddingBottom: 9,
    fontSize: 15, color: '#111827', maxHeight: 120,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center', marginLeft: 6,
  },
  sendBtnOff: {backgroundColor: '#BFDBFE'},
  sendBtnText: {fontSize: 16, color: '#FFF'},

  // Modals
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end'},
  attachMenu: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    flexDirection: 'row', paddingVertical: 24, paddingHorizontal: 20, justifyContent: 'space-around',
  },
  attachMenuItem: {alignItems: 'center'},
  attachMenuIcon: {fontSize: 36, marginBottom: 6},
  attachMenuLabel: {fontSize: 13, color: '#374151'},

  contextMenu: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 16,
  },
  contextReactions: {flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8},
  contextReactionBtn: {padding: 6},
  contextReactionText: {fontSize: 28},
  contextDivider: {height: 1, backgroundColor: '#F3F4F6', marginVertical: 8},
  contextItem: {paddingVertical: 14, paddingHorizontal: 8},
  contextItemText: {fontSize: 16, color: '#111827'},
  contextItemDanger: {color: '#EF4444'},

  // Forward modal
  forwardModal: {
    flex: 1, marginTop: 80, backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  forwardModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  forwardModalTitle: {fontSize: 17, fontWeight: '700', color: '#111827'},
  forwardModalClose: {fontSize: 20, color: '#9CA3AF'},
  forwardChatItem: {flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12},
  forwardChatName: {fontSize: 15, color: '#111827'},

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
  lightboxCloseText: {color: '#FFF', fontSize: 18},
});
