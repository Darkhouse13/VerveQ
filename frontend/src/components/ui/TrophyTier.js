import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const TrophyTier = ({
  tier = 'Beginner',
  currentPoints = 0,
  nextTierPoints = 100,
  size = 'medium',
  showProgress = true,
  animated = true,
  ...props
}) => {
  const { theme } = useTheme();
  const [scaleAnim] = useState(new Animated.Value(animated ? 0.8 : 1));
  const [progressAnim] = useState(new Animated.Value(0));

  const tierConfig = {
    'Novice': { 
      icon: '🥉', 
      color: theme.colors.neutral[400],
      gradient: [theme.colors.neutral[300], theme.colors.neutral[500]],
      textColor: theme.colors.neutral[700]
    },
    'Beginner': { 
      icon: '🥉', 
      color: '#cd7f32',
      gradient: ['#daa520', '#cd7f32'],
      textColor: '#8b4513'
    },
    'Intermediate': { 
      icon: '🥈', 
      color: '#c0c0c0',
      gradient: ['#e8e8e8', '#c0c0c0'],
      textColor: '#808080'
    },
    'Advanced': { 
      icon: '🥈', 
      color: theme.colors.secondary.emerald,
      gradient: [theme.colors.secondary.emeraldLight, theme.colors.secondary.emerald],
      textColor: theme.colors.secondary.emeraldDark
    },
    'Expert': { 
      icon: '🥇', 
      color: '#ffd700',
      gradient: ['#ffed4a', '#ffd700'],
      textColor: '#b7791f'
    },
    'Master': { 
      icon: '🏆', 
      color: theme.colors.secondary.coral,
      gradient: [theme.colors.secondary.coralLight, theme.colors.secondary.coral],
      textColor: theme.colors.secondary.coralDark
    },
    'Grandmaster': { 
      icon: '👑', 
      color: '#ff6b6b',
      gradient: ['#ff8e8e', '#ff6b6b'],
      textColor: '#c92a2a'
    }
  };

  const config = tierConfig[tier] || tierConfig['Beginner'];
  const progress = Math.min((currentPoints / nextTierPoints) * 100, 100);

  const sizes = {
    small: {
      container: 40,
      icon: 16,
      text: 10
    },
    medium: {
      container: 60,
      icon: 24,
      text: 12
    },
    large: {
      container: 80,
      icon: 32,
      text: 14
    }
  };

  const sizeConfig = sizes[size];

  useEffect(() => {
    if (animated) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }

    if (showProgress) {
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 1000,
        useNativeDriver: false,
      }).start();
    }
  }, [animated, showProgress, progress]);

  return (
    <View style={[styles(theme, sizeConfig).container, props.style]}>
      <Animated.View
        style={[
          styles(theme, sizeConfig, config).badge,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        <Text style={styles(theme, sizeConfig).icon}>{config.icon}</Text>
        <Text style={[styles(theme, sizeConfig, config).tierText]}>
          {tier.toUpperCase()}
        </Text>
      </Animated.View>

      {showProgress && (
        <View style={styles(theme).progressContainer}>
          <View style={styles(theme).progressBar}>
            <Animated.View
              style={[
                styles(theme, sizeConfig, config).progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles(theme).progressText}>
            {Math.round(progress)}% to {getNextTier(tier)}
          </Text>
        </View>
      )}
    </View>
  );
};

const getNextTier = (currentTier) => {
  const tiers = ['Novice', 'Beginner', 'Intermediate', 'Advanced', 'Expert', 'Master', 'Grandmaster'];
  const currentIndex = tiers.indexOf(currentTier);
  return currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : 'Max Level';
};

const styles = (theme, sizeConfig = {}, config = {}) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: sizeConfig.container,
    height: sizeConfig.container,
    borderRadius: (sizeConfig.container || 60) / 2,
    backgroundColor: config.color || theme.colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.elevation.md,
    borderWidth: 2,
    borderColor: theme.colors.mode.background,
  },
  icon: {
    fontSize: sizeConfig.icon,
    marginBottom: 2,
  },
  tierText: {
    fontSize: sizeConfig.text,
    fontWeight: theme.typography.weights.bold,
    color: config.textColor || theme.colors.mode.text,
    textAlign: 'center',
    lineHeight: sizeConfig.text * 1.2,
  },
  progressContainer: {
    marginTop: theme.spacing.sm,
    width: '100%',
    alignItems: 'center',
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: theme.colors.mode.border,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: config.color || theme.colors.primary[500],
    borderRadius: theme.borderRadius.sm,
  },
  progressText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.mode.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
});

export default TrophyTier;