import React, {useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import * as Keychain from 'react-native-keychain';
import {auth as authApi} from '../../services/api';
import SocketService from '../../services/socket';
import {useAuth} from '../../store/authStore';

const KEYCHAIN_OPTIONS = {service: 'alfa-wiki'};

export default function LoginScreen() {
  const {initialize} = useAuth();
  const [step, setStep] = useState('credentials'); // 'credentials' | 'twoFactor'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [twoFactorCode, setTwoFactorCode] = useState(['', '', '', '', '', '']);
  const [userId, setUserId] = useState(null);
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [codeStatus, setCodeStatus] = useState(''); // '' | 'error'
  const inputRefs = useRef([]);

  // ── Step 1: credentials ──────────────────────────────────────────────────
  const handleCredentialsSubmit = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Ошибка', 'Введите логин и пароль');
      return;
    }
    setLoading(true);
    try {
      const {data} = await authApi.login(username.trim(), password);

      if (data.requiresTwoFactor) {
        setUserId(data.userId);
        setStep('twoFactor');
        Alert.alert('Код отправлен', data.message || 'Код отправлен на вашу почту');
      } else if (data.token && data.user) {
        await finishLogin(data.token, data.user);
      } else {
        Alert.alert('Ошибка', 'Неожиданный ответ сервера');
      }
    } catch (error) {
      Alert.alert('Ошибка входа', error.response?.data?.error || 'Проверьте логин и пароль');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: 2FA verification ─────────────────────────────────────────────
  const handleTwoFactorSubmit = useCallback(
    async code => {
      if (code.length !== 6) return;
      setLoading(true);
      try {
        const {data} = await authApi.verify2FA(userId, code);
        if (data.token && data.user) {
          await finishLogin(data.token, data.user);
        }
      } catch (error) {
        const errorData = error.response?.data;
        setCodeStatus('error');
        setTimeout(() => {
          setTwoFactorCode(['', '', '', '', '', '']);
          setCodeStatus('');
          inputRefs.current[0]?.focus();
        }, 600);

        if (errorData?.attemptsLeft !== undefined) {
          setAttemptsLeft(errorData.attemptsLeft);
          Alert.alert('Неверный код', `Осталось попыток: ${errorData.attemptsLeft}`);
        } else {
          Alert.alert('Ошибка', errorData?.error || 'Неверный код');
        }

        if (
          errorData?.error?.includes('expired') ||
          errorData?.error?.includes('Too many') ||
          errorData?.error?.includes('Слишком')
        ) {
          setTimeout(() => {
            setStep('credentials');
            setTwoFactorCode(['', '', '', '', '', '']);
            setUserId(null);
            setPassword('');
          }, 800);
        }
      } finally {
        setLoading(false);
      }
    },
    [userId],
  );

  const handleResendCode = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      await authApi.resend2FA(userId);
      Alert.alert('Готово', 'Новый код отправлен на вашу почту');
      setTwoFactorCode(['', '', '', '', '', '']);
      setCodeStatus('');
      setAttemptsLeft(5);
      inputRefs.current[0]?.focus();
    } catch {
      Alert.alert('Ошибка', 'Не удалось отправить код');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setStep('credentials');
    setTwoFactorCode(['', '', '', '', '', '']);
    setCodeStatus('');
    setUserId(null);
    setAttemptsLeft(5);
  };

  // ── Code input handlers ──────────────────────────────────────────────────
  const handleCodeChange = (index, value) => {
    if (loading || codeStatus) return;
    const digit = value.replace(/\D/g, '').slice(-1);
    const newCode = [...twoFactorCode];
    newCode[index] = digit;
    setTwoFactorCode(newCode);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 filled
    if (digit && index === 5) {
      const full = newCode.join('');
      if (full.length === 6) handleTwoFactorSubmit(full);
    }
    if (digit && index < 5) {
      const full = newCode.join('');
      if (full.length === 6 && !full.includes('')) handleTwoFactorSubmit(full);
    }
  };

  const handleCodeKeyDown = (index, e) => {
    if (loading || codeStatus) return;
    if (e.nativeEvent.key === 'Backspace') {
      const newCode = [...twoFactorCode];
      if (twoFactorCode[index]) {
        newCode[index] = '';
        setTwoFactorCode(newCode);
      } else if (index > 0) {
        newCode[index - 1] = '';
        setTwoFactorCode(newCode);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  // ── Finalize login ───────────────────────────────────────────────────────
  const finishLogin = async (token, userData) => {
    await Keychain.setGenericPassword('token', token, KEYCHAIN_OPTIONS);
    await SocketService.connect(userData.id);
    await initialize(); // triggers conditional navigator to switch to AppStack
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>alfa-wiki</Text>

          {step === 'credentials' ? (
            <>
              <Text style={styles.subtitle}>Войдите в систему</Text>

              <TextInput
                style={styles.input}
                placeholder="Логин"
                placeholderTextColor="#9CA3AF"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />

              <View style={styles.passwordWrap}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Пароль"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleCredentialsSubmit}
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(v => !v)}>
                  <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleCredentialsSubmit}
                disabled={loading}>
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Войти</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.shieldIcon}>
                <Text style={styles.shieldEmoji}>🛡️</Text>
              </View>
              <Text style={styles.subtitle}>Двухфакторная аутентификация</Text>
              <Text style={styles.tfaHint}>
                Введите 6-значный код, отправленный на вашу почту
              </Text>

              <View style={styles.codeRow}>
                {twoFactorCode.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={el => (inputRefs.current[index] = el)}
                    style={[
                      styles.codeInput,
                      digit ? styles.codeInputFilled : null,
                      codeStatus === 'error' ? styles.codeInputError : null,
                    ]}
                    value={digit}
                    onChangeText={v => handleCodeChange(index, v)}
                    onKeyPress={e => handleCodeKeyDown(index, e)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    editable={!loading && !codeStatus}
                  />
                ))}
              </View>

              {attemptsLeft < 5 && (
                <Text style={styles.attemptsText}>
                  Осталось попыток: {attemptsLeft}
                </Text>
              )}

              <TouchableOpacity
                style={styles.resendBtn}
                onPress={handleResendCode}
                disabled={loading}>
                <Text style={styles.resendText}>Отправить код повторно</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backBtn}
                onPress={handleBackToLogin}
                disabled={loading}>
                <Text style={styles.backText}>← Вернуться к входу</Text>
              </TouchableOpacity>

              {loading && (
                <ActivityIndicator
                  color="#2563EB"
                  style={{marginTop: 16}}
                />
              )}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F3F4F6'},
  scroll: {flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40},
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2563EB',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#111827',
    marginBottom: 14,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    marginBottom: 14,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 15,
    color: '#111827',
  },
  eyeBtn: {paddingHorizontal: 14},
  eyeText: {fontSize: 18},
  button: {
    backgroundColor: '#2563EB',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: {backgroundColor: '#93C5FD'},
  buttonText: {color: '#FFFFFF', fontSize: 16, fontWeight: '600'},
  // 2FA
  shieldIcon: {alignItems: 'center', marginBottom: 8},
  shieldEmoji: {fontSize: 40},
  tfaHint: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  codeInput: {
    width: 44,
    height: 54,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  codeInputFilled: {borderColor: '#2563EB', backgroundColor: '#EFF6FF'},
  codeInputError: {borderColor: '#EF4444', backgroundColor: '#FEF2F2'},
  attemptsText: {
    textAlign: 'center',
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 12,
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 4,
  },
  resendText: {color: '#2563EB', fontSize: 14, fontWeight: '500'},
  backBtn: {alignItems: 'center', paddingVertical: 10},
  backText: {color: '#6B7280', fontSize: 14},
});
