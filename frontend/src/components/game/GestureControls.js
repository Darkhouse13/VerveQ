import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Animated,
  PanResponder,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { GameHaptics } from '../ui/HapticFeedback';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const GestureControls = ({
  children,
  onSwipeAnswer,
  onDoubleTapAnswer,
  onLongPressHint,
  answers = [],
  currentQuestionId,
  disabled = false,
  hapticEnabled = true,
  showGestureGuide = false,
  overlayPassive = false, // when true overlay is non-interactive and visually non-blocking
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const [activeGesture, setActiveGesture] = useState(null);
  const [gesturePosition, setGesturePosition] = useState({ x: 0, y: 0 });
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const indicatorOpacity = useRef(new Animated.Value(0)).current;
  const indicatorScale = useRef(new Animated.Value(0.5)).current;
  
  const lastTap = useRef(0);
  const longPressTimer = useRef(null);
  const isLongPressing = useRef(false);

  const swipeDirections = {
    up: { answer: 0, color: theme.colors.primary[500], icon: '↑', label: 'A' },
    right: { answer: 1, color: theme.colors.secondary.emerald, icon: '→', label: 'B' },
    down: { answer: 2, color: theme.colors.secondary.coral, icon: '↓', label: 'C' },
    left: { answer: 3, color: theme.colors.secondary.amber, icon: '←', label: 'D' },
  };

  const clearTimers = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const showGestureIndicator = (direction, position) => {
    setActiveGesture(direction);
    setGesturePosition(position);
    
    Animated.parallel([
      Animated.timing(indicatorOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(indicatorScale, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
    ]).start();
  };

  const hideGestureIndicator = () => {
    Animated.parallel([
      Animated.timing(indicatorOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(indicatorScale, {
        toValue: 0.5,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActiveGesture(null);
    });
  };

  const determineSwipeDirection = (dx, dy) => {
    const threshold = 30;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < threshold && absDy < threshold) return null;

    if (absDy > absDx) {
      return dy < 0 ? 'up' : 'down';
    } else {
      return dx > 0 ? 'right' : 'left';
    }
  };

  const handleSwipeComplete = (direction, position) => {
    const swipeConfig = swipeDirections[direction];
    if (!swipeConfig || !answers[swipeConfig.answer]) return;

    if (hapticEnabled) {
      GameHaptics.cardFlip();
    }

    onSwipeAnswer?.(swipeConfig.answer, answers[swipeConfig.answer], direction);
    hideGestureIndicator();
  };

  const handleDoubleTap = (evt) => {
    const { locationX, locationY } = evt.nativeEvent;
    
    // Determine which quadrant was tapped
    const centerX = screenWidth / 2;
    const centerY = screenHeight / 2;
    
    let answerIndex;
    if (locationY < centerY) {
      answerIndex = locationX < centerX ? 0 : 1; // Top-left = A, Top-right = B
    } else {
      answerIndex = locationX < centerX ? 3 : 2; // Bottom-left = D, Bottom-right = C
    }

    if (answers[answerIndex] && hapticEnabled) {
      GameHaptics.buttonPress();
    }

    onDoubleTapAnswer?.(answerIndex, answers[answerIndex]);
  };

  const handleLongPress = (evt) => {
    if (hapticEnabled) {
      GameHaptics.longPress();
    }
    onLongPressHint?.(evt);
  };

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      if (disabled) return false;
      const { dx, dy } = gestureState;
      return Math.abs(dx) > 5 || Math.abs(dy) > 5;
    },

    onPanResponderGrant: (evt) => {
      if (disabled) return;
      
      const { locationX, locationY } = evt.nativeEvent;
      isLongPressing.current = false;

      // Check for double tap
      const now = Date.now();
      if (now - lastTap.current < 300) {
        handleDoubleTap(evt);
        lastTap.current = 0;
        return;
      }
      lastTap.current = now;

      // Start long press timer
      longPressTimer.current = setTimeout(() => {
        if (!disabled) {
          isLongPressing.current = true;
          handleLongPress(evt);
        }
      }, 500);

      // Start press animation
      Animated.spring(scaleAnim, {
        toValue: 0.98,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    },

    onPanResponderMove: (evt, gestureState) => {
      if (disabled || isLongPressing.current) return;

      const { dx, dy, moveX, moveY } = gestureState;
      const direction = determineSwipeDirection(dx, dy);
      
      if (direction && swipeDirections[direction]) {
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 40 && !activeGesture) {
          showGestureIndicator(direction, { x: moveX, y: moveY });
          
          if (hapticEnabled) {
            GameHaptics.selection();
          }
        }

        // Update rotation based on swipe direction
        const rotationValue = {
          up: -0.1,
          down: 0.1,
          left: -0.05,
          right: 0.05,
        }[direction] || 0;

        rotateAnim.setValue(rotationValue);
      }
    },

    onPanResponderRelease: (evt, gestureState) => {
      if (disabled) return;

      clearTimers();
      isLongPressing.current = false;

      // Reset animations
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
        Animated.spring(rotateAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 8,
        }),
      ]).start();

      const { dx, dy, moveX, moveY } = gestureState;
      const direction = determineSwipeDirection(dx, dy);
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (direction && distance > 60) {
        handleSwipeComplete(direction, { x: moveX, y: moveY });
      } else {
        hideGestureIndicator();
      }
    },

    onPanResponderTerminate: () => {
      clearTimers();
      isLongPressing.current = false;
      hideGestureIndicator();
      
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(rotateAnim, {
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();
    },
  });

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-15deg', '15deg'],
  });

  const isAnimating = activeGesture !== null;

  return (
    <View style={[styles(theme).container, style]} {...props}>
      {/* Gesture Guide Overlay */}
      {showGestureGuide && (
        <View
          style={[
            styles(theme).guideOverlay,
            overlayPassive && styles(theme).guideOverlayPassive,
          ]}
          pointerEvents={overlayPassive ? 'none' : 'auto'}
          accessibilityElementsHidden={overlayPassive}
          importantForAccessibility={overlayPassive ? 'no-hide-descendants' : 'yes'}
        >
          <View style={styles(theme).guideGrid}>
            {Object.entries(swipeDirections).map(([direction, config]) => (
              <View
                key={direction}
                style={[
                  styles(theme).guideQuadrant,
                  styles(theme)[`guide${direction.charAt(0).toUpperCase() + direction.slice(1)}`],
                ]}
              >
                <Text style={[styles(theme).guideIcon, { color: config.color }]}>
                  {config.icon}
                </Text>
                <Text style={[styles(theme).guideLabel, { color: config.color }]}>
                  {config.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Main Content */}
      {isAnimating ? (
        <Animated.View
          style={[
            styles(theme).content,
            {
              transform: [
                { scale: scaleAnim },
                { rotate: rotateInterpolate },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {children}
        </Animated.View>
      ) : (
        <View style={styles(theme).content} {...panResponder.panHandlers}>
          {children}
        </View>
      )}

      {/* Gesture Indicator */}
      {activeGesture && (
        <Animated.View
          style={[
            styles(theme).gestureIndicator,
            {
              left: gesturePosition.x - 40,
              top: gesturePosition.y - 40,
              backgroundColor: swipeDirections[activeGesture].color,
              opacity: indicatorOpacity,
              transform: [{ scale: indicatorScale }],
            },
          ]}
        >
          <Text style={styles(theme).indicatorIcon}>
            {swipeDirections[activeGesture].icon}
          </Text>
          <Text style={styles(theme).indicatorLabel}>
            {swipeDirections[activeGesture].label}
          </Text>
        </Animated.View>
      )}

      {/* Instruction Text */}
      <View style={styles(theme).instructions}>
        <Text style={styles(theme).instructionText}>
          Swipe to answer • Double tap for quick select • Long press for hint
        </Text>
      </View>
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  content: {
    flex: 1,
  },
  guideOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    zIndex: 10, // lower than question container which can use higher elevation
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideOverlayPassive: {
    backgroundColor: 'transparent',
    zIndex: 1,
  },
  guideGrid: {
    width: '80%',
    height: '60%',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  guideQuadrant: {
    width: '50%',
    height: '50%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  guideUp: {
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
  },
  guideDown: {
    borderBottomLeftRadius: theme.borderRadius.lg,
    borderBottomRightRadius: theme.borderRadius.lg,
  },
  guideIcon: {
    fontSize: 32,
    marginBottom: theme.spacing.sm,
  },
  guideLabel: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
  },
  gestureIndicator: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
    ...theme.elevation.lg,
  },
  indicatorIcon: {
    fontSize: 24,
    color: theme.colors.onPrimary,
    fontWeight: 'bold',
  },
  indicatorLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.onPrimary,
    fontWeight: theme.typography.weights.bold,
    marginTop: theme.spacing.xs,
  },
  instructions: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.mode.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.mode.surface + 'CC',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
});

export default GestureControls;
