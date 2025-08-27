import React, { useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Card from '../ui/Card';
import { haptics } from '../../utils/haptics';

/**
 * FeaturedGameCard - large promotional card with CTA
 * Props: tag, title, subtitle, onPlay, progress (0-1), accentColor
 */
const FeaturedGameCard = ({ tag, title, subtitle, onPlay, progress, accentColor }) => {
  const { theme } = useTheme();
  const accent = accentColor || theme.colors.primary[500];
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  const handlePress = () => { if (Platform.OS !== 'web') { haptics.impact('Medium'); } onPlay && onPlay(); };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Card elevation="lg" pressable={false} style={styles(theme).container}>
        {tag && <Text style={[styles(theme).tag, { color: accent }]}>{tag.toUpperCase()}</Text>}
        <Text style={styles(theme).title}>{title}</Text>
        {subtitle && <Text style={styles(theme).subtitle}>{subtitle}</Text>}
        {progress != null && (
          <View style={styles(theme).progressBar}>
            <View style={[styles(theme).progressFill, { width: `${Math.min(100, progress * 100)}%`, backgroundColor: accent }]} />
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={handlePress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[styles(theme).cta, { backgroundColor: accent }] }
        >
          <Text style={styles(theme).ctaText}>Play Now</Text>
        </Pressable>
      </Card>
    </Animated.View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius['2xl'],
    backgroundColor: theme.colors.mode.surfaceVariant,
    overflow: 'hidden',
    gap: theme.spacing.md,
  },
  tag: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    letterSpacing: 1,
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
    lineHeight: theme.typography.lineHeights.tight * theme.typography.sizes['2xl'],
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.mode.textSecondary,
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.sm,
  },
  progressBar: {
    height: 6,
    backgroundColor: theme.colors.mode.border,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
  },
  cta: {
    marginTop: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: {
    color: '#ffffff',
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
  },
});

export default React.memo(FeaturedGameCard);
