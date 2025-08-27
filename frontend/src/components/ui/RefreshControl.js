import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Animated,
  PanResponder,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import useRefresh from '../../hooks/useRefresh';

const RefreshControl = ({
  onRefresh,
  refreshing: externalRefreshing = false,
  children,
  pullDistance = 100,
  triggerDistance = 60,
  enabled = true,
  tintColor,
  title,
  titleColor,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const [pullDistance_, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  
  const translateY = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  
  const isGesturing = useRef(false);
  const lastOffset = useRef(0);

  const { refresh, refreshing: hookRefreshing } = useRefresh({
    onRefresh: async () => {
      setRefreshing(true);
      try {
        await onRefresh?.();
      } finally {
        setRefreshing(false);
      }
    },
  });

  const isRefreshing = refreshing || externalRefreshing || hookRefreshing;

  useEffect(() => {
    if (isRefreshing) {
      startRefreshAnimation();
    } else {
      endRefreshAnimation();
    }
  }, [isRefreshing]);

  const startRefreshAnimation = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: triggerDistance,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      ),
    ]).start();
  };

  const endRefreshAnimation = () => {
    rotateAnim.stopAnimation();
    
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      rotateAnim.setValue(0);
    });
  };

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (evt, gestureState) => {
      return enabled && !isRefreshing && gestureState.dy > 0;
    },
    
    onPanResponderGrant: () => {
      isGesturing.current = true;
      lastOffset.current = 0;
    },

    onPanResponderMove: (evt, gestureState) => {
      const distance = Math.max(0, gestureState.dy);
      setPullDistance(distance);

      // Update animations based on pull distance
      const progress = Math.min(distance / triggerDistance, 1);
      
      translateY.setValue(distance * 0.5); // Damped movement
      scaleAnim.setValue(progress);
      opacityAnim.setValue(progress);
      rotateAnim.setValue(progress);
    },

    onPanResponderRelease: (evt, gestureState) => {
      const distance = Math.max(0, gestureState.dy);
      isGesturing.current = false;
      
      if (enabled && distance >= triggerDistance && !isRefreshing) {
        // Trigger refresh
        refresh();
      } else {
        // Reset animation
        endRefreshAnimation();
      }
      
      setPullDistance(0);
      lastOffset.current = 0;
    },

    onPanResponderTerminate: () => {
      isGesturing.current = false;
      endRefreshAnimation();
      setPullDistance(0);
    },
  });

  const getRefreshIcon = () => {
    const sportIcons = ['⚽', '🎾', '🏀', '🏈'];
    const randomIcon = sportIcons[Math.floor(Math.random() * sportIcons.length)];
    return randomIcon;
  };

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles(theme).container, style]} {...props}>
      {/* Pull to Refresh Indicator */}
      <Animated.View
        style={[
          styles(theme).refreshIndicator,
          {
            transform: [
              { translateY: translateY },
              { scale: scaleAnim },
              { rotate: isRefreshing ? rotateInterpolate : '0deg' },
            ],
            opacity: opacityAnim,
          },
        ]}
      >
        <View style={styles(theme).indicatorContent}>
          <Text style={[
            styles(theme).refreshIcon,
            tintColor && { color: tintColor }
          ]}>
            {isRefreshing ? '🔄' : getRefreshIcon()}
          </Text>
          
          {title && (
            <Text style={[
              styles(theme).refreshTitle,
              titleColor && { color: titleColor }
            ]}>
              {isRefreshing ? 'Refreshing...' : title}
            </Text>
          )}
        </View>

        {/* Progress Indicator */}
        <View style={styles(theme).progressContainer}>
          <View style={[
            styles(theme).progressBar,
            {
              width: `${Math.min((pullDistance_ / triggerDistance) * 100, 100)}%`,
              backgroundColor: tintColor || theme.colors.primary[500],
            }
          ]} />
        </View>
      </Animated.View>

      {/* Content */}
      <Animated.View 
        style={styles(theme).content}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
};

// Simplified version without gesture handler for compatibility
export const SimpleRefreshControl = ({
  refreshing,
  onRefresh,
  tintColor,
  title,
  size = 'default',
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let animation;
    if (refreshing) {
      animation = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      animation.start();
    }
    
    return () => {
      if (animation) {
        animation.stop();
        rotateAnim.setValue(0);
      }
    };
  }, [refreshing]);

  if (!refreshing) return null;

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const iconSize = size === 'small' ? 16 : size === 'large' ? 32 : 24;

  return (
    <View style={[styles(theme).simpleContainer, style]} {...props}>
      <Animated.Text
        style={[
          styles(theme).simpleIcon,
          {
            fontSize: iconSize,
            color: tintColor || theme.colors.primary[500],
            transform: [{ rotate: rotateInterpolate }],
          },
        ]}
      >
        🔄
      </Animated.Text>
      
      {title && (
        <Text style={[
          styles(theme).simpleTitle,
          tintColor && { color: tintColor }
        ]}>
          {title}
        </Text>
      )}
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  refreshIndicator: {
    position: 'absolute',
    top: -80,
    left: 0,
    right: 0,
    height: 80,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: theme.spacing.md,
    zIndex: 1,
  },
  indicatorContent: {
    alignItems: 'center',
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    ...theme.elevation.sm,
  },
  refreshIcon: {
    fontSize: 24,
    marginBottom: theme.spacing.xs,
  },
  refreshTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.mode.textSecondary,
  },
  progressContainer: {
    width: 60,
    height: 2,
    backgroundColor: theme.colors.mode.border,
    borderRadius: 1,
    marginTop: theme.spacing.sm,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 1,
  },
  simpleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  simpleIcon: {
    marginRight: theme.spacing.sm,
  },
  simpleTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.mode.textSecondary,
  },
});

export default RefreshControl;