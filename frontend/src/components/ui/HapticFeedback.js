import React, { useCallback, useRef } from 'react';
import { Vibration, Platform } from 'react-native';

// Fallback for platforms that don't support haptics
const fallbackHaptic = {
  selection: () => {},
  impactLight: () => {},
  impactMedium: () => {},
  impactHeavy: () => {},
  notification: () => {},
  success: () => {},
  warning: () => {},
  error: () => {},
};

// Simple vibration-based haptic feedback using React Native's Vibration API
const HapticFeedback = {
  // Light tap feedback
  selection: () => {
    if (Platform.OS === 'ios') {
      try {
        Vibration.vibrate(10); // Very short vibration on iOS
      } catch (error) {
        // Silently fail
      }
    } else if (Platform.OS === 'android') {
      try {
        Vibration.vibrate(25); // Short vibration on Android
      } catch (error) {
        // Silently fail
      }
    }
  },

  // Impact feedback
  impactLight: () => {
    try {
      Vibration.vibrate(30);
    } catch (error) {
      // Silently fail
    }
  },

  impactMedium: () => {
    try {
      Vibration.vibrate(50);
    } catch (error) {
      // Silently fail
    }
  },

  impactHeavy: () => {
    try {
      Vibration.vibrate(80);
    } catch (error) {
      // Silently fail
    }
  },

  // Notification feedback
  notification: () => {
    try {
      Vibration.vibrate([0, 50, 50, 50]); // Pattern: pause, vibrate, pause, vibrate
    } catch (error) {
      // Silently fail
    }
  },

  success: () => {
    try {
      Vibration.vibrate([0, 30, 30, 60]); // Success pattern
    } catch (error) {
      // Silently fail
    }
  },

  warning: () => {
    try {
      Vibration.vibrate([0, 50, 30, 50, 30, 50]); // Warning pattern
    } catch (error) {
      // Silently fail
    }
  },

  error: () => {
    try {
      Vibration.vibrate([0, 100, 50, 100]); // Error pattern
    } catch (error) {
      // Silently fail
    }
  },
};

// Custom haptic patterns for game interactions
export const GameHaptics = {
  correctAnswer: () => {
    // Double pulse for correct answers
    HapticFeedback.impactLight();
    setTimeout(() => HapticFeedback.impactMedium(), 100);
  },

  wrongAnswer: () => {
    // Single heavy pulse for wrong answers
    HapticFeedback.impactHeavy();
  },

  gameWin: () => {
    // Success pattern: light -> medium -> heavy
    HapticFeedback.impactLight();
    setTimeout(() => HapticFeedback.impactMedium(), 150);
    setTimeout(() => HapticFeedback.success(), 300);
  },

  gameLose: () => {
    // Loss pattern: heavy -> error notification
    HapticFeedback.impactHeavy();
    setTimeout(() => HapticFeedback.error(), 200);
  },

  levelUp: () => {
    // Achievement unlock pattern
    HapticFeedback.impactLight();
    setTimeout(() => HapticFeedback.impactMedium(), 100);
    setTimeout(() => HapticFeedback.impactHeavy(), 200);
    setTimeout(() => HapticFeedback.success(), 350);
  },

  streakBreak: () => {
    // Streak break warning
    HapticFeedback.warning();
  },

  buttonPress: () => {
    // Light feedback for button presses
    HapticFeedback.selection();
  },

  swipeAction: () => {
    // Medium feedback for swipe actions
    HapticFeedback.impactMedium();
  },

  longPress: () => {
    // Light feedback for long press start
    HapticFeedback.impactLight();
  },

  cardFlip: () => {
    // Selection feedback for card interactions
    HapticFeedback.selection();
  },

  countdown: () => {
    // Light pulse for countdown ticks
    HapticFeedback.impactLight();
  },

  timeWarning: () => {
    // Warning when time is running out
    HapticFeedback.warning();
  },
};

// Hook for haptic feedback with preferences and throttling
export const useHapticFeedback = (options = {}) => {
  const { 
    enabled = true, 
    throttleMs = 50,
    gameMode = false 
  } = options;
  
  const lastHapticTime = useRef({});

  const triggerHaptic = useCallback((hapticType, customPattern) => {
    if (!enabled) return;

    const now = Date.now();
    const lastTime = lastHapticTime.current[hapticType] || 0;
    
    // Throttle rapid haptic calls
    if (now - lastTime < throttleMs) return;
    lastHapticTime.current[hapticType] = now;

    try {
      if (customPattern && typeof customPattern === 'function') {
        customPattern();
      } else if (gameMode && GameHaptics[hapticType]) {
        GameHaptics[hapticType]();
      } else if (HapticFeedback[hapticType]) {
        HapticFeedback[hapticType]();
      }
    } catch (error) {
      console.warn('Haptic feedback error:', error);
    }
  }, [enabled, throttleMs, gameMode]);

  return {
    triggerHaptic,
    patterns: gameMode ? GameHaptics : HapticFeedback,
  };
};

// Component wrapper for adding haptic feedback to any touchable
export const HapticTouchable = ({
  children,
  onPress,
  hapticType = 'selection',
  hapticEnabled = true,
  customPattern,
  ...touchableProps
}) => {
  const { triggerHaptic } = useHapticFeedback({ enabled: hapticEnabled });

  const handlePress = (event) => {
    if (hapticEnabled) {
      triggerHaptic(hapticType, customPattern);
    }
    onPress?.(event);
  };

  // Return children with enhanced press handler
  if (typeof children === 'function') {
    return children({ onPress: handlePress, ...touchableProps });
  }

  // Clone the child element and add press handler
  return React.cloneElement(children, {
    onPress: handlePress,
    ...touchableProps,
  });
};

export default HapticFeedback;