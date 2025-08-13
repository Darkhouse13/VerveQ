import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const LoginScreen = ({ navigation }) => {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(true);

  const { login } = useAuth();

  const handleLogin = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter a display name');
      return;
    }

    if (!isAnonymous && email.trim() && !isValidEmail(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    
    try {
      const result = await login(
        displayName.trim(),
        isAnonymous ? null : email.trim() || null
      );

      if (result.success) {
        const action = isAnonymous ? 'Logged in as guest!' : 
                      email.trim() ? 'Account created/logged in successfully!' : 'Account created successfully!';
        Alert.alert('Success', action);
      } else {
        Alert.alert('Login Failed', result.error || 'Please check your connection and try again');
      }
    } catch (error) {
      Alert.alert('Connection Error', 'Failed to connect to server. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const isValidEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  const handleGuestLogin = async () => {
    const guestName = `Guest${Math.floor(Math.random() * 10000)}`;
    setDisplayName(guestName);
    setIsAnonymous(true);
    
    setLoading(true);
    try {
      const result = await login(guestName);
      if (result.success) {
        Alert.alert('Success', `Welcome ${guestName}! You're now logged in as a guest.`);
      } else {
        Alert.alert('Login Failed', result.error || 'Failed to create guest session');
      }
    } catch (error) {
      Alert.alert('Connection Error', 'Failed to connect to server. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>🏆 VerveQ Sports</Text>
          <Text style={styles.subtitle}>Join the global competition!</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Display Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your display name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            maxLength={30}
          />

          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, isAnonymous && styles.toggleActive]}
              onPress={() => setIsAnonymous(true)}
            >
              <Text style={[styles.toggleText, isAnonymous && styles.toggleTextActive]}>
                Play as Guest
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.toggleButton, !isAnonymous && styles.toggleActive]}
              onPress={() => setIsAnonymous(false)}
            >
              <Text style={[styles.toggleText, !isAnonymous && styles.toggleTextActive]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {!isAnonymous && (
            <View style={styles.emailContainer}>
              <Text style={styles.label}>Email (optional)</Text>
              <TextInput
                style={[
                  styles.input,
                  email.trim() && !isValidEmail(email.trim()) ? styles.inputError : null
                ]}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {email.trim() && !isValidEmail(email.trim()) && (
                <Text style={styles.errorText}>
                  Please enter a valid email address
                </Text>
              )}
              <Text style={styles.helpText}>
                Email helps recover your account and connect with friends
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>
                {isAnonymous ? 'Play as Guest' : 'Create Account & Play'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickButton}
            onPress={handleGuestLogin}
            disabled={loading}
          >
            <Text style={styles.quickButtonText}>Quick Start (Random Name)</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.features}>
          <Text style={styles.featuresTitle}>Platform Features:</Text>
          <View style={styles.featuresList}>
            <Text style={styles.feature}>🎯 ELO Rating System</Text>
            <Text style={styles.feature}>🏅 Global Leaderboards</Text>
            <Text style={styles.feature}>⚡ Friend Challenges</Text>
            <Text style={styles.feature}>🏆 Achievements</Text>
            <Text style={styles.feature}>📊 Detailed Analytics</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a237e',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleActive: {
    backgroundColor: '#1a237e',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  toggleTextActive: {
    color: '#fff',
  },
  emailContainer: {
    marginTop: 8,
  },
  helpText: {
    fontSize: 12,
    color: '#888',
    marginTop: -8,
    marginBottom: 16,
  },
  inputError: {
    borderColor: '#dc3545',
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12,
    color: '#dc3545',
    marginTop: -12,
    marginBottom: 8,
  },
  loginButton: {
    backgroundColor: '#1a237e',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  quickButton: {
    backgroundColor: '#6c757d',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  features: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  featuresList: {
    gap: 8,
  },
  feature: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default LoginScreen;