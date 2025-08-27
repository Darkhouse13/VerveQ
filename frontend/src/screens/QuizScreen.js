import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  Animated,
} from 'react-native';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiConfig, buildUrl, logApiCall, logApiResponse } from '../config/api';
import useDynamicSizing from '../hooks/useDynamicSizing';
import useOrientation from '../hooks/useOrientation';
import { QuizSkeleton } from '../components/ui/ContentSkeletons';
import ErrorFallback from '../components/ui/ErrorFallback';
import { GameStateAnnouncer } from '../components/a11y/ScreenReaderAnnouncer';
import { haptics } from '../utils/haptics';
import GestureControls from '../components/game/GestureControls';
import DynamicText from '../components/ui/DynamicText';

const QuizScreen = ({ navigation, route }) => {
  const { sport, theme: routeTheme, reset, difficulty = 'intermediate' } = route.params || { sport: 'football', theme: null, reset: false, difficulty: 'intermediate' };
  const { user } = useAuth();
  const { theme, styles: themeStyles } = useTheme();
  const { updateScore, loadSportTheme, currentTheme } = useSession();
  const { isTablet, deviceType, getContentWidth, getResponsiveFontSize } = useDynamicSizing();
  const { orientation, isLandscape, getLayoutDimensions } = useOrientation();
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
  // Control initial full-screen skeleton vs. subsequent inline loading
  const [showFullSkeleton, setShowFullSkeleton] = useState(true);
  const [initializing, setInitializing] = useState(true);
  
  // Quiz configuration - will be set by API response
  const [maxQuestions, setMaxQuestions] = useState(10); // Default fallback
  
  // ELO tracking state
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnsweredQuestions, setTotalAnsweredQuestions] = useState(0);
  const [totalTimeTaken, setTotalTimeTaken] = useState(0);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [gestureControlsEnabled, setGestureControlsEnabled] = useState(isTablet);

  // Use ref to track component mount status
  const isMountedRef = useRef(true);

  // IMPORTANT: All hooks must execute on every render. The previous implementation
  // placed the responsiveStyles useMemo AFTER early returns (error/loading skeleton),
  // causing the first render (when loading/showFullSkeleton were true) to skip the
  // useMemo, then a later render (when loading became false) to execute one extra
  // hook at position 77 -> React error: "Rendered more hooks than during the previous render".
  // By moving this useMemo above any conditional early returns, hook order is stable.
  const responsiveStyles = useMemo(
    () => styles(theme, { isTablet, isLandscape }),
    [theme, isTablet, isLandscape]
  );
  
  // Timer effect (interval based, throttled to 300ms, avoids per-frame churn)
  useEffect(() => {
    if (!timerActive || !questionStartTime) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - questionStartTime) / 1000;
      setElapsedTime(prev => (Math.abs(elapsed - prev) >= 0.3 ? elapsed : prev));
    }, 300);
    return () => clearInterval(interval);
  }, [timerActive, questionStartTime]);
  
  useEffect(() => {
    let mounted = true;
    isMountedRef.current = true;
    
    const initializeQuiz = async () => {
      if (mounted && isMountedRef.current) {
        // Force new session on reset or first load
        if (reset || !sessionId) {
          setSessionId(null);  // Clear any stale session
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
      const currentSessionId = sessionId;
      mounted = false;
      isMountedRef.current = false;
      // End session if it exists
      if (currentSessionId) {
        endQuizSession();
      }
    };
  }, [sport, reset, difficulty]); // Add difficulty to dependencies

  const createQuizSession = async () => {
    // Clear any existing session first
    setSessionId(null);
    
    // Reset local states before creating a new session
    setScore(0);
    setQuestionCount(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setIsCorrect(false);
    setQuestion(null);  // Clear old question to prevent display
    setLoading(true);   // Ensure loading shows
    setShowFullSkeleton(true);
    setInitializing(true);
    
    // Reset ELO tracking
    setCorrectAnswers(0);
    setTotalAnsweredQuestions(0);
    setTotalTimeTaken(0);
    setGameStartTime(Date.now());

    try {
      // Explicitly set max questions on session creation to 10 (or current state)
  // Provide multiple compatible query params (limit & count) for backend versions
  const desiredMax = maxQuestions || 10;
  const url = buildUrl(`${apiConfig.endpoints.games.quiz.session(sport)}?limit=${desiredMax}&count=${desiredMax}`);
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
        // Accept various field names from backend for maximum compatibility
        const serverMax = data.max_questions || data.maxQuestions || data.limit || data.count;
        if (typeof serverMax === 'number' && serverMax > 0) {
          setMaxQuestions(serverMax);
        } else {
          setMaxQuestions(desiredMax);
        }
        await loadNewQuestion(data.session_id);
      } else {
        // Fallback: still attempt question load without session
        await loadNewQuestion();
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
      const url = buildUrl(apiConfig.endpoints.games.quiz.endSession(sport, sessionId));
      await fetch(url, { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to end session:', error);
    } finally {
      setSessionId(null);  // Clear session from state
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
      const params = new URLSearchParams();
      if (currentSessionId) {
        params.append('session_id', currentSessionId);
      }
      if (difficulty) {
        params.append('difficulty', difficulty);
      }
      const queryParams = params.toString() ? `?${params.toString()}` : '';
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
        setQuestionCount(prev => {
          const next = prev + 1;
          console.log(`[Quiz] Loaded question ${next}/${maxQuestions} for ${sport} (${difficulty})`);
          return next;
        });
        // On first successful question load, stop using full-screen skeleton
        if (showFullSkeleton) {
          setShowFullSkeleton(false);
          setInitializing(false);
        }
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
  }, [sport, sessionId, difficulty]);

  // Enable LayoutAnimation on Android
  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const handleAnswerSelect = useCallback((answer) => {
    if (showResult) return;
    // Haptic selection feedback
    if (Platform.OS !== 'web') { haptics.selection(); }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedAnswer(answer);
  }, [showResult]);

  const submitAnswer = useCallback(async () => {
    if (!selectedAnswer || !question || !isMountedRef.current || isSubmitting) return;

    setIsSubmitting(true);

    // Stop timer and calculate time taken
    setTimerActive(false);
    const timeTaken = elapsedTime;

    const abortController = new AbortController();
    
    // Add timeout to prevent hanging requests
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, apiConfig.timeout || 10000);
    
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
        // Haptic impact based on correctness
        if (Platform.OS !== 'web') {
          if (result.correct) { haptics.impact('Light'); } else { haptics.impact('Medium'); }
        }
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowResult(true);
        
        // Track statistics for ELO
        setTotalAnsweredQuestions(prev => prev + 1);
        setTotalTimeTaken(prev => prev + timeTaken);
        
        if (result.correct) {
          setScore(prev => prev + result.score);
          setCorrectAnswers(prev => prev + 1);
        }
      }
    } catch (error) {
      if (isMountedRef.current && error.name !== 'AbortError') {
        logApiResponse('POST', buildUrl(apiConfig.endpoints.games.quiz.check(sport)), null, error);
        // Handle validation errors specifically
        if (error.message && error.message.includes('422')) {
          Alert.alert('Error', 'Invalid request. Please check your answer and try again.');
        } else if (error.message && error.message.includes('429')) {
          Alert.alert('Too Many Attempts', 'Please wait a moment before trying again.');
        } else {
          Alert.alert('Error', 'Failed to submit answer. Please try again.');
        }
      }
    } finally {
      // Clear timeout and cleanup
      clearTimeout(timeoutId);
      setIsSubmitting(false);
    }
  }, [selectedAnswer, question, sport, isSubmitting]);

  const submitQuizResult = async () => {
    try {
      const accuracy = totalAnsweredQuestions > 0 ? correctAnswers / totalAnsweredQuestions : 0;
      const avgTime = totalAnsweredQuestions > 0 ? totalTimeTaken / totalAnsweredQuestions : 0;
      
      const resultData = {
        user_id: user?.id || `guest_${Date.now()}`,
        score: correctAnswers,
        total_questions: totalAnsweredQuestions,
        accuracy: accuracy,
        average_time: avgTime,
        difficulty: difficulty || 'intermediate'
      };
      
      const url = buildUrl(apiConfig.endpoints.games.quiz.complete(sport));
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
      console.error('Failed to submit quiz result:', error);
      logApiResponse('POST', buildUrl(apiConfig.endpoints.games.quiz.complete(sport)), null, error);
      throw error;
    }
  };

  const handleNextQuestion = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    // Reset timer for next question
    setTimerActive(false);
    setElapsedTime(0);
    
    if (questionCount >= maxQuestions) {
      try {
        // Submit quiz result to backend
        let submissionResult = null;
        try {
          submissionResult = await submitQuizResult();
        } catch (submissionError) {
          console.warn('Quiz submission failed, but continuing:', submissionError);
          // Continue to navigation even if submission fails
        }
        
        // End session before navigating
        await endQuizSession();
        
        navigation.navigate('Result', {
          score,
          total: questionCount * 100, // Maximum possible score (100 points per question)
          mode: 'quiz',
          sport,
          difficulty,
          newEloRating: submissionResult?.new_elo_rating,
          eloChange: submissionResult?.elo_change,
          correctAnswers,
          totalQuestions: totalAnsweredQuestions,
          accuracy: totalAnsweredQuestions > 0 ? (correctAnswers / totalAnsweredQuestions * 100) : 0
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
  }, [questionCount, maxQuestions, navigation, score, sport, loadNewQuestion, endQuizSession]);

  // handleFinishQuiz removed – flow now advances exclusively by tapping the card after showing result.

  const getAnswerVisualState = useCallback((option) => {
    if (!showResult) {
      return selectedAnswer === option ? 'selected' : 'default';
    }
    if (option === question?.correct_answer) return 'correct';
    if (selectedAnswer === option && !isCorrect) return 'incorrect';
    return 'disabled';
  }, [showResult, selectedAnswer, question?.correct_answer, isCorrect]);

  // OptionButton component encapsulates press feedback & animated state
  const OptionButton = useCallback(({ option, index }) => {
    const state = getAnswerVisualState(option);
    const animated = useRef(new Animated.Value(1)).current;

    const onPressIn = () => {
      if (showResult) return;
      Animated.spring(animated, { toValue: 0.97, useNativeDriver: true, speed: 25, bounciness: 6 }).start();
    };
    const onPressOut = () => {
      if (showResult) return;
      Animated.spring(animated, { toValue: 1, useNativeDriver: true, speed: 25, bounciness: 6 }).start();
    };

    const handlePress = () => handleAnswerSelect(option);

    let containerStyle = [responsiveStyles.optionBase];
    switch (state) {
      case 'selected':
        containerStyle.push(responsiveStyles.optionSelected);
        break;
      case 'correct':
        containerStyle.push(responsiveStyles.optionCorrect);
        break;
      case 'incorrect':
        containerStyle.push(responsiveStyles.optionIncorrect);
        break;
      case 'disabled':
        containerStyle.push(responsiveStyles.optionDisabled);
        break;
    }

    return (
      <Animated.View style={{ transform: [{ scale: animated }] }}>
        <Pressable
          key={index}
            onPress={handlePress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={showResult}
            hitSlop={8}
            accessibilityLabel={`Option ${String.fromCharCode(65 + index)}: ${option}`}
            accessibilityState={{ selected: selectedAnswer === option, disabled: showResult }}
            style={containerStyle}
        >
          <DynamicText 
            variant="body" 
            style={responsiveStyles.optionText}
            maxLines={3}
            adjustsFontSizeToFit={isTablet}
          >
            {option}
          </DynamicText>
        </Pressable>
      </Animated.View>
    );
  }, [getAnswerVisualState, handleAnswerSelect, showResult, selectedAnswer, isTablet, responsiveStyles.optionBase, responsiveStyles.optionSelected, responsiveStyles.optionCorrect, responsiveStyles.optionIncorrect, responsiveStyles.optionDisabled]);

  // Error state (must be below all hooks to avoid hook order changes)
  if (error) {
    return (
      <ErrorFallback
        error={error}
        resetError={() => setError(null)}
        context="quiz"
        retryAction={createQuizSession}
      />
    );
  }

  // Loading state with enhanced skeleton (only show full-screen skeleton on initial load)
  if (loading && showFullSkeleton) {
    return (
      <SafeAreaView style={[themeStyles.container, responsiveStyles.container]}>
        <View style={responsiveStyles.loadingContainer}>
          <QuizSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  const QuizContent = () => (
    <View style={responsiveStyles.content}>
      {/* Accessibility announcer for game state */}
      <GameStateAnnouncer
        score={score}
        question={question?.question}
        timeRemaining={30 - elapsedTime} // Assuming 30s per question
      />

      {/* Header */}
      <View style={responsiveStyles.header}>
        <DynamicText variant="h6" style={responsiveStyles.scoreText}>
          Score: {score}
        </DynamicText>
        <DynamicText variant="body" style={responsiveStyles.questionNumber}>
          Question {questionCount}/{maxQuestions}
        </DynamicText>
        <DynamicText variant="body" style={responsiveStyles.timerText}>
          Time: {Math.floor(elapsedTime).toString().padStart(2,'0')}s
        </DynamicText>
      </View>
      
      {/* Difficulty Badge */}
      <View style={responsiveStyles.difficultyHeader}>
        <DynamicText variant="caption" style={responsiveStyles.difficultyText}>
          {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} Mode
        </DynamicText>
      </View>

      {question && (
        <View
          style={responsiveStyles.questionContainer}
          // Allow tapping anywhere in the question card to proceed once result is shown
          onStartShouldSetResponder={() => showResult}
          onResponderRelease={() => {
            if (showResult && !isSubmitting) {
              handleNextQuestion();
            }
          }}
        >
          <Text
            testID="QuestionText"
            accessibilityRole="header"
            style={responsiveStyles.questionPlainText}
            numberOfLines={8}
          >
            {question.question}
          </Text>
          <View style={[
            responsiveStyles.optionsContainer,
            isLandscape && isTablet && responsiveStyles.optionsContainerLandscape
          ]}>
            {question.options.map((option, index) => (
              <OptionButton option={option} index={index} key={option + index} />
            ))}
          </View>
          {showResult && (
            <DynamicText
              variant="caption"
              style={responsiveStyles.postRevealHint}
              accessibilityLiveRegion="polite"
            >
              {questionCount >= maxQuestions
                ? (isCorrect ? 'Correct! Tap to finish.' : `Incorrect. Correct answer: ${question.correct_answer}. Tap to finish.`)
                : (isCorrect ? 'Correct! Tap to continue.' : `Incorrect. Correct answer: ${question.correct_answer}. Tap to continue.`)}
            </DynamicText>
          )}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[themeStyles.container, responsiveStyles.container]}>
      {gestureControlsEnabled ? (
        <GestureControls
          onSwipeAnswer={(answerIndex, answer) => {
            if (!showResult && question?.options[answerIndex]) {
              handleAnswerSelect(question.options[answerIndex]);
            }
          }}
          onDoubleTapAnswer={(answerIndex) => {
            if (!showResult && question?.options[answerIndex]) {
              handleAnswerSelect(question.options[answerIndex]);
              setTimeout(submitAnswer, 300); // Auto-submit after selection
            }
          }}
          answers={question?.options || []}
          disabled={showResult || !question}
          showGestureGuide={false} // ensure overlay never obscures question by default
          overlayPassive
        >
          <QuizContent />
        </GestureControls>
      ) : (
        <QuizContent />
      )}

  <View style={responsiveStyles.buttonContainer}>
    {!showResult && (
      <TouchableOpacity
        style={[
          responsiveStyles.submitButton,
          !selectedAnswer && responsiveStyles.disabledButton
        ]}
        onPress={submitAnswer}
        disabled={!selectedAnswer || isSubmitting}
        accessibilityLabel={isSubmitting ? 'Submitting answer' : 'Submit answer'}
      >
        <DynamicText variant="button" style={responsiveStyles.submitButtonText}>
          {isSubmitting ? 'Submitting...' : 'Submit Answer'}
        </DynamicText>
      </TouchableOpacity>
    )}
  </View>
    </SafeAreaView>
  );
};

const styles = (theme, { isTablet, isLandscape } = {}) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.mode.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  content: {
    flexGrow: 1,
    flexShrink: 0,
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
    maxWidth: isTablet ? 1200 : undefined,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    paddingHorizontal: isTablet ? theme.spacing.lg : 0,
  },
  scoreText: {
    color: theme.colors.primary[600],
    fontWeight: theme.typography.weights.bold,
  },
  questionNumber: {
    color: theme.colors.mode.textSecondary,
  },
  timerText: {
    color: theme.colors.primary[500],
    fontWeight: theme.typography.weights.bold,
    minWidth: 80, // prevent header layout jitter during timer updates
    textAlign: 'right',
  },
  difficultyHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  difficultyText: {
    backgroundColor: theme.colors.primary[100],
    color: theme.colors.primary[700],
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  questionContainer: {
  // Removed flex:1 to prevent options pushing question text off-screen on some layouts
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.xl,
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.elevation.md,
    maxWidth: isTablet ? 800 : undefined,
    alignSelf: 'center',
    width: '100%',
  minHeight: 200,
  },
  questionText: {
    color: theme.colors.mode.text,
    marginBottom: theme.spacing.lg,
  lineHeight: theme.typography.lineHeights.relaxed,
  // Ensure question text allocates space even if font calc fails
  minHeight: 60,
  // Fallback font size in case DynamicText scaling collapses size
  fontSize: theme.typography.sizes.lg,
  },
  questionPlainText: {
    color: theme.colors.mode.text,
    marginBottom: theme.spacing.lg,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    lineHeight: Math.round(theme.typography.sizes.lg * theme.typography.lineHeights.relaxed),
    minHeight: 60,
  },
  optionsContainer: {
    gap: isTablet ? theme.spacing.lg : theme.spacing.md,
    ...(isLandscape && isTablet && {
      flexDirection: 'row',
      flexWrap: 'wrap',
    }),
  },
  optionsContainerLandscape: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  // Legacy base option style (kept for compatibility)
  option: {
    backgroundColor: theme.colors.mode.background,
    padding: isTablet ? theme.spacing.lg : theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: theme.colors.mode.border,
    ...(isLandscape && isTablet && {
      width: '48%',
    }),
  },
  // New naming for OptionButton component
  optionBase: {
    backgroundColor: theme.colors.mode.background,
    padding: isTablet ? theme.spacing.lg : theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: theme.colors.mode.border,
    ...(isLandscape && isTablet && {
      width: '48%',
    }),
  },
  optionTablet: {
    minHeight: 60,
    justifyContent: 'center',
  },
  selectedOption: {
    backgroundColor: theme.colors.primary[50],
    borderColor: theme.colors.primary[500],
  },
  correctOption: {
    backgroundColor: theme.colors.success.light,
    borderColor: theme.colors.success.main,
  },
  incorrectOption: {
    backgroundColor: theme.colors.error.light,
    borderColor: theme.colors.error.main,
  },
  disabledOption: {
    backgroundColor: theme.colors.mode.disabled,
    borderColor: theme.colors.mode.border,
    opacity: 0.6,
  },
  // New naming variants mapped to legacy styles
  optionSelected: {
    backgroundColor: theme.colors.primary[100],
    borderColor: theme.colors.primary[600],
  },
  optionCorrect: {
    backgroundColor: theme.colors.success.light,
    borderColor: theme.colors.success.main,
  },
  optionIncorrect: {
    backgroundColor: theme.colors.error.light,
    borderColor: theme.colors.error.main,
  },
  optionDisabled: {
    backgroundColor: theme.colors.mode.disabled,
    borderColor: theme.colors.mode.border,
    opacity: 0.55,
  },
  optionText: {
    color: theme.colors.mode.text,
    textAlign: 'center',
  },
  postRevealHint: {
    marginTop: theme.spacing.lg,
    textAlign: 'center',
    color: theme.colors.mode.textSecondary,
  },
  resultContainer: {
    marginTop: theme.spacing.lg,
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.mode.border,
  },
  resultText: {
    fontWeight: theme.typography.weights.bold,
    marginBottom: theme.spacing.sm,
  },
  correctAnswerText: {
    color: theme.colors.mode.textSecondary,
    textAlign: 'center',
  },
  tapHint: {
    marginTop: theme.spacing.sm,
    color: theme.colors.mode.textSecondary,
    textAlign: 'center',
  },
  buttonContainer: {
    paddingHorizontal: isTablet ? theme.spacing.xl : 0,
    paddingBottom: theme.spacing.lg,
  },
  submitButton: {
    backgroundColor: theme.colors.primary[500],
    padding: isTablet ? theme.spacing.lg : theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    minHeight: 48,
  },
  disabledButton: {
    backgroundColor: theme.colors.mode.disabled,
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: theme.typography.weights.bold,
  },
});

export default QuizScreen;