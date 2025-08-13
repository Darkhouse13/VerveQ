import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSession } from '../context/SessionContext';
import { apiConfig, buildUrl, logApiCall, logApiResponse } from '../config/api';

const QuizScreen = ({ navigation, route }) => {
  const { sport, theme, reset } = route.params || { sport: 'football', theme: null, reset: false }; // Destructure reset
  const { updateScore, loadSportTheme, currentTheme } = useSession();
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [questionCount, setQuestionCount] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  
  // Quiz configuration
  const MAX_QUESTIONS = 20; // Prevent infinite quiz sessions

  // Use ref to track component mount status
  const isMountedRef = useRef(true);
  
  // Timer effect
  useEffect(() => {
    let interval = null;
    
    if (timerActive && questionStartTime) {
      interval = setInterval(() => {
        const currentTime = Date.now();
        const elapsed = (currentTime - questionStartTime) / 1000; // Convert to seconds
        setElapsedTime(elapsed);
      }, 100); // Update every 100ms for smooth display
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [timerActive, questionStartTime]);
  
  useEffect(() => {
    let mounted = true;
    isMountedRef.current = true;
    
    const initializeQuiz = async () => {
      if (mounted && isMountedRef.current) {
        // Only create a new session if it's a fresh start or explicitly reset
        if (reset || !sessionId) { // Check for reset flag or if no session exists
          await createQuizSession();
        } else {
          // If not resetting and session exists, just load a new question for the current session
          await loadNewQuestion();
        }
      }
    };
    
    initializeQuiz();
    
    // Cleanup function
    return () => {
      mounted = false;
      isMountedRef.current = false;
      // End session if it exists
      if (sessionId && isMountedRef.current) {
        endQuizSession();
      }
    };
  }, [sport, reset]); // Add reset as dependency

  const createQuizSession = async () => {
    // Reset local states before creating a new session
    setScore(0);
    setQuestionCount(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setIsCorrect(false);

    try {
      const url = buildUrl(`/games/${sport}/quiz/session`);
      logApiCall('POST', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.status}`);
      }
      
      const data = await response.json();
      logApiResponse('POST', url, data);
      
      if (data.session_id) {
        setSessionId(data.session_id);
        // Now load the first question
        await loadNewQuestion(data.session_id);
      }
    } catch (error) {
      console.error('Failed to create quiz session:', error);
      // Fall back to loading without session
      await loadNewQuestion();
    }
  };

  const endQuizSession = async () => {
    if (!sessionId) return;
    
    try {
      const url = buildUrl(`/games/${sport}/quiz/session/${sessionId}`);
      await fetch(url, { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  const loadNewQuestion = useCallback(async (sessionIdParam) => {
    // Don't proceed if component is unmounted
    if (!isMountedRef.current) return;
    
    const abortController = new AbortController();
    
    try {
      setLoading(true);
      setSelectedAnswer(null);
      setShowResult(false);
      
      // Use passed session ID or state session ID
      const currentSessionId = sessionIdParam || sessionId;
      const queryParams = currentSessionId ? `?session_id=${currentSessionId}` : '';
      const url = buildUrl(apiConfig.endpoints.games.quiz.question(sport) + queryParams);
      logApiCall('GET', url);
      
      const response = await fetch(url, {
        signal: abortController.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validate response data structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response: not an object');
      }
      
      if (!data.question || typeof data.question !== 'string') {
        throw new Error('Invalid response: missing or invalid question');
      }
      
      if (!data.options || !Array.isArray(data.options) || data.options.length < 2) {
        throw new Error('Invalid response: missing or invalid options');
      }
      
      if (!data.correct_answer || typeof data.correct_answer !== 'string') {
        throw new Error('Invalid response: missing or invalid correct_answer');
      }
      
      if (!data.options.includes(data.correct_answer)) {
        throw new Error('Invalid response: correct_answer not in options');
      }
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        logApiResponse('GET', url, data);
        setQuestion(data);
        setQuestionCount(prev => prev + 1);
        // Start timer for new question
        setQuestionStartTime(Date.now());
        setTimerActive(true);
        setElapsedTime(0);
      }
    } catch (error) {
      // Only handle error if component is still mounted and not aborted
      if (isMountedRef.current && error.name !== 'AbortError') {
        console.error('Quiz question loading error:', error);
        logApiResponse('GET', buildUrl(apiConfig.endpoints.games.quiz.question(sport)), null, error);
        Alert.alert('Error', `Failed to load question: ${error.message}. Check if backend is running on ${apiConfig.baseURL}`);
      }
    } finally {
      // Only update loading state if component is still mounted
      if (isMountedRef.current) {
        setLoading(false);
      }
      // Cleanup abort controller
      abortController.abort();
    }
  }, [sport, sessionId]);

  const handleAnswerSelect = useCallback((answer) => {
    if (showResult) return;
    setSelectedAnswer(answer);
  }, [showResult]);

  const submitAnswer = useCallback(async () => {
    if (!selectedAnswer || !question || !isMountedRef.current) return;

    // Stop timer and calculate time taken
    setTimerActive(false);
    const timeTaken = elapsedTime;

    const abortController = new AbortController();
    
    try {
      // Sanitize the answer to match backend regex requirements
      // Backend pattern: ^[a-zA-Z0-9\s\-_\.,:;()!?\'\"]+$
      const sanitizedAnswer = selectedAnswer
        .replace(/%/g, ' percent')  // Replace % with "percent"
        .replace(/&/g, ' and ')     // Replace & with "and"
        .replace(/\//g, ' or ')     // Replace / with "or"
        .replace(/[^\w\s\-_\.,:;()!?'"]/g, '')  // Remove any remaining disallowed characters
        .trim();
      
      if (!sanitizedAnswer) {
        Alert.alert('Error', 'Invalid answer format. Please try again.');
        return;
      }
      
      const url = buildUrl(apiConfig.endpoints.games.quiz.check(sport));
      const requestData = {
        answer: sanitizedAnswer,
        time_taken: timeTaken,
        question: question,
      };
      
      logApiCall('POST', url, requestData);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: apiConfig.headers,
        body: JSON.stringify(requestData),
        signal: abortController.signal
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Validate response
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid answer check response');
      }
      
      if (typeof result.correct !== 'boolean') {
        throw new Error('Invalid answer check response: missing correct field');
      }
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        logApiResponse('POST', url, result);
        setIsCorrect(result.correct);
        setShowResult(true);
        
        if (result.correct) {
          setScore(prev => prev + result.score);
        }
      }
    } catch (error) {
      if (isMountedRef.current && error.name !== 'AbortError') {
        logApiResponse('POST', buildUrl(apiConfig.endpoints.games.quiz.check(sport)), null, error);
        // Handle validation errors specifically
        if (error.message && error.message.includes('422')) {
          Alert.alert('Error', 'Invalid request. Please check your answer and try again.');
        } else {
          Alert.alert('Error', 'Failed to submit answer. Please try again.');
        }
      }
    } finally {
      // Cleanup abort controller
      abortController.abort();
    }
  }, [selectedAnswer, question, sport]);

  const handleNextQuestion = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    // Reset timer for next question
    setTimerActive(false);
    setElapsedTime(0);
    
    if (questionCount >= MAX_QUESTIONS) {
      try {
        // End session before navigating
        await endQuizSession();
        navigation.navigate('Result', {
          score,
          total: questionCount * 100, // Maximum possible score (100 points per question)
          mode: 'quiz',
          sport
        });
      } catch (error) {
        console.error('Navigation error:', error);
        Alert.alert('Error', 'Navigation failed. Please try again.');
      }
    } else {
      try {
        loadNewQuestion();
      } catch (error) {
        console.error('Load question error:', error);
        Alert.alert('Error', 'Failed to load next question. Please try again.');
      }
    }
  }, [questionCount, MAX_QUESTIONS, navigation, score, sport, loadNewQuestion, endQuizSession]);

  const handleFinishQuiz = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    // Reset timer
    setTimerActive(false);
    setElapsedTime(0);
    
    try {
      // End session before finishing
      await endQuizSession();
      
      if (updateScore) {
        await updateScore(sport, 'quiz', score, questionCount);
      }
      
      navigation.navigate('Result', {
        score,
        total: questionCount * 100, // Maximum possible score (100 points per question)
        mode: 'quiz',
        sport
      });
    } catch (error) {
      console.error('Finish quiz error:', error);
      Alert.alert('Error', 'Failed to finish quiz. Please try again.');
    }
  }, [updateScore, sport, score, questionCount, navigation, endQuizSession]);

  const getAnswerButtonStyle = useCallback((option) => {
    if (!showResult) {
      return selectedAnswer === option ? styles.selectedOption : styles.option;
    }
    
    if (option === question?.correct_answer) {
      return styles.correctOption;
    }
    
    if (selectedAnswer === option && !isCorrect) {
      return styles.incorrectOption;
    }
    
    return styles.disabledOption;
  }, [showResult, selectedAnswer, question?.correct_answer, isCorrect]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1a237e" />
          <Text style={styles.loadingText}>Loading question...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.scoreText}>Score: {score}</Text>
          <Text style={styles.questionNumber}>Question {questionCount}</Text>
          <Text style={styles.timerText}>Time: {elapsedTime.toFixed(1)}s</Text>
        </View>

        {question && (
          <View style={styles.questionContainer}>
            <Text style={styles.category}>{question.category}</Text>
            <Text style={styles.questionText}>{question.question}</Text>
            
            <View style={styles.optionsContainer}>
              {question.options.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={getAnswerButtonStyle(option)}
                  onPress={() => handleAnswerSelect(option)}
                  disabled={showResult}
                >
                  <Text style={styles.optionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {showResult && (
              <View style={styles.resultContainer}>
                <Text style={[
                  styles.resultText,
                  { color: isCorrect ? '#4caf50' : '#f44336' }
                ]}>
                  {isCorrect ? '✅ Correct!' : '❌ Incorrect'}
                </Text>
                {!isCorrect && (
                  <Text style={styles.correctAnswerText}>
                    Correct answer: {question.correct_answer}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        <View style={styles.buttonContainer}>
          {!showResult ? (
            <TouchableOpacity
              style={[
                styles.submitButton,
                !selectedAnswer && styles.disabledButton
              ]}
              onPress={submitAnswer}
              disabled={!selectedAnswer}
            >
              <Text style={styles.submitButtonText}>Submit Answer</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.nextButton}
                onPress={handleNextQuestion}
              >
                <Text style={styles.nextButtonText}>
                  {questionCount >= MAX_QUESTIONS ? 'View Results' : 'Next Question'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.finishButton}
                onPress={handleFinishQuiz}
              >
                <Text style={styles.finishButtonText}>Finish Quiz</Text>
              </TouchableOpacity>
            </View>
          )}
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
  timerText: {
    fontSize: 16,
    color: '#1a237e',
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  scoreText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a237e',
  },
  questionNumber: {
    fontSize: 16,
    color: '#666',
  },
  questionContainer: {
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
  category: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  questionText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    lineHeight: 28,
  },
  optionsContainer: {
    gap: 12,
  },
  option: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  selectedOption: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#1a237e',
  },
  correctOption: {
    backgroundColor: '#e8f5e8',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4caf50',
  },
  incorrectOption: {
    backgroundColor: '#ffebee',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#f44336',
  },
  disabledOption: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ddd',
    opacity: 0.6,
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  resultContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  resultText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  correctAnswerText: {
    fontSize: 16,
    color: '#666',
  },
  buttonContainer: {
    marginTop: 20,
  },
  submitButton: {
    backgroundColor: '#1a237e',
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
    gap: 12,
  },
  nextButton: {
    backgroundColor: '#4caf50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  finishButton: {
    backgroundColor: '#ff9800',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default QuizScreen;