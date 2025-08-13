import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Keyboard,
} from 'react-native';
import { apiConfig, buildUrl, logApiCall, logApiResponse } from '../config/api';

const SurvivalScreen = ({ navigation, route }) => {
  const { sport } = route.params || { sport: 'football' };
  const [currentInitials, setCurrentInitials] = useState('');
  const [guess, setGuess] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [hintPlayers, setHintPlayers] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  
  // Component mount tracking
  const isMountedRef = useRef(true);

  useEffect(() => {
    let mounted = true;
    isMountedRef.current = true;
    
    const initializeSurvival = async () => {
      if (mounted && isMountedRef.current) {
        await loadNewChallenge();
      }
    };
    
    initializeSurvival();
    
    return () => {
      mounted = false;
      isMountedRef.current = false;
    };
  }, [sport]);

  const loadNewChallenge = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    const abortController = new AbortController();
    
    try {
      setLoading(true);
      setGuess('');
      setShowHint(false);
      setHintPlayers([]);
      setLastResult(null);
      
      const url = buildUrl(apiConfig.endpoints.games.survival.initials(sport));
      logApiCall('GET', url);
      
      const response = await fetch(url, {
        signal: abortController.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validate response
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid challenge response');
      }
      
      if (!data.initials || typeof data.initials !== 'string') {
        throw new Error('Invalid challenge response: missing initials');
      }
      
      if (isMountedRef.current) {
        logApiResponse('GET', url, data);
        setCurrentInitials(data.initials);
      }
    } catch (error) {
      if (isMountedRef.current && error.name !== 'AbortError') {
        console.error('Survival challenge loading error:', error);
        logApiResponse('GET', buildUrl(apiConfig.endpoints.games.survival.initials(sport)), null, error);
        Alert.alert('Error', 'Failed to load challenge. Please try again.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
      abortController.abort();
    }
  }, [sport]);

  const submitGuess = async () => {
    if (!guess.trim()) {
      Alert.alert('Error', 'Please enter a player name');
      return;
    }

    try {
      setSubmitting(true);
      Keyboard.dismiss();
      
      const url = buildUrl(apiConfig.endpoints.games.survival.guess(sport));
      const requestData = {
        initials: currentInitials,
        guess: guess.trim(),
      };
      
      logApiCall('POST', url, requestData);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: apiConfig.headers,
        body: JSON.stringify(requestData),
      });

      const result = await response.json();
      
      logApiResponse('POST', url, result);
      setLastResult(result);
      
      if (result.correct) {
        setScore(prev => prev + 1);
        const timeoutId = setTimeout(() => {
          if (isMountedRef.current) {
            try {
              loadNewChallenge();
            } catch (error) {
              console.error('Load challenge error:', error);
              Alert.alert('Error', 'Failed to load next challenge.');
            }
          }
        }, 2000);
        
        // Store timeout for cleanup
        return () => clearTimeout(timeoutId);
      } else {
        const newLives = lives - 1;
        setLives(newLives);
        
        if (newLives <= 0) {
          const timeoutId = setTimeout(() => {
            if (isMountedRef.current) {
              try {
                navigation.navigate('Result', {
                  score,
                  total: score,
                  mode: 'survival',
                  sport,
                  lives: 0
                });
              } catch (error) {
                console.error('Navigation error:', error);
                Alert.alert('Error', 'Navigation failed. Please try again.');
              }
            }
          }, 2000);
          
          // Store timeout for cleanup
          return () => clearTimeout(timeoutId);
        }
      }
    } catch (error) {
      logApiResponse('POST', buildUrl(apiConfig.endpoints.games.survival.guess(sport)), null, error);
      Alert.alert('Error', 'Failed to submit guess. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const showHintFunction = async () => {
    try {
      const url = buildUrl(apiConfig.endpoints.games.survival.reveal(sport, currentInitials));
      logApiCall('GET', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      logApiResponse('GET', url, data);
      setHintPlayers(data.sample_players);
      setShowHint(true);
    } catch (error) {
      logApiResponse('GET', buildUrl(apiConfig.endpoints.games.survival.reveal(sport, currentInitials)), null, error);
      Alert.alert('Error', 'Failed to load hint.');
    }
  };

  const skipChallenge = useCallback(() => {
    if (!isMountedRef.current) return;
    
    const newLives = lives - 1;
    setLives(newLives);
    
    if (newLives <= 0) {
      try {
        navigation.navigate('Result', {
          score,
          total: score,
          mode: 'survival',
          sport,
          lives: 0
        });
      } catch (error) {
        console.error('Skip navigation error:', error);
        Alert.alert('Error', 'Navigation failed. Please try again.');
      }
    } else {
      try {
        loadNewChallenge();
      } catch (error) {
        console.error('Skip load challenge error:', error);
        Alert.alert('Error', 'Failed to load next challenge.');
      }
    }
  }, [lives, score, sport, navigation, loadNewChallenge]);

  const getLivesDisplay = () => {
    return '❤️'.repeat(lives) + '🤍'.repeat(3 - lives);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#ff9800" />
          <Text style={styles.loadingText}>Loading challenge...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.livesText}>{getLivesDisplay()}</Text>
          <Text style={styles.scoreText}>Score: {score}</Text>
        </View>

        <View style={styles.challengeContainer}>
          <Text style={styles.challengeTitle}>Find a player with initials:</Text>
          <Text style={styles.initials}>{currentInitials}</Text>
          
          {lastResult && (
            <View style={styles.resultContainer}>
              <Text style={[
                styles.resultText,
                { color: lastResult.correct ? '#4caf50' : '#f44336' }
              ]}>
                {lastResult.correct ? '✅ Correct!' : '❌ Wrong!'}
              </Text>
              <Text style={styles.resultMessage}>{lastResult.message}</Text>
              {lastResult.matches && lastResult.matches.length > 0 && (
                <Text style={styles.matchText}>
                  Matches: {lastResult.matches.join(', ')}
                </Text>
              )}
            </View>
          )}

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter player name..."
              value={guess}
              onChangeText={setGuess}
              autoCorrect={false}
              autoCapitalize="words"
              returnKeyType="done"
              onSubmitEditing={submitGuess}
            />
          </View>

          {showHint && (
            <View style={styles.hintContainer}>
              <Text style={styles.hintTitle}>Hint - Some players with {currentInitials}:</Text>
              {hintPlayers.map((player, index) => (
                <Text key={index} style={styles.hintPlayer}>• {player}</Text>
              ))}
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (submitting || !guess.trim()) && styles.disabledButton
              ]}
              onPress={submitGuess}
              disabled={submitting || !guess.trim()}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Checking...' : 'Submit Guess'}
              </Text>
            </TouchableOpacity>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.hintButton}
                onPress={showHintFunction}
                disabled={showHint}
              >
                <Text style={styles.hintButtonText}>
                  {showHint ? 'Hint Shown' : 'Show Hint'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.skipButton}
                onPress={skipChallenge}
              >
                <Text style={styles.skipButtonText}>Skip (-1 ❤️)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Guess any football player with these initials to continue!
          </Text>
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  livesText: {
    fontSize: 20,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff9800',
  },
  challengeContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  challengeTitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  initials: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ff9800',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 8,
  },
  resultContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
  },
  resultText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  resultMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  matchText: {
    fontSize: 14,
    color: '#4caf50',
    marginTop: 5,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 2,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    backgroundColor: '#fff',
  },
  hintContainer: {
    backgroundColor: '#fff3cd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  hintTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 10,
  },
  hintPlayer: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 5,
  },
  buttonContainer: {
    gap: 15,
  },
  submitButton: {
    backgroundColor: '#ff9800',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  hintButton: {
    flex: 1,
    backgroundColor: '#17a2b8',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  hintButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  skipButton: {
    flex: 1,
    backgroundColor: '#6c757d',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default SurvivalScreen;