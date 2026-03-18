import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {launchImageLibrary} from 'react-native-image-picker';
import {User, Lock, Camera, LogOut, Save, Eye, EyeOff} from 'lucide-react-native';
import {useAuth} from '../../store/authStore';
import {auth as authApi, media as mediaApi} from '../../services/api';
import avatarUrl from '../../utils/avatarUrl';
import {colors, radius, font} from '../../theme';

export default function SettingsScreen() {
  const {user, refreshUser, logout} = useAuth();

  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const userAvatarUrl = avatarUrl(user?.avatar);

  const initials = (name) =>
    (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const handlePickAvatar = () => {
    launchImageLibrary({mediaType: 'photo', selectionLimit: 1, includeBase64: false}, async res => {
      if (res.didCancel || res.errorCode) return;
      const asset = res.assets?.[0];
      if (!asset) return;

      if (asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Ошибка', 'Максимальный размер файла 5MB');
        return;
      }

      setUploadingAvatar(true);
      try {
        const uploadRes = await mediaApi.upload({
          uri: asset.uri,
          type: asset.type || 'image/jpeg',
          name: asset.fileName || 'avatar.jpg',
        });
        await authApi.updateProfile({avatar: uploadRes.data.path});
        await refreshUser();
        Alert.alert('Готово', 'Фото профиля обновлено');
      } catch {
        Alert.alert('Ошибка', 'Не удалось загрузить фото');
      } finally {
        setUploadingAvatar(false);
      }
    });
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await authApi.updateProfile({displayName: displayName.trim(), email: email.trim()});
      await refreshUser();
      Alert.alert('Готово', 'Профиль обновлён');
    } catch (e) {
      Alert.alert('Ошибка', e.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Ошибка', 'Пароль должен быть минимум 6 символов');
      return;
    }
    setSaving(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      Alert.alert('Готово', 'Пароль изменён');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      Alert.alert('Ошибка', e.response?.data?.error || 'Неверный текущий пароль');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Выйти из аккаунта?', '', [
      {text: 'Отмена', style: 'cancel'},
      {text: 'Выйти', style: 'destructive', onPress: logout},
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity style={styles.avatarWrap} onPress={handlePickAvatar} disabled={uploadingAvatar}>
          {uploadingAvatar ? (
            <View style={styles.avatarCircle}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : userAvatarUrl ? (
            <Image source={{uri: userAvatarUrl}} style={styles.avatarCircle} />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>{initials(user?.displayName || user?.username)}</Text>
            </View>
          )}
          <View style={styles.cameraBadge}>
            <Camera size={14} color="#FFF" />
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarName}>{user?.displayName || user?.username}</Text>
        <Text style={styles.avatarUsername}>@{user?.username}</Text>
        {(user?.isAdmin || user?.roles?.length > 0 || user?.role) && (
          <Text style={styles.avatarRole}>
            {user?.isAdmin ? 'Администратор' : (
              user?.roles?.length > 0
                ? user.roles.map(r => r.name).join(', ')
                : user?.role?.name || 'Пользователь'
            )}
          </Text>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
          onPress={() => setActiveTab('profile')}>
          <User size={16} color={activeTab === 'profile' ? colors.primary : colors.textSecondary} style={{marginRight: 6}} />
          <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>Профиль</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'security' && styles.tabActive]}
          onPress={() => setActiveTab('security')}>
          <Lock size={16} color={activeTab === 'security' ? colors.primary : colors.textSecondary} style={{marginRight: 6}} />
          <Text style={[styles.tabText, activeTab === 'security' && styles.tabTextActive]}>Безопасность</Text>
        </TouchableOpacity>
      </View>

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <View style={styles.card}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Отображаемое имя</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Ваше имя"
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="email@example.com"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <TouchableOpacity onPress={handleSaveProfile} disabled={saving} activeOpacity={0.85}>
            <LinearGradient
              colors={saving ? ['#93C5FD', '#93C5FD'] : [colors.primary, colors.secondary]}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={styles.saveBtn}>
              {saving
                ? <ActivityIndicator color="#FFF" />
                : <>
                    <Save size={16} color="#FFF" style={{marginRight: 8}} />
                    <Text style={styles.saveBtnText}>Сохранить</Text>
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Security tab */}
      {activeTab === 'security' && (
        <View style={styles.card}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Текущий пароль</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrent}
                placeholderTextColor={colors.textTertiary}
                placeholder="••••••"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowCurrent(v => !v)}>
                {showCurrent ? <EyeOff size={18} color={colors.textSecondary} /> : <Eye size={18} color={colors.textSecondary} />}
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Новый пароль</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNew}
                placeholderTextColor={colors.textTertiary}
                placeholder="••••••"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNew(v => !v)}>
                {showNew ? <EyeOff size={18} color={colors.textSecondary} /> : <Eye size={18} color={colors.textSecondary} />}
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Подтвердите пароль</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                placeholderTextColor={colors.textTertiary}
                placeholder="••••••"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(v => !v)}>
                {showConfirm ? <EyeOff size={18} color={colors.textSecondary} /> : <Eye size={18} color={colors.textSecondary} />}
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity onPress={handleChangePassword} disabled={saving} activeOpacity={0.85}>
            <LinearGradient
              colors={saving ? ['#93C5FD', '#93C5FD'] : [colors.primary, colors.secondary]}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={styles.saveBtn}>
              {saving
                ? <ActivityIndicator color="#FFF" />
                : <>
                    <Lock size={16} color="#FFF" style={{marginRight: 8}} />
                    <Text style={styles.saveBtnText}>Изменить пароль</Text>
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <LogOut size={18} color={colors.error} style={{marginRight: 10}} />
        <Text style={styles.logoutText}>Выйти из аккаунта</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.bgSecondary},
  content: {paddingBottom: 40},

  avatarSection: {alignItems: 'center', paddingVertical: 28, backgroundColor: colors.bgPrimary},
  avatarWrap: {marginBottom: 12, position: 'relative'},
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  avatarInitials: {fontSize: 32, fontFamily: font.bold, color: colors.primary},
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.bgPrimary,
  },
  avatarName: {fontSize: 18, fontFamily: font.semiBold, color: colors.textPrimary},
  avatarUsername: {fontSize: 13, fontFamily: font.regular, color: colors.textSecondary, marginTop: 2},
  avatarRole: {
    fontSize: 12, fontFamily: font.medium, color: colors.primary,
    marginTop: 4, backgroundColor: colors.primaryLight,
    paddingHorizontal: 12, paddingVertical: 3, borderRadius: 12,
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.bgPrimary,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    marginTop: 12,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: {borderBottomColor: colors.primary},
  tabText: {fontSize: 14, fontFamily: font.medium, color: colors.textSecondary},
  tabTextActive: {color: colors.primary, fontFamily: font.semiBold},

  card: {
    backgroundColor: colors.bgPrimary, marginTop: 12,
    paddingHorizontal: 20, paddingVertical: 20,
  },
  formGroup: {marginBottom: 16},
  label: {fontSize: 13, fontFamily: font.medium, color: colors.textSecondary, marginBottom: 7},
  input: {
    height: 48, backgroundColor: colors.bgSecondary,
    borderWidth: 1.5, borderColor: colors.border,
    borderRadius: radius.lg, paddingHorizontal: 14,
    fontSize: 15, fontFamily: font.regular, color: colors.textPrimary,
  },
  passwordWrap: {
    flexDirection: 'row', alignItems: 'center',
    height: 48, backgroundColor: colors.bgSecondary,
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.lg,
  },
  passwordInput: {flex: 1, paddingHorizontal: 14, fontSize: 15, fontFamily: font.regular, color: colors.textPrimary},
  eyeBtn: {paddingHorizontal: 12},

  saveBtn: {
    height: 48, borderRadius: radius.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnText: {color: '#FFF', fontSize: 15, fontFamily: font.semiBold},

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 20, marginHorizontal: 20,
    backgroundColor: colors.bgPrimary, borderRadius: radius.lg,
    paddingVertical: 15, borderWidth: 1, borderColor: '#FECACA',
  },
  logoutText: {fontSize: 15, fontFamily: font.medium, color: colors.error},
});
