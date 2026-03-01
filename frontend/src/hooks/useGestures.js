import { useRef, useCallback } from 'react';
import { PanResponder, Animated } from 'react-native';

const useGestures = ({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  onLongPress,
  onDoubleTap,
  swipeThreshold = 50,
  velocityThreshold = 0.3,
  longPressDelay = 500,
  doubleTapDelay = 300,
  enabled = true,
}) => {
  const isGesturing = useRef(false);
  const startTime = useRef(0);
  const lastTap = useRef(0);
  const longPressTimer = useRef(null);
  const tapCount = useRef(0);

  const clearTimers = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleSwipeGesture = useCallback((gestureState) => {
    const { dx, dy, vx, vy } = gestureState;
    
    // Determine if it's a swipe based on distance and velocity
    const isHorizontalSwipe = Math.abs(dx) > swipeThreshold && Math.abs(vx) > velocityThreshold;
    const isVerticalSwipe = Math.abs(dy) > swipeThreshold && Math.abs(vy) > velocityThreshold;

    if (isHorizontalSwipe) {
      if (dx > 0 && onSwipeRight) {
        onSwipeRight({ dx, dy, vx, vy });
        return true;
      } else if (dx < 0 && onSwipeLeft) {
        onSwipeLeft({ dx, dy, vx, vy });
        return true;
      }
    }

    if (isVerticalSwipe) {
      if (dy > 0 && onSwipeDown) {
        onSwipeDown({ dx, dy, vx, vy });
        return true;
      } else if (dy < 0 && onSwipeUp) {
        onSwipeUp({ dx, dy, vx, vy });
        return true;
      }
    }

    return false;
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, swipeThreshold, velocityThreshold]);

  const handleTapGesture = useCallback((evt) => {
    const now = Date.now();
    
    if (onDoubleTap) {
      if (now - lastTap.current < doubleTapDelay) {
        tapCount.current++;
        if (tapCount.current === 2) {
          onDoubleTap(evt);
          tapCount.current = 0;
          lastTap.current = 0;
          return true;
        }
      } else {
        tapCount.current = 1;
      }
      lastTap.current = now;
    }

    return false;
  }, [onDoubleTap, doubleTapDelay]);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      if (!enabled) return false;
      
      // Don't set if it's a very small movement (could be a tap)
      const { dx, dy } = gestureState;
      return Math.abs(dx) > 5 || Math.abs(dy) > 5;
    },

    onMoveShouldSetPanResponderCapture: () => false,

    onPanResponderGrant: (evt) => {
      if (!enabled) return;
      
      isGesturing.current = true;
      startTime.current = Date.now();

      // Start long press timer
      if (onLongPress) {
        longPressTimer.current = setTimeout(() => {
          if (isGesturing.current) {
            onLongPress(evt);
            clearTimers();
          }
        }, longPressDelay);
      }
    },

    onPanResponderMove: (evt, gestureState) => {
      if (!enabled || !isGesturing.current) return;

      // Cancel long press if user moves too much
      const { dx, dy } = gestureState;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clearTimers();
      }
    },

    onPanResponderRelease: (evt, gestureState) => {
      if (!enabled) return;

      const duration = Date.now() - startTime.current;
      isGesturing.current = false;
      clearTimers();

      // Handle swipe gestures
      const wasSwipe = handleSwipeGesture(gestureState);

      // Handle tap gestures (if it wasn't a swipe and was quick)
      if (!wasSwipe && duration < 200) {
        handleTapGesture(evt);
      }
    },

    onPanResponderTerminate: () => {
      isGesturing.current = false;
      clearTimers();
    },

    onPanResponderReject: () => {
      isGesturing.current = false;
      clearTimers();
    },
  });

  // Animation helpers
  const createSwipeAnimation = useCallback((animatedValue, toValue, duration = 300) => {
    return Animated.timing(animatedValue, {
      toValue,
      duration,
      useNativeDriver: true,
    });
  }, []);

  const createSpringAnimation = useCallback((animatedValue, toValue, config = {}) => {
    return Animated.spring(animatedValue, {
      toValue,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
      ...config,
    });
  }, []);

  const createBounceAnimation = useCallback((animatedValue, fromValue = 0, toValue = 1, duration = 200) => {
    return Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: toValue * 1.2,
        duration: duration * 0.6,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: toValue,
        duration: duration * 0.4,
        useNativeDriver: true,
      }),
    ]);
  }, []);

  const resetGesture = useCallback(() => {
    isGesturing.current = false;
    tapCount.current = 0;
    lastTap.current = 0;
    clearTimers();
  }, []);

  return {
    panResponder,
    isGesturing: isGesturing.current,
    createSwipeAnimation,
    createSpringAnimation,
    createBounceAnimation,
    resetGesture,
  };
};

export default useGestures;