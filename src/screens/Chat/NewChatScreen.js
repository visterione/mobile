import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {chat as chatApi} from '../../services/api';
import {useAuth} from '../../store/authStore';

export default function NewChatScreen({navigation}) {
  const {user} = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    chatApi.getUsers()
      .then(res => setUsers(res.data.filter(u => u.id !== user?.id)))
      .catch(err => Alert.alert('Ошибка', err.message))
      .finally(() => setLoading(false));
  }, [user]);

  const toggleSelect = u => {
    setSelected(prev =>
      prev.find(x => x.id === u.id)
        ? prev.filter(x => x.id !== u.id)
        : [...prev, u],
    );
  };

  const startChat = async () => {
    if (selected.length === 0) return;
    setCreating(true);
    try {
      if (selected.length === 1) {
        const res = await chatApi.startPrivate(selected[0].id);
        navigation.replace('Chat', {
          chatId: res.data.id,
          chatName: res.data.displayName,
          chatType: 'private',
        });
      } else {
        if (!groupName.trim()) {
          Alert.alert('Укажите название группы');
          return;
        }
        const res = await chatApi.createGroup(
          groupName.trim(),
          selected.map(u => u.id),
        );
        navigation.replace('Chat', {
          chatId: res.data.id,
          chatName: res.data.name,
          chatType: 'group',
        });
      }
    } catch (err) {
      Alert.alert('Ошибка', err.message);
    } finally {
      setCreating(false);
    }
  };

  const filtered = search.trim()
    ? users.filter(u =>
        (u.displayName || u.username || '')
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
    : users;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск сотрудников..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {selected.length > 1 && (
        <TextInput
          style={styles.groupNameInput}
          placeholder="Название группы"
          placeholderTextColor="#9CA3AF"
          value={groupName}
          onChangeText={setGroupName}
        />
      )}

      {selected.length > 0 && (
        <TouchableOpacity
          style={[styles.createBtn, creating && styles.createBtnDisabled]}
          onPress={startChat}
          disabled={creating}>
          {creating ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.createBtnText}>
              {selected.length === 1
                ? `Написать ${selected[0].displayName}`
                : `Создать группу (${selected.length})`}
            </Text>
          )}
        </TouchableOpacity>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => item.id?.toString() || `user_${index}`}
          renderItem={({item}) => {
            const isSelected = !!selected.find(x => x.id === item.id);
            return (
              <TouchableOpacity
                style={[styles.userItem, isSelected && styles.userItemSelected]}
                onPress={() => toggleSelect(item)}>
                <View style={styles.userAvatar}>
                  <Text style={styles.userAvatarText}>
                    {(item.displayName || item.username || '?')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>
                    {item.displayName || item.username}
                  </Text>
                  {item.position && (
                    <Text style={styles.userPosition}>{item.position}</Text>
                  )}
                </View>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>Нет сотрудников</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#FFFFFF'},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40},
  header: {
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  groupNameInput: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 15,
    color: '#111827',
  },
  createBtn: {
    margin: 16,
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  createBtnDisabled: {backgroundColor: '#93C5FD'},
  createBtnText: {color: '#FFFFFF', fontSize: 15, fontWeight: '600'},
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userItemSelected: {backgroundColor: '#EFF6FF'},
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {fontSize: 16, fontWeight: '600', color: '#2563EB'},
  userInfo: {flex: 1, marginLeft: 12},
  userName: {fontSize: 15, color: '#111827', fontWeight: '500'},
  userPosition: {fontSize: 12, color: '#6B7280', marginTop: 1},
  checkmark: {fontSize: 18, color: '#2563EB', fontWeight: '700'},
  separator: {height: 1, backgroundColor: '#F3F4F6', marginLeft: 70},
  emptyText: {fontSize: 15, color: '#9CA3AF'},
});
