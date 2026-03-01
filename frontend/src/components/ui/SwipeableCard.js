import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import useGestures from '../../hooks/useGestures';

const { width: screenWidth } = Dimensions.get('window');

const SwipeableCard = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  swipeThreshold = 100,
  snapBackThreshold = 50,
  leftActionColor = '#ff4444',
  rightActionColor = '#44ff44',
  leftActionIcon = '❌',
  rightActionIcon = '✅',
  leftActionText = 'Delete',
  rightActionText = 'Archive',
  disabled = false,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const [swiping, setSwiping] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState(null);
  
  const translateX = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const leftActionOpacity = useRef(new Animated.Value(0)).current;
  const rightActionOpacity = useRef(new Animated.Value(0)).current;

  const handleSwipeLeft = ({ dx, vx }) => {
    if (disabled) return;
    
    const shouldTrigger = Math.abs(dx) > swipeThreshold || Math.abs(vx) > 0.5;
    
    if (shouldTrigger) {
      triggerLeftAction();
    } else {
      snapBack();
    }
  };

  const handleSwipeRight = ({ dx, vx }) => {
    if (disabled) return;
    
    const shouldTrigger = Math.abs(dx) > swipeThreshold || Math.abs(vx) > 0.5;
    
    if (shouldTrigger) {
      triggerRightAction();
    } else {
      snapBack();
    }
  };

  const { panResponder } = useGestures({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    swipeThreshold: snapBackThreshold,
    enabled: !disabled,
  });

  // Custom pan responder for smoother swipe tracking
  const customPanResponder = {
    ...panResponder,
    panHandlers: {
      ...panResponder.panHandlers,
      onPanResponderMove: (evt, gestureState) => {
        if (disabled) return;
        
        const { dx } = gestureState;
        const clampedDx = Math.max(-screenWidth * 0.7, Math.min(screenWidth * 0.7, dx));
        
        translateX.setValue(clampedDx);
        
        // Update action opacities based on swipe distance
        const progress = Math.abs(clampedDx) / swipeThreshold;
        
        if (clampedDx < 0) {
          // Swiping left - show left action
          leftActionOpacity.setValue(Math.min(progress, 1));
          rightActionOpacity.setValue(0);
          setSwipeDirection('left');
        } else if (clampedDx > 0) {
          // Swiping right - show right action
          rightActionOpacity.setValue(Math.min(progress, 1));
          leftActionOpacity.setValue(0);
          setSwipeDirection('right');
        } else {
          leftActionOpacity.setValue(0);
          rightActionOpacity.setValue(0);
          setSwipeDirection(null);
        }
        
        setSwiping(Math.abs(clampedDx) > 10);
      },
      
      onPanResponderRelease: (evt, gestureState) => {
        const { dx, vx } = gestureState;
        const shouldTriggerAction = Math.abs(dx) > swipeThreshold || Math.abs(vx) > 0.5;
        
        if (shouldTriggerAction) {
          if (dx < 0) {
            triggerLeftAction();
          } else {
            triggerRightAction();
          }
        } else {
          snapBack();
        }
      },
    },
  };

  const triggerLeftAction = () => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -screenWidth,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (leftAction) {
        leftAction();
      } else {
        onSwipeLeft?.();
      }
      resetCard();
    });
  };

  const triggerRightAction = () => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: screenWidth,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (rightAction) {
        rightAction();
      } else {
        onSwipeRight?.();
      }
      resetCard();
    });
  };

  const snapBack = () => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(leftActionOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(rightActionOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSwiping(false);
      setSwipeDirection(null);
    });
  };

  const resetCard = () => {
    translateX.setValue(0);
    scaleAnim.setValue(1);
    leftActionOpacity.setValue(0);
    rightActionOpacity.setValue(0);
    setSwiping(false);
    setSwipeDirection(null);
  };

  // Programmatic swipe methods
  const swipeLeft = () => triggerLeftAction();
  const swipeRight = () => triggerRightAction();
  const reset = () => snapBack();

  return (
    <View style={[styles(theme).container, style]} {...props}>
      {/* Left Action Background */}
      <Animated.View
        style={[
          styles(theme).actionBackground,
          styles(theme).leftAction,
          {
            backgroundColor: leftActionColor,
            opacity: leftActionOpacity,
          },
        ]}
      >
        <View style={styles(theme).actionContent}>
          <Text style={styles(theme).actionIcon}>{leftActionIcon}</Text>
          <Text style={styles(theme).actionText}>{leftActionText}</Text>
        </View>
      </Animated.View>

      {/* Right Action Background */}
      <Animated.View
        style={[
          styles(theme).actionBackground,
          styles(theme).rightAction,
          {
            backgroundColor: rightActionColor,
            opacity: rightActionOpacity,
          },
        ]}
      >
        <View style={styles(theme).actionContent}>
          <Text style={styles(theme).actionIcon}>{rightActionIcon}</Text>
          <Text style={styles(theme).actionText}>{rightActionText}</Text>
        </View>
      </Animated.View>

      {/* Main Card Content */}
      <Animated.View
        style={[
          styles(theme).card,
          {
            transform: [
              { translateX: translateX },
              { scale: scaleAnim },
            ],
          },
          swiping && styles(theme).cardSwiping,
        ]}
        {...customPanResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

export const SwipeableList = ({ 
  data, 
  renderItem, 
  onSwipeLeft,
  onSwipeRight,
  leftAction,
  rightAction,
  ...swipeProps 
}) => {
  return (
    <View style={{ flex: 1 }}>
      {data.map((item, index) => (
        <SwipeableCard
          key={item.id || index}
          onSwipeLeft={() => onSwipeLeft?.(item, index)}
          onSwipeRight={() => onSwipeRight?.(item, index)}
          leftAction={() => leftAction?.(item, index)}
          rightAction={() => rightAction?.(item, index)}
          {...swipeProps}
        >
          {renderItem(item, index)}
        </SwipeableCard>
      ))}
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: theme.spacing.sm,
  },
  actionBackground: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '100%',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  leftAction: {
    alignItems: 'flex-end',
  },
  rightAction: {
    alignItems: 'flex-start',
  },
  actionContent: {
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: theme.spacing.xs,
  },
  actionText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.onPrimary,
  },
  card: {
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.lg,
    ...theme.elevation.sm,
  },
  cardSwiping: {
    ...theme.elevation.md,
  },
});

export default SwipeableCard;
