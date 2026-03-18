import React, {useEffect, useState, useCallback, useRef} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Image,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Search} from 'lucide-react-native';
import {chat as chatApi} from '../../services/api';
import SocketService from '../../services/socket';
import {useAuth} from '../../store/authStore';
import avatarUrl from '../../utils/avatarUrl';
import {colors, radius, shadow, font} from '../../theme';

function Avatar({uri, name, size = 44}) {
  const url = avatarUrl(uri);
  if (url) {
    return (
      <Image
        source={{uri: url}}
        style={[styles.avatar, {width: size, height: size, borderRadius: size / 2}]}
      />
    );
  }
  const initials = (name || '?')
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  return (
    <View style={[styles.avatarPlaceholder, {width: size, height: size, borderRadius: size / 2}]}>
      <Text style={[styles.avatarText, {fontSize: size * 0.36}]}>{initials}</Text>
    </View>
  );
}

function ChatItem({item, onPress}) {
  const unread = item.unreadCount > 0;
  const lastMsg = item.lastMessage;

  return (
    <TouchableOpacity style={styles.chatItem} onPress={() => onPress(item)} activeOpacity={0.7}>
      <Avatar
        uri={item.type === 'private' ? (item.otherUser?.avatar || item.avatar) : item.avatar}
        name={item.displayName}
      />
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={[styles.chatName, unread && styles.chatNameBold]} numberOfLines={1}>
            {item.displayName || 'Чат'}
          </Text>
          {item.lastMessageAt && (
            <Text style={styles.chatTime}>{formatTime(item.lastMessageAt)}</Text>
          )}
        </View>
        <View style={styles.chatFooter}>
          <Text
            style={[styles.lastMessage, unread && styles.lastMessageBold]}
            numberOfLines={1}>
            {lastMsg?.content || ''}
          </Text>
          {unread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {item.unreadCount > 99 ? '99+' : item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function formatTime(iso) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ChatListScreen({navigation}) {
  const {user} = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const initialLoadDone = useRef(false);

  const loadChats = useCallback(async () => {
    try {
      const res = await chatApi.list();
      setChats(res.data);
    } catch (err) {
      console.warn('[ChatList] load error:', err.message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!initialLoadDone.current) {
        // First load — show spinner until data arrives
        loadChats().finally(() => {
          setLoading(false);
          initialLoadDone.current = true;
        });
      } else {
        // Subsequent focus — refresh silently without clearing the list
        setLoading(false);
        loadChats();
      }
    }, [loadChats]),
  );

  useEffect(() => {
    SocketService.on('chatlist:new_message', 'new_message', data => {
      const incomingChatId = data.chat?.id ?? data.chatId;
      setChats(prev => {
        const updated = prev.map(c =>
          String(c.id) === String(incomingChatId)
            ? {
                ...c,
                lastMessage: data.message,
                lastMessageAt: data.message.createdAt,
                unreadCount:
                  String(data.message.senderId) !== String(user?.id)
                    ? (c.unreadCount || 0) + 1
                    : c.unreadCount,
              }
            : c,
        );
        return updated.sort(
          (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt),
        );
      });
    });
    return () => SocketService.off('chatlist:new_message');
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChats();
    setRefreshing(false);
  };

  // Debounced backend search when query is long enough
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await chatApi.search(q);
        setSearchResults(res.data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const filteredChats = search.trim().length >= 2 ? searchResults : chats;

  const openChat = chat => {
    navigation.navigate('Chat', {
      chatId: chat.id,
      chatName: chat.displayName || chat.name,
      chatAvatar: chat.type === 'private' ? (chat.otherUser?.avatar || chat.avatar) : chat.avatar,
      chatType: chat.type,
      otherUserId: chat.otherUser?.id,
      otherUserIsOnline: chat.otherUser?.isOnline ?? false,
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBox}>
        <View style={styles.searchInner}>
          <Search size={16} color={colors.textTertiary} style={{marginRight: 8}} />
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск чатов..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <FlatList
        data={filteredChats}
        keyExtractor={(item, index) => item.id?.toString() || `chat_${index}`}
        renderItem={({item}) => (
          <ChatItem item={item} onPress={openChat} />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {searching
              ? <ActivityIndicator color={colors.primary} />
              : <Text style={styles.emptyText}>
                  {search.trim().length >= 2 ? 'Ничего не найдено' : 'Нет чатов'}
                </Text>
            }
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.bgPrimary},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},

  searchBox: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.bgPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgSecondary,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: font.regular,
    color: colors.textPrimary,
  },

  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  avatar: {resizeMode: 'cover'},
  avatarPlaceholder: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {fontFamily: font.semiBold, color: colors.primary},
  chatInfo: {flex: 1, marginLeft: 13},
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  chatName: {fontSize: 15, color: colors.textPrimary, flex: 1, marginRight: 8, fontFamily: font.regular},
  chatNameBold: {fontFamily: font.semiBold},
  chatTime: {fontSize: 12, color: colors.textTertiary, fontFamily: font.regular},
  chatFooter: {flexDirection: 'row', alignItems: 'center'},
  lastMessage: {fontSize: 14, color: colors.textSecondary, flex: 1, fontFamily: font.regular},
  lastMessageBold: {color: colors.textPrimary, fontFamily: font.medium},
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {color: '#FFFFFF', fontSize: 11, fontFamily: font.semiBold},
  separator: {height: 1, backgroundColor: colors.borderLight, marginLeft: 73},
  empty: {paddingTop: 60, alignItems: 'center'},
  emptyText: {fontSize: 15, color: colors.textTertiary, fontFamily: font.regular},

});
