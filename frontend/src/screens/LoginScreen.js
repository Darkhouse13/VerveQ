import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [displayNameError, setDisplayNameError] = useState('');

  const displayNameRef = useRef(null);
  const { login } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      displayNameRef.current?.focus?.();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const validateDisplayName = (name) => {
    if (!name.trim()) return 'Display name is required';
    if (name.length < 2) return 'Name must be at least 2 characters';
    if (name.length > 30) return 'Name must be less than 30 characters';
    return '';
  };

  const handleDisplayNameChange = (text) => {
    setDisplayName(text);
    setDisplayNameError('');
  };

  const handleCreateAccount = async () => {
    const error = validateDisplayName(displayName);
    if (error) {
      setDisplayNameError(error);
      return;
    }

    setLoading(true);
    try {
      const result = await login(displayName.trim());
      if (result.success) {
        Alert.alert('Welcome!', `Account created successfully for ${displayName}!`);
      } else {
        Alert.alert('Login Failed', result.error || 'Please check your connection and try again');
      }
    } catch (error) {
      Alert.alert('Connection Error', 'Failed to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    const guestName = `Guest${Math.floor(Math.random() * 10000)}`;
    setLoading(true);
    try {
      const result = await login(guestName);
      if (result.success) {
        // Success handled by AuthContext
      } else {
        Alert.alert('Login Failed', result.error || 'Failed to create guest session');
      }
    } catch (error) {
      Alert.alert('Connection Error', 'Failed to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickStart = async () => {
    const randomNames = ['Phoenix', 'Thunder', 'Blaze', 'Storm', 'Ace', 'Nova'];
    const randomName = `${randomNames[Math.floor(Math.random() * randomNames.length)]}${Math.floor(Math.random() * 999)}`;
    
    setLoading(true);
    try {
      const result = await login(randomName);
      if (!result.success) {
        Alert.alert('Login Failed', result.error || 'Failed to create quick start session');
      }
    } catch (error) {
      Alert.alert('Connection Error', 'Failed to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {/* Logo and Branding */}
            <View style={styles.logoSection}>
              <View style={styles.logo}>
                <Text style={styles.logoText}>VQ</Text>
              </View>
              <Text style={styles.appTitle}>VerveQ Sports</Text>
              <Text style={styles.appSubtitle}>Compete in sports trivia worldwide</Text>
            </View>

            {/* Main Form */}
            <View style={styles.formSection}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Display Name</Text>
                <TextInput
                  ref={displayNameRef}
                  style={[
                    styles.inputField,
                    displayNameError ? styles.inputError : null
                  ]}
                  placeholder="Enter your name"
                  value={displayName}
                  onChangeText={handleDisplayNameChange}
                  maxLength={30}
                  autoCorrect={false}
                  autoCapitalize="words"
                  editable={!loading}
                />
                {displayNameError ? (
                  <Text style={styles.errorText}>{displayNameError}</Text>
                ) : null}
              </View>

              <View style={styles.buttonGroup}>
                <TouchableOpacity
                  style={[
                    styles.btn,
                    styles.btnPrimary,
                    loading ? styles.btnDisabled : null
                  ]}
                  onPress={handleCreateAccount}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.btnText, styles.btnPrimaryText]}>
                    {loading ? 'Creating Account...' : 'Create Account & Play'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.btn,
                    styles.btnSecondary,
                    loading ? styles.btnDisabled : null
                  ]}
                  onPress={handleGuestLogin}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.btnText, styles.btnSecondaryText]}>
                    Play as Guest
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Quick Action */}
            <View style={styles.quickAction}>
              <TouchableOpacity
                onPress={handleQuickStart}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.linkButton,
                  loading ? styles.linkButtonDisabled : null
                ]}>
                  Quick Start with Random Name →
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  content: {
    paddingHorizontal: 20,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 60,
    height: 60,
    backgroundColor: '#1A237E',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A237E',
    marginBottom: 8,
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '400',
    textAlign: 'center',
  },
  formSection: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  inputField: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    color: '#333333',
  },
  inputError: {
    borderColor: '#EF4444',
    backgroundColor: '#FFFFFF',
  },
  errorText: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 4,
  },
  buttonGroup: {
    marginBottom: 24,
  },
  btn: {
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: '#1A237E',
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#1A237E',
    marginTop: 12,
  },
  btnDisabled: {
    backgroundColor: '#CCCCCC',
    borderColor: '#CCCCCC',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  btnPrimaryText: {
    color: '#FFFFFF',
  },
  btnSecondaryText: {
    color: '#1A237E',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    color: '#9CA3AF',
    fontSize: 14,
  },
  quickAction: {
    alignItems: 'center',
  },
  linkButton: {
    color: '#1A237E',
    fontSize: 14,
    fontWeight: '500',
  },
  linkButtonDisabled: {
    color: '#9CA3AF',
  },
});

export default LoginScreen;