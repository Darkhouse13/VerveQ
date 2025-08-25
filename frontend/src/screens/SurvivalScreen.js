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
  Platform,
} from 'react-native';
import { apiConfig, buildUrl, logApiCall, logApiResponse } from '../config/api';
import { useAuth } from '../context/AuthContext';
import { isDevelopment } from '../utils/environment';

const SurvivalScreen = ({ navigation, route }) => {
  const { sport, reset, difficulty = 'intermediate' } = route.params || { sport: 'football', reset: false, difficulty: 'intermediate' };
  const { user } = useAuth();
  const [currentInitials, setCurrentInitials] = useState('');
  const [guess, setGuess] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [hintPlayers, setHintPlayers] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [hintUsedForGame, setHintUsedForGame] = useState(false);
  
  // Component mount tracking
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef(null);
  const navigationTimeoutRef = useRef(null);
  const nextChallengeTimeoutRef = useRef(null);

  const startNewGame = useCallback(async () => {
    console.log('Starting new survival game for sport:', sport);
    if (!isMountedRef.current) return;
    
    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new controller for this request
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      setSessionId(null);  // Clear any existing session
      setGuess('');
      setShowHint(false);
      setHintPlayers([]);
      setLastResult(null);
      setHintUsedForGame(false); // Reset hint for new game
      
      const url = buildUrl(apiConfig.endpoints.games.survival.start);
      const requestData = { sport: sport };
      
      console.log('🌐 Starting new survival session:', { sport, url });
      logApiCall('POST', url, requestData);
      
      // Set up timeout for the fetch request
      const timeoutId = setTimeout(() => {
        abortControllerRef.current.abort();
      }, 10000);

      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: apiConfig.headers,
          body: JSON.stringify(requestData),
          signal: abortControllerRef.current.signal
        });
        clearTimeout(timeoutId); // Clear timeout on successful response
      } catch (error) {
        clearTimeout(timeoutId); // Ensure cleanup on error
        throw error;
      }
      
      console.log(`📡 Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error response');
        throw new Error(`HTTP ${response.status}: ${response.statusText}${errorBody ? '\nDetails: ' + errorBody : ''}`);
      }
      
      const data = await response.json();
      
      // Validate response
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid game start response');
      }
      
      if (!data.session_id || !data.challenge?.initials) {
        throw new Error('Invalid game start response: missing session_id or challenge');
      }
      
      if (isMountedRef.current) {
        logApiResponse('POST', url, data);
        setSessionId(data.session_id);
        setCurrentInitials(data.challenge.initials);
        setLives(data.lives);
        setScore(data.score);
        setHintUsedForGame(!data.hint_available); // Set based on server response
        console.log('✅ New game started:', {
          sessionId: data.session_id,
          initials: data.challenge.initials,
          hintAvailable: data.hint_available
        });
      }
      
    } catch (error) {
      if (isMountedRef.current && error.name !== 'AbortError') {
        console.error('🚨 Game start error:', error);
        
        // Try to fall back to using legacy endpoints but still create a pseudo-session
        try {
          console.log('🔧 Attempting fallback to legacy initials endpoint');
          const legacyUrl = buildUrl(apiConfig.endpoints.games.survival.initials(sport));
          
          const legacyResponse = await fetch(legacyUrl, {
            method: 'GET',
            headers: apiConfig.headers,
            signal: abortControllerRef.current.signal,
          });
          
          if (legacyResponse.ok) {
            const legacyData = await legacyResponse.json();
            if (legacyData.initials) {
              setCurrentInitials(legacyData.initials);
              setLives(3);
              setScore(0);
              setHintUsedForGame(false);
              // Create a pseudo session ID for tracking
              setSessionId(`legacy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
              console.log('✅ Fallback game started with legacy initials:', legacyData.initials);
              return;
            }
          }
        } catch (legacyError) {
          console.error('🚨 Legacy fallback also failed:', legacyError);
        }
        
        // Final fallback to mock data in development
        if (isDevelopment()) {
          console.log('🔧 Using mock data as final fallback');
          const mockInitials = ['CR', 'LM', 'KM', 'VV', 'KD'];
          const selected = mockInitials[Math.floor(Math.random() * mockInitials.length)];
          setCurrentInitials(selected);
          setLives(3);
          setScore(0);
          setHintUsedForGame(false);
          setSessionId(`mock-${Date.now()}`);
          console.log('✅ Mock game started with:', selected);
        } else {
          Alert.alert('Connection Error', 'Failed to start new game. Please check your connection and try again.');
        }
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [sport]);

  useEffect(() => {
    let mounted = true;
    isMountedRef.current = true;
    
    const initializeSurvival = async () => {
      if (mounted && isMountedRef.current) {
        // Clear any existing session if reset is true
        if (reset) {
          setSessionId(null);
        }
        setGameStartTime(Date.now());
        await startNewGame();
      }
    };
    
    initializeSurvival();
    
    return () => {
      mounted = false;
      isMountedRef.current = false;
      // Cancel any pending request when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Clear any pending timeouts
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }
      if (nextChallengeTimeoutRef.current) {
        clearTimeout(nextChallengeTimeoutRef.current);
        nextChallengeTimeoutRef.current = null;
      }
    };
  }, [sport, reset, startNewGame]);

  const submitSurvivalResult = useCallback(async () => {
    try {
      const duration = gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0;
      
      const resultData = {
        user_id: user?.id || `guest_${Date.now()}`,
        score: score,
        duration_seconds: duration
      };
      
      const url = buildUrl(apiConfig.endpoints.games.survival.complete(sport));
      logApiCall('POST', url, resultData);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: apiConfig.headers,
        body: JSON.stringify(resultData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      logApiResponse('POST', url, result);
      
      return result;
    } catch (error) {
      console.error('Failed to submit survival result:', error);
      logApiResponse('POST', buildUrl(apiConfig.endpoints.games.survival.complete(sport)), null, error);
      throw error;
    }
  }, [user, score, gameStartTime, sport]);

  const submitGuess = async () => {
    if (!guess.trim()) {
      Alert.alert('Error', 'Please enter a player name');
      return;
    }

    try {
      setSubmitting(true);
      Keyboard.dismiss();
      
      let url, requestData;
      
      // Use session-based endpoint if we have a real session ID (not pseudo)
      if (sessionId && !sessionId.startsWith('legacy-') && !sessionId.startsWith('mock-')) {
        url = buildUrl(apiConfig.endpoints.games.survival.sessionGuess);
        requestData = {
          session_id: sessionId,
          guess: guess.trim(),
        };
      } else {
        // Use legacy endpoint (includes pseudo-sessions)
        url = buildUrl(apiConfig.endpoints.games.survival.guess(sport));
        requestData = {
          initials: currentInitials,
          guess: guess.trim(),
        };
      }
      
      logApiCall('POST', url, requestData);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: apiConfig.headers,
        body: JSON.stringify(requestData),
      });

      const result = await response.json();
      
      logApiResponse('POST', url, result);
      setLastResult(result);
      
      // Update score and lives based on result
      if (result.correct) {
        setScore(prev => prev + 1);
      } else {
        setLives(result.lives);
      }
      
      // Clear any existing navigation timeout
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
        navigationTimeoutRef.current = null;
      }

      // Check if game over
      if (result.game_over) {
        navigationTimeoutRef.current = setTimeout(async () => {
          if (isMountedRef.current) {
            try {
              // Submit survival result to backend
              let submissionResult = null;
              try {
                submissionResult = await submitSurvivalResult();
              } catch (submissionError) {
                console.warn('Survival submission failed, but continuing:', submissionError);
                // Continue to navigation even if submission fails
              }
              
              navigation.navigate('Result', {
                score,
                total: score,
                mode: 'survival',
                sport,
                difficulty,
                lives: 0,
                newEloRating: submissionResult?.new_elo_rating,
                eloChange: submissionResult?.elo_change,
                gameDuration: gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0
              });
            } catch (error) {
              console.error('Navigation error:', error);
              Alert.alert('Error', 'Navigation failed. Please try again.');
            }
          }
          navigationTimeoutRef.current = null; // Clear ref after execution
        }, 2000);
      }
      
      // Clear any existing next challenge timeout
      if (nextChallengeTimeoutRef.current) {
        clearTimeout(nextChallengeTimeoutRef.current);
        nextChallengeTimeoutRef.current = null;
      }

      // Always handle next challenge for multiplayer sync (both correct and wrong answers)
      if (sessionId && result.next_challenge) {
        nextChallengeTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            try {
              // Reset round state but keep hint status 
              setCurrentInitials(result.next_challenge.initials);
              setGuess('');
              setShowHint(false);
              setHintPlayers([]);
              setLastResult(null);
              console.log('✅ Next challenge loaded:', result.next_challenge.initials);
            } catch (error) {
              console.error('Next challenge error:', error);
              Alert.alert('Error', 'Failed to load next challenge.');
            }
          }
          nextChallengeTimeoutRef.current = null; // Clear ref after execution
        }, 2000);
      }
    } catch (error) {
      logApiResponse('POST', url || buildUrl(apiConfig.endpoints.games.survival.guess(sport)), null, error);
      Alert.alert('Error', 'Failed to submit guess. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const showHintFunction = async () => {
    // Check if hint already used for this game
    if (hintUsedForGame) {
      Alert.alert('Hint Unavailable', 'You have already used your hint for this game session.');
      return;
    }

    // Don't show hint if no initials are loaded
    if (!currentInitials || currentInitials.length === 0) {
      Alert.alert('Error', 'No challenge loaded. Please wait for initials to appear.');
      return;
    }

    // If we have a session ID, use the new session-based endpoint
    if (sessionId) {
      try {
        const url = buildUrl(apiConfig.endpoints.games.survival.sessionHint(sessionId));
        logApiCall('POST', url);
        
        const response = await fetch(url, {
          method: 'POST',
          headers: apiConfig.headers
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 400 && errorData.detail?.includes('already used')) {
            Alert.alert('Hint Unavailable', 'You have already used your hint for this game session.');
            setHintUsedForGame(true);
            return;
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        logApiResponse('POST', url, data);
        setHintPlayers(data.sample_players);
        setShowHint(true);
        setHintUsedForGame(true); // Mark hint as used for this game
        
        console.log('✅ Hint used - no more available for this game session');
        
      } catch (error) {
        console.error('Session hint error:', error);
        logApiResponse('POST', buildUrl(apiConfig.endpoints.games.survival.sessionHint(sessionId)), null, error);
        Alert.alert('Error', 'Failed to load hint. Please try again.');
      }
    } else {
      // Fallback to legacy endpoint if no session
      try {
        const url = buildUrl(apiConfig.endpoints.games.survival.reveal(sport, currentInitials));
        logApiCall('GET', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        logApiResponse('GET', url, data);
        setHintPlayers(data.sample_players);
        setShowHint(true);
        setHintUsedForGame(true); // Still limit to one per game in legacy mode
        
      } catch (error) {
        console.error('Legacy hint error:', error);
        logApiResponse('GET', buildUrl(apiConfig.endpoints.games.survival.reveal(sport, currentInitials)), null, error);
        Alert.alert('Error', 'Failed to load hint.');
      }
    }
  };

  const skipChallenge = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    if (sessionId) {
      try {
        const url = buildUrl(apiConfig.endpoints.games.survival.sessionSkip(sessionId));
        logApiCall('POST', url);
        
        const response = await fetch(url, { 
          method: 'POST',
          headers: apiConfig.headers 
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        logApiResponse('POST', url, result);
        
        if (result.game_over) {
          // Submit final result and navigate
          try {
            const submissionResult = await submitSurvivalResult();
            navigation.navigate('Result', {
              score: result.score || score,
              total: result.score || score,
              mode: 'survival',
              sport,
              difficulty,
              lives: 0,
              newEloRating: submissionResult?.new_elo_rating,
              eloChange: submissionResult?.elo_change,
              gameDuration: gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0
            });
          } catch (submissionError) {
            console.warn('Survival submission failed, but continuing:', submissionError);
            // Continue to navigation even if submission fails
            navigation.navigate('Result', {
              score: result.score || score,
              total: result.score || score,
              mode: 'survival',
              sport,
              difficulty,
              lives: 0,
              gameDuration: gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0
            });
          }
        } else if (result.challenge) {
          // Update UI with new challenge
          setLives(result.lives);
          setCurrentInitials(result.challenge.initials);
          setGuess('');
          setShowHint(false);
          setHintPlayers([]);
          setLastResult(null);
          console.log('✅ New challenge after skip:', result.challenge.initials);
        }
      } catch (error) {
        console.error('Skip error:', error);
        logApiResponse('POST', buildUrl(apiConfig.endpoints.games.survival.sessionSkip(sessionId)), null, error);
        Alert.alert('Error', 'Failed to skip challenge');
      }
    } else {
      // Legacy mode - just reduce lives without loading new challenge
      const newLives = lives - 1;
      setLives(newLives);
      
      if (newLives <= 0) {
        try {
          // Submit survival result to backend
          const submissionResult = await submitSurvivalResult();
          navigation.navigate('Result', {
            score,
            total: score,
            mode: 'survival',
            sport,
            difficulty,
            lives: 0,
            newEloRating: submissionResult?.new_elo_rating,
            eloChange: submissionResult?.elo_change,
            gameDuration: gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0
          });
        } catch (submissionError) {
          console.warn('Survival submission failed, but continuing:', submissionError);
          navigation.navigate('Result', {
            score,
            total: score,
            mode: 'survival',
            sport,
            difficulty,
            lives: 0,
            gameDuration: gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0
          });
        }
      } else {
        console.log('Life lost in legacy mode, continuing game...');
      }
    }
  }, [sessionId, lives, score, sport, difficulty, navigation, gameStartTime, submitSurvivalResult]);

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

  // Debug log to check render value
  console.log('🔍 Render - currentInitials value:', currentInitials, 'loading:', loading);

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
              {currentInitials && currentInitials.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.hintButton,
                    hintUsedForGame && styles.disabledButton
                  ]}
                  onPress={showHintFunction}
                  disabled={hintUsedForGame}
                >
                  <Text style={styles.hintButtonText}>
                    {hintUsedForGame ? 'Hint Used' : showHint ? 'Hint Shown' : 'Show Hint (1 available)'}
                  </Text>
                </TouchableOpacity>
              )}

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