import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  Dimensions
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const { width: screenWidth } = Dimensions.get('window');

const SkeletonLoader = ({
  type = 'rect',
  width = '100%',
  height = 20,
  borderRadius,
  style,
  animationSpeed = 1000,
  shimmerColors,
  ...props
}) => {
  const { theme } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(-1)).current;

  const defaultColors = shimmerColors || [
    theme.colors.mode.border,
    theme.colors.mode.background,
    theme.colors.mode.border
  ];

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: animationSpeed,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: -1,
          duration: animationSpeed,
          useNativeDriver: false,
        }),
      ])
    );
    
    animation.start();
    return () => animation.stop();
  }, [animationSpeed]);

  const getTypeStyles = () => {
    switch (type) {
      case 'circle':
        const size = typeof height === 'number' ? height : 20;
        return {
          width: size,
          height: size,
          borderRadius: size / 2,
        };
      case 'text':
        return {
          height: theme.typography.sizes.md * theme.typography.lineHeights.normal,
          borderRadius: theme.borderRadius.sm,
        };
      case 'avatar':
        const avatarSize = typeof height === 'number' ? height : 40;
        return {
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
        };
      case 'button':
        return {
          height: 48,
          borderRadius: theme.borderRadius.md,
        };
      case 'card':
        return {
          height: 120,
          borderRadius: theme.borderRadius.lg,
        };
      case 'rect':
      default:
        return {
          borderRadius: borderRadius || theme.borderRadius.sm,
        };
    }
  };

  const shimmerTransform = shimmerAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-screenWidth, screenWidth],
  });

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [-1, -0.5, 0, 0.5, 1],
    outputRange: [0, 0.3, 0.8, 0.3, 0],
  });

  return (
    <View
      style={[
        styles(theme).container,
        {
          width,
          height,
        },
        getTypeStyles(),
        { backgroundColor: defaultColors[0] },
        style
      ]}
      {...props}
    >
      <Animated.View
        style={[
          styles(theme).shimmer,
          {
            transform: [{ translateX: shimmerTransform }],
            opacity: shimmerOpacity,
          }
        ]}
      />
    </View>
  );
};

export const SkeletonGroup = ({ children, loading = true, fallback }) => {
  if (!loading && fallback) {
    return fallback;
  }
  
  if (!loading) {
    return children;
  }
  
  return (
    <View style={{ opacity: 0.6 }}>
      {children}
    </View>
  );
};

export const SkeletonText = ({ lines = 1, lastLineWidth = '60%', ...props }) => {
  return (
    <View style={styles().textContainer}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonLoader
          key={index}
          type="text"
          width={index === lines - 1 ? lastLineWidth : '100%'}
          style={{ marginBottom: index < lines - 1 ? 8 : 0 }}
          {...props}
        />
      ))}
    </View>
  );
};

export const SkeletonPulse = ({ children, loading = true, pulseColor }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const { theme } = useTheme();

  useEffect(() => {
    if (loading) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [loading]);

  if (!loading) {
    return children;
  }

  return (
    <Animated.View
      style={[
        { opacity: pulseAnim },
        pulseColor && { backgroundColor: pulseColor }
      ]}
    >
      {children}
    </Animated.View>
  );
};

const styles = (theme = {}) => StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors?.mode?.surface || '#ffffff',
    opacity: 0.3,
  },
  textContainer: {
    flexDirection: 'column',
  },
});

export default SkeletonLoader;