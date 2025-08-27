import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated,
  Share
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const AchievementCard = ({
  achievement,
  isUnlocked = false,
  progress = 0,
  showProgress = true,
  showShare = true,
  onPress,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const [shimmerAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(isUnlocked ? 1 : 0.95));
  const [progressAnim] = useState(new Animated.Value(0));

  const rarityConfig = {
    'common': {
      color: theme.colors.neutral[400],
      bgColor: theme.colors.neutral[50],
      borderColor: theme.colors.neutral[200],
      label: 'Common'
    },
    'rare': {
      color: theme.colors.secondary.emerald,
      bgColor: theme.colors.secondary.emeraldLight + '20',
      borderColor: theme.colors.secondary.emerald + '40',
      label: 'Rare'
    },
    'epic': {
      color: theme.colors.secondary.coral,
      bgColor: theme.colors.secondary.coralLight + '20',
      borderColor: theme.colors.secondary.coral + '40',
      label: 'Epic'
    },
    'legendary': {
      color: theme.colors.secondary.amber,
      bgColor: '#fff3cd',
      borderColor: theme.colors.secondary.amber + '60',
      label: 'Legendary'
    }
  };

  const rarity = achievement.rarity || 'common';
  const config = rarityConfig[rarity];

  useEffect(() => {
    if (isUnlocked) {
      // Shimmer effect for unlocked achievements
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Scale animation for unlock
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }

    // Progress animation
    if (showProgress && progress > 0) {
      Animated.timing(progressAnim, {
        toValue: progress,
        duration: 1000,
        useNativeDriver: false,
      }).start();
    }
  }, [isUnlocked, progress]);

  const shareAchievement = async () => {
    try {
      const message = `🏆 I just unlocked "${achievement.name}" on VerveQ! ${achievement.icon}\n\n${achievement.description}`;
      
      await Share.share({
        message,
        title: 'Achievement Unlocked!'
      });
    } catch (error) {
      console.warn('Failed to share achievement:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Animated.View
      style={[
        styles(theme, config).container,
        !isUnlocked && styles(theme).lockedContainer,
        { transform: [{ scale: scaleAnim }] },
        style
      ]}
      {...props}
    >
      <TouchableOpacity
        style={styles(theme).touchable}
        onPress={onPress}
        activeOpacity={0.8}
        disabled={!isUnlocked}
      >
        {/* Shimmer Effect */}
        {isUnlocked && (
          <Animated.View
            style={[
              styles(theme).shimmerOverlay,
              {
                opacity: shimmerAnim.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.3, 0],
                }),
                transform: [{
                  translateX: shimmerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-100, 100],
                  })
                }]
              }
            ]}
          />
        )}

        {/* Achievement Content */}
        <View style={styles(theme).content}>
          {/* Icon and Rarity */}
          <View style={styles(theme).header}>
            <View style={styles(theme, config).iconContainer}>
              <Text style={[styles(theme).icon, !isUnlocked && styles(theme).lockedIcon]}>
                {isUnlocked ? achievement.icon : '🔒'}
              </Text>
            </View>
            
            <View style={[styles(theme, config).rarityBadge]}>
              <Text style={[styles(theme, config).rarityText]}>
                {config.label}
              </Text>
            </View>
          </View>

          {/* Achievement Info */}
          <View style={styles(theme).info}>
            <Text style={[styles(theme).name, !isUnlocked && styles(theme).lockedText]}>
              {isUnlocked ? achievement.name : '???'}
            </Text>
            <Text style={[styles(theme).description, !isUnlocked && styles(theme).lockedText]}>
              {isUnlocked ? achievement.description : 'This achievement is locked'}
            </Text>
            
            {isUnlocked && achievement.unlocked_at && (
              <Text style={styles(theme).unlockedDate}>
                Unlocked {formatDate(achievement.unlocked_at)}
              </Text>
            )}
          </View>

          {/* Progress Bar */}
          {showProgress && !isUnlocked && (
            <View style={styles(theme).progressContainer}>
              <View style={styles(theme).progressBar}>
                <Animated.View
                  style={[
                    styles(theme, config).progressFill,
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
                {Math.round(progress)}% Complete
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          {isUnlocked && showShare && (
            <View style={styles(theme).actions}>
              <TouchableOpacity
                style={styles(theme, config).shareButton}
                onPress={shareAchievement}
                activeOpacity={0.8}
              >
                <Text style={styles(theme).shareText}>Share</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = (theme, config = {}) => StyleSheet.create({
  container: {
    backgroundColor: config.bgColor || theme.colors.mode.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: config.borderColor || theme.colors.mode.border,
    marginVertical: theme.spacing.sm,
    overflow: 'hidden',
    ...theme.elevation.sm,
  },
  lockedContainer: {
    backgroundColor: theme.colors.neutral[50],
    borderColor: theme.colors.neutral[200],
    opacity: 0.7,
  },
  touchable: {
    position: 'relative',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    zIndex: 1,
  },
  content: {
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: config.color || theme.colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.elevation.xs,
  },
  icon: {
    fontSize: 24,
  },
  lockedIcon: {
    fontSize: 20,
    opacity: 0.6,
  },
  rarityBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    backgroundColor: config.color || theme.colors.neutral[300],
  },
  rarityText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  info: {
    marginBottom: theme.spacing.md,
  },
  name: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
    marginBottom: theme.spacing.xs,
  },
  description: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.mode.textSecondary,
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.md,
    marginBottom: theme.spacing.sm,
  },
  lockedText: {
    color: theme.colors.neutral[400],
  },
  unlockedDate: {
    fontSize: theme.typography.sizes.sm,
    color: config.color || theme.colors.primary[500],
    fontWeight: theme.typography.weights.medium,
  },
  progressContainer: {
    marginBottom: theme.spacing.md,
  },
  progressBar: {
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
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.mode.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  actions: {
    alignItems: 'flex-end',
  },
  shareButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: config.color || theme.colors.primary[500],
  },
  shareText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: '#ffffff',
  },
});

export default AchievementCard;