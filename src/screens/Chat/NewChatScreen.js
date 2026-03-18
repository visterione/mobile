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
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {MessageSquare, Users, X, Check, Search} from 'lucide-react-native';
import {chat as chatApi} from '../../services/api';
import {useAuth} from '../../store/authStore';
import {colors, radius, font} from '../../theme';

export default function NewChatScreen({navigation, route}) {
  const {user} = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState(route?.params?.initialMode || 'private');

  useEffect(() => {
    chatApi
      .getUsers()
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
    if (selected.length === 0) {
      Alert.alert('Выберите участника');
      return;
    }
    if (mode === 'group' && !groupName.trim()) {
      Alert.alert('Укажите название группы');
      return;
    }
    setCreating(true);
    try {
      if (mode === 'private') {
        const res = await chatApi.startPrivate(selected[0].id);
        navigation.replace('Chat', {
          chatId: res.data.id,
          chatName: res.data.displayName,
          chatType: 'private',
        });
      } else {
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
      Alert.alert('Ошибка', err.response?.data?.error || err.message);
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

  const initials = name =>
    (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <View style={styles.container}>
      {/* Mode tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, mode === 'private' && styles.tabActive]}
          onPress={() => {setMode('private'); setSelected([]);}}>
          <MessageSquare
            size={16}
            color={mode === 'private' ? colors.primary : colors.textSecondary}
            style={{marginRight: 7}}
          />
          <Text style={[styles.tabText, mode === 'private' && styles.tabTextActive]}>
            Личный чат
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, mode === 'group' && styles.tabActive]}
          onPress={() => {setMode('group'); setSelected([]);}}>
          <Users
            size={16}
            color={mode === 'group' ? colors.primary : colors.textSecondary}
            style={{marginRight: 7}}
          />
          <Text style={[styles.tabText, mode === 'group' && styles.tabTextActive]}>
            Группа
          </Text>
        </TouchableOpacity>
      </View>

      {/* Group name input */}
      {mode === 'group' && (
        <View style={styles.groupNameWrap}>
          <TextInput
            style={styles.groupNameInput}
            placeholder="Название группы *"
            placeholderTextColor={colors.textTertiary}
            value={groupName}
            onChangeText={setGroupName}
          />
        </View>
      )}

      {/* Hint */}
      <Text style={styles.hint}>
        {mode === 'private'
          ? 'Выберите одного сотрудника'
          : `Выберите участников (выбрано: ${selected.length})`}
      </Text>

      {/* Selected chips */}
      {mode === 'group' && selected.length > 0 && (
        <ScrollView
          horizontal
          style={styles.chipsRow}
          showsHorizontalScrollIndicator={false}>
          {selected.map(u => (
            <TouchableOpacity
              key={u.id}
              style={styles.chip}
              onPress={() => toggleSelect(u)}>
              <Text style={styles.chipText}>{u.displayName || u.username}</Text>
              <X size={12} color={colors.primary} style={{marginLeft: 4}} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Search */}
      <View style={styles.searchWrap}>
        <View style={styles.searchInner}>
          <Search size={15} color={colors.textTertiary} style={{marginRight: 8}} />
          <TextInput
            style={styles.searchInput}
            placeholder="Поиск сотрудников..."
            placeholderTextColor={colors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {/* Users list */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, index) => item.id?.toString() || `user_${index}`}
          renderItem={({item}) => {
            const isSelected = !!selected.find(x => x.id === item.id);
            const disabled = mode === 'private' && selected.length === 1 && !isSelected;
            return (
              <TouchableOpacity
                style={[
                  styles.userItem,
                  isSelected && styles.userItemSelected,
                  disabled && styles.userItemDisabled,
                ]}
                onPress={() => {
                  if (mode === 'private') {
                    setSelected(isSelected ? [] : [item]);
                  } else {
                    toggleSelect(item);
                  }
                }}
                disabled={disabled}
                activeOpacity={0.7}>
                <View style={[styles.userAvatar, isSelected && styles.userAvatarSelected]}>
                  <Text style={[styles.userAvatarText, isSelected && styles.userAvatarTextSelected]}>
                    {initials(item.displayName || item.username)}
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
                {isSelected && <Check size={18} color={colors.primary} />}
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

      {/* Create button */}
      {selected.length > 0 && (
        <TouchableOpacity
          onPress={startChat}
          disabled={creating}
          activeOpacity={0.85}
          style={styles.createBtnWrap}>
          <LinearGradient
            colors={creating ? ['#93C5FD', '#93C5FD'] : [colors.primary, colors.secondary]}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={styles.createBtn}>
            {creating ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.createBtnText}>
                {mode === 'private'
                  ? `Написать ${selected[0].displayName || selected[0].username}`
                  : `Создать группу (${selected.length} уч.)`}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.bgPrimary},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40},

  // Tabs
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {borderBottomColor: colors.primary},
  tabText: {fontSize: 14, color: colors.textSecondary, fontFamily: font.medium},
  tabTextActive: {color: colors.primary, fontFamily: font.semiBold},

  // Group name
  groupNameWrap: {paddingHorizontal: 16, paddingTop: 14},
  groupNameInput: {
    height: 48,
    backgroundColor: colors.bgSecondary,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: font.regular,
    color: colors.textPrimary,
  },

  // Hint
  hint: {
    fontSize: 12,
    color: colors.textTertiary,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    fontFamily: font.medium,
  },

  // Chips
  chipsRow: {paddingHorizontal: 12, paddingVertical: 8, maxHeight: 52},
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  chipText: {fontSize: 13, color: colors.primary, fontFamily: font.medium},

  // Search
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  searchInput: {flex: 1, fontSize: 15, fontFamily: font.regular, color: colors.textPrimary},

  // User items
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userItemSelected: {backgroundColor: colors.primaryLight},
  userItemDisabled: {opacity: 0.35},
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarSelected: {backgroundColor: colors.primary},
  userAvatarText: {fontSize: 16, fontFamily: font.semiBold, color: colors.primary},
  userAvatarTextSelected: {color: '#FFFFFF'},
  userInfo: {flex: 1, marginLeft: 13},
  userName: {fontSize: 15, color: colors.textPrimary, fontFamily: font.medium},
  userPosition: {fontSize: 12, fontFamily: font.regular, color: colors.textSecondary, marginTop: 2},
  separator: {height: 1, backgroundColor: colors.borderLight, marginLeft: 73},
  emptyText: {fontSize: 15, fontFamily: font.regular, color: colors.textTertiary},

  // Create button
  createBtnWrap: {margin: 16},
  createBtn: {
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
  },
  createBtnText: {color: '#FFFFFF', fontSize: 15, fontFamily: font.semiBold},
});
