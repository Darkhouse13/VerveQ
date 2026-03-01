import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { apiConfig } from '../config/api';
import { useTheme } from '../context/ThemeContext';

const ChallengeScreen = ({ navigation }) => {
  const { apiCall, user } = useAuth();
  const { theme } = useTheme();
  
  const [pendingChallenges, setPendingChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [challengeUsername, setChallengeUsername] = useState('');
  const [selectedSport, setSelectedSport] = useState('football');
  const [selectedMode, setSelectedMode] = useState('quiz');
  const [creating, setCreating] = useState(false);

  const sports = ['football', 'tennis'];
  const modes = ['quiz', 'survival'];

  useEffect(() => {
    loadPendingChallenges();
  }, []);

  const loadPendingChallenges = async () => {
    try {
      const response = await apiCall(apiConfig.endpoints.challenges.pending);
      if (response.ok) {
        const data = await response.json();
        setPendingChallenges(data.challenges);
      }
    } catch (error) {
      console.warn('Failed to load challenges:', error);
    } finally {
      setLoading(false);
    }
  };

  const createChallenge = async () => {
    if (!challengeUsername.trim()) {
      Alert.alert('Error', 'Please enter a username to challenge');
      return;
    }

    setCreating(true);
    
    try {
      const response = await apiCall(apiConfig.endpoints.challenges.create, {
        method: 'POST',
        body: JSON.stringify({
          challenged_username: challengeUsername.trim(),
          sport: selectedSport,
          mode: selectedMode
        })
      });

      if (response.ok) {
        const data = await response.json();
        Alert.alert('Success', data.message);
        setChallengeUsername('');
        // Could navigate to game or show further instructions
      } else {
        const error = await response.json();
        Alert.alert('Failed', error.detail || 'Could not create challenge');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error while creating challenge');
    } finally {
      setCreating(false);
    }
  };

  const shareScore = async (score, sport, mode) => {
    try {
      const message = `🏆 I just scored ${score} in ${sport} ${mode} mode on VerveQ! Can you beat my score? 🎯`;
      
      await Share.share({
        message: message,
        title: 'VerveQ Challenge'
      });
    } catch (error) {
      console.warn('Failed to share:', error);
    }
  };

  const acceptChallenge = async (challengeId) => {
    Alert.alert(
      'Accept Challenge',
      'Ready to take on this challenge?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Accept', 
          onPress: () => {
            // Navigate to the appropriate game mode
            // For now, just show success
            Alert.alert('Challenge Accepted!', 'Good luck! 🍀');
          }
        }
      ]
    );
  };

  const declineChallenge = async (challengeId) => {
    Alert.alert(
      'Decline Challenge',
      'Are you sure you want to decline this challenge?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Decline', 
          style: 'destructive',
          onPress: () => {
            // Handle decline logic
            Alert.alert('Challenge Declined', 'Maybe next time! 🤝');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles(theme).container}>
      <ScrollView style={styles(theme).scrollView}>
        <View style={styles(theme).content}>
          {/* Create Challenge Section */}
          <View style={styles(theme).section}>
            <Text style={styles(theme).sectionTitle}>⚡ Create Challenge</Text>
            
            <View style={styles(theme).form}>
              <Text style={styles(theme).label}>Challenge Player:</Text>
              <TextInput
                style={styles(theme).input}
                placeholder="Enter username (e.g., player123)"
                value={challengeUsername}
                onChangeText={setChallengeUsername}
                autoCapitalize="none"
              />

              <Text style={styles(theme).label}>Sport:</Text>
              <View style={styles(theme).optionButtons}>
                {sports.map(sport => (
                  <TouchableOpacity
                    key={sport}
                    style={[
                      styles(theme).optionButton,
                      selectedSport === sport && styles(theme).optionButtonActive
                    ]}
                    onPress={() => setSelectedSport(sport)}
                  >
                    <Text style={[
                      styles(theme).optionButtonText,
                      selectedSport === sport && styles(theme).optionButtonTextActive
                    ]}>
                      {sport === 'football' ? '⚽ Football' : '🎾 Tennis'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles(theme).label}>Mode:</Text>
              <View style={styles(theme).optionButtons}>
                {modes.map(mode => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles(theme).optionButton,
                      selectedMode === mode && styles(theme).optionButtonActive
                    ]}
                    onPress={() => setSelectedMode(mode)}
                  >
                    <Text style={[
                      styles(theme).optionButtonText,
                      selectedMode === mode && styles(theme).optionButtonTextActive
                    ]}>
                      {mode === 'quiz' ? '🧠 Quiz' : '⚡ Survival'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles(theme).createButton, creating && styles(theme).createButtonDisabled]}
                onPress={createChallenge}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={theme.colors.onPrimary} />
                ) : (
                  <Text style={styles(theme).createButtonText}>Send Challenge</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Share Score Section */}
          <View style={styles(theme).section}>
            <Text style={styles(theme).sectionTitle}>📱 Share Your Score</Text>
            <Text style={styles(theme).sectionDescription}>
              Share your best scores to challenge friends on social media
            </Text>
            
            <View style={styles(theme).shareButtons}>
              <TouchableOpacity
                style={styles(theme).shareButton}
                onPress={() => shareScore(25, 'Football', 'Quiz')}
              >
                <Text style={styles(theme).shareButtonText}>📊 Share Quiz Score</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles(theme).shareButton}
                onPress={() => shareScore(15, 'Football', 'Survival')}
              >
                <Text style={styles(theme).shareButtonText}>⚡ Share Survival Score</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Pending Challenges */}
          <View style={styles(theme).section}>
            <Text style={styles(theme).sectionTitle}>📬 Pending Challenges</Text>
            
            {loading ? (
              <ActivityIndicator size="large" color={theme.colors.primary[500]} style={styles(theme).loader} />
            ) : pendingChallenges.length > 0 ? (
              <View style={styles(theme).challengesList}>
                {pendingChallenges.map((challenge, index) => (
                  <View key={challenge.id} style={styles(theme).challengeCard}>
                    <View style={styles(theme).challengeHeader}>
                      <Text style={styles(theme).challengerName}>
                        {challenge.challenger.display_name}
                      </Text>
                      <Text style={styles(theme).challengeTime}>
                        {new Date(challenge.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    
                    <Text style={styles(theme).challengeDetails}>
                      {challenge.sport === 'football' ? '⚽' : '🎾'} {challenge.sport.charAt(0).toUpperCase() + challenge.sport.slice(1)} - {challenge.mode === 'quiz' ? '🧠' : '⚡'} {challenge.mode.charAt(0).toUpperCase() + challenge.mode.slice(1)}
                    </Text>
                    
                    <View style={styles(theme).challengeActions}>
                      <TouchableOpacity
                        style={styles(theme).acceptButton}
                        onPress={() => acceptChallenge(challenge.id)}
                      >
                        <Text style={styles(theme).acceptButtonText}>✅ Accept</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles(theme).declineButton}
                        onPress={() => declineChallenge(challenge.id)}
                      >
                        <Text style={styles(theme).declineButtonText}>❌ Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles(theme).emptyContainer}>
                <Text style={styles(theme).emptyText}>No pending challenges</Text>
                <Text style={styles(theme).emptySubtext}>
                  Challenge friends or wait for them to challenge you!
                </Text>
              </View>
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles(theme).section}>
            <Text style={styles(theme).sectionTitle}>🚀 Quick Actions</Text>
            
            <View style={styles(theme).quickActions}>
              <TouchableOpacity
                style={styles(theme).quickAction}
                onPress={() => navigation.navigate('Leaderboards')}
              >
                <Text style={styles(theme).quickActionIcon}>🏆</Text>
                <Text style={styles(theme).quickActionText}>View Leaderboards</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles(theme).quickAction}
                onPress={() => navigation.navigate('Profile', { userId: user?.id })}
              >
                <Text style={styles(theme).quickActionIcon}>👤</Text>
                <Text style={styles(theme).quickActionText}>My Profile</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles(theme).quickAction}
                onPress={() => navigation.navigate('SportSelection', { mode: 'quiz' })}
              >
                <Text style={styles(theme).quickActionIcon}>🎯</Text>
                <Text style={styles(theme).quickActionText}>Play Quiz</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.mode.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: theme.colors.mode.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.mode.text,
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    color: theme.colors.mode.textSecondary,
    marginBottom: 16,
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.mode.text,
  },
  input: {
    borderWidth: 2,
    borderColor: theme.colors.mode.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.mode.text,
    backgroundColor: theme.colors.mode.surfaceVariant,
  },
  optionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.mode.surfaceVariant,
    borderWidth: 2,
    borderColor: theme.colors.mode.border,
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: theme.colors.primary[500],
    borderColor: theme.colors.primary[500],
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.mode.textSecondary,
  },
  optionButtonTextActive: {
    color: theme.colors.onPrimary,
  },
  createButton: {
    backgroundColor: theme.colors.primary[500],
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: theme.colors.neutral[400],
  },
  createButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  shareButtons: {
    gap: 12,
  },
  shareButton: {
    backgroundColor: theme.colors.secondary.emerald,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  loader: {
    marginVertical: 20,
  },
  challengesList: {
    gap: 12,
  },
  challengeCard: {
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
    borderRadius: 12,
    padding: 16,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  challengerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.mode.text,
  },
  challengeTime: {
    fontSize: 12,
    color: theme.colors.mode.textTertiary,
  },
  challengeDetails: {
    fontSize: 14,
    color: theme.colors.mode.textSecondary,
    marginBottom: 12,
  },
  challengeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: theme.colors.success.dark,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  declineButton: {
    flex: 1,
    backgroundColor: theme.colors.error.light,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  declineButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.mode.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.mode.textTertiary,
    textAlign: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.colors.mode.surfaceVariant,
    borderRadius: 12,
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.mode.text,
    textAlign: 'center',
  },
});

const sports = ['football', 'tennis', 'basketball'];
const modes = ['quiz', 'survival'];

export default ChallengeScreen;
