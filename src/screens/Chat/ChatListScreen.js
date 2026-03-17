import React, {useEffect, useState, useCallback} from 'react';
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
import {chat as chatApi} from '../../services/api';
import SocketService from '../../services/socket';
import {useAuth} from '../../store/authStore';
import avatarUrl from '../../utils/avatarUrl';

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
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

function ChatItem({item, onPress, currentUserId}) {
  const unread = item.unreadCount > 0;
  const lastMsg = item.lastMessage;

  return (
    <TouchableOpacity style={styles.chatItem} onPress={() => onPress(item)}>
      <Avatar uri={item.avatar} name={item.displayName} />
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={[styles.chatName, unread && styles.chatNameBold]} numberOfLines={1}>
            {item.displayName || 'Чат'}
          </Text>
          {item.lastMessageAt && (
            <Text style={styles.chatTime}>
              {formatTime(item.lastMessageAt)}
            </Text>
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
  const {user, logout} = useAuth();
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

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
      loadChats().finally(() => setLoading(false));
    }, [loadChats]),
  );

  // Real-time: update chat list when new message arrives
  useEffect(() => {
    SocketService.on('new_message', data => {
      setChats(prev =>
        prev.map(c =>
          c.id === data.chatId
            ? {
                ...c,
                lastMessage: data.message,
                lastMessageAt: data.message.createdAt,
                unreadCount:
                  data.message.senderId !== user?.id
                    ? (c.unreadCount || 0) + 1
                    : c.unreadCount,
              }
            : c,
        ).sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)),
      );
    });

    return () => SocketService.off('new_message');
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChats();
    setRefreshing(false);
  };

  const filteredChats = search.trim()
    ? chats.filter(c =>
        (c.displayName || '').toLowerCase().includes(search.toLowerCase()),
      )
    : chats;

  const openChat = chat => {
    navigation.navigate('Chat', {
      chatId: chat.id,
      chatName: chat.displayName,
      chatAvatar: chat.avatar,
      chatType: chat.type,
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск чатов..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filteredChats}
        keyExtractor={(item, index) => item.id?.toString() || `chat_${index}`}
        renderItem={({item}) => (
          <ChatItem item={item} onPress={openChat} currentUserId={user?.id} />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Нет чатов</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('NewChat')}>
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#FFFFFF'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  searchBox: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    color: '#111827',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {resizeMode: 'cover'},
  avatarPlaceholder: {
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {fontSize: 16, fontWeight: '600', color: '#2563EB'},
  chatInfo: {flex: 1, marginLeft: 12},
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  chatName: {fontSize: 15, color: '#111827', flex: 1, marginRight: 8},
  chatNameBold: {fontWeight: '600'},
  chatTime: {fontSize: 12, color: '#9CA3AF'},
  chatFooter: {flexDirection: 'row', alignItems: 'center'},
  lastMessage: {fontSize: 13, color: '#6B7280', flex: 1},
  lastMessageBold: {color: '#374151', fontWeight: '500'},
  badge: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {color: '#FFFFFF', fontSize: 11, fontWeight: '600'},
  separator: {height: 1, backgroundColor: '#F3F4F6', marginLeft: 72},
  empty: {paddingTop: 60, alignItems: 'center'},
  emptyText: {fontSize: 15, color: '#9CA3AF'},
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#2563EB',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
  },
  fabIcon: {fontSize: 28, color: '#FFFFFF', lineHeight: 32},
});
