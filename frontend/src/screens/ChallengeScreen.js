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

const ChallengeScreen = ({ navigation }) => {
  const { apiCall, user } = useAuth();
  
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
      const response = await apiCall('/challenges/pending');
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
      const response = await apiCall('/challenges/create', {
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
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Create Challenge Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚡ Create Challenge</Text>
            
            <View style={styles.form}>
              <Text style={styles.label}>Challenge Player:</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter username (e.g., player123)"
                value={challengeUsername}
                onChangeText={setChallengeUsername}
                autoCapitalize="none"
              />

              <Text style={styles.label}>Sport:</Text>
              <View style={styles.optionButtons}>
                {sports.map(sport => (
                  <TouchableOpacity
                    key={sport}
                    style={[
                      styles.optionButton,
                      selectedSport === sport && styles.optionButtonActive
                    ]}
                    onPress={() => setSelectedSport(sport)}
                  >
                    <Text style={[
                      styles.optionButtonText,
                      selectedSport === sport && styles.optionButtonTextActive
                    ]}>
                      {sport === 'football' ? '⚽ Football' : '🎾 Tennis'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Mode:</Text>
              <View style={styles.optionButtons}>
                {modes.map(mode => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.optionButton,
                      selectedMode === mode && styles.optionButtonActive
                    ]}
                    onPress={() => setSelectedMode(mode)}
                  >
                    <Text style={[
                      styles.optionButtonText,
                      selectedMode === mode && styles.optionButtonTextActive
                    ]}>
                      {mode === 'quiz' ? '🧠 Quiz' : '⚡ Survival'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.createButton, creating && styles.createButtonDisabled]}
                onPress={createChallenge}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.createButtonText}>Send Challenge</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Share Score Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📱 Share Your Score</Text>
            <Text style={styles.sectionDescription}>
              Share your best scores to challenge friends on social media
            </Text>
            
            <View style={styles.shareButtons}>
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => shareScore(25, 'Football', 'Quiz')}
              >
                <Text style={styles.shareButtonText}>📊 Share Quiz Score</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.shareButton}
                onPress={() => shareScore(15, 'Football', 'Survival')}
              >
                <Text style={styles.shareButtonText}>⚡ Share Survival Score</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Pending Challenges */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📬 Pending Challenges</Text>
            
            {loading ? (
              <ActivityIndicator size="large" color="#1a237e" style={styles.loader} />
            ) : pendingChallenges.length > 0 ? (
              <View style={styles.challengesList}>
                {pendingChallenges.map((challenge, index) => (
                  <View key={challenge.id} style={styles.challengeCard}>
                    <View style={styles.challengeHeader}>
                      <Text style={styles.challengerName}>
                        {challenge.challenger.display_name}
                      </Text>
                      <Text style={styles.challengeTime}>
                        {new Date(challenge.created_at).toLocaleDateString()}
                      </Text>
                    </View>
                    
                    <Text style={styles.challengeDetails}>
                      {challenge.sport === 'football' ? '⚽' : '🎾'} {challenge.sport.charAt(0).toUpperCase() + challenge.sport.slice(1)} - {challenge.mode === 'quiz' ? '🧠' : '⚡'} {challenge.mode.charAt(0).toUpperCase() + challenge.mode.slice(1)}
                    </Text>
                    
                    <View style={styles.challengeActions}>
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => acceptChallenge(challenge.id)}
                      >
                        <Text style={styles.acceptButtonText}>✅ Accept</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={styles.declineButton}
                        onPress={() => declineChallenge(challenge.id)}
                      >
                        <Text style={styles.declineButtonText}>❌ Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No pending challenges</Text>
                <Text style={styles.emptySubtext}>
                  Challenge friends or wait for them to challenge you!
                </Text>
              </View>
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🚀 Quick Actions</Text>
            
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => navigation.navigate('Leaderboards')}
              >
                <Text style={styles.quickActionIcon}>🏆</Text>
                <Text style={styles.quickActionText}>View Leaderboards</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => navigation.navigate('Profile', { userId: user?.id })}
              >
                <Text style={styles.quickActionIcon}>👤</Text>
                <Text style={styles.quickActionText}>My Profile</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.quickAction}
                onPress={() => navigation.navigate('SportSelection', { mode: 'quiz' })}
              >
                <Text style={styles.quickActionIcon}>🎯</Text>
                <Text style={styles.quickActionText}>Play Quiz</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
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
    color: '#333',
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  form: {
    gap: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  input: {
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
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
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e9ecef',
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: '#1a237e',
    borderColor: '#1a237e',
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  optionButtonTextActive: {
    color: '#fff',
  },
  createButton: {
    backgroundColor: '#1a237e',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shareButtons: {
    gap: 12,
  },
  shareButton: {
    backgroundColor: '#4ecdc4',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#fff',
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
    borderColor: '#e9ecef',
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
    color: '#333',
  },
  challengeTime: {
    fontSize: 12,
    color: '#888',
  },
  challengeDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  challengeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#dc3545',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#fff',
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
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
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
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
});

export default ChallengeScreen;