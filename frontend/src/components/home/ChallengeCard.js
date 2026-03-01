import React, { useRef } from 'react';
import { Pressable, View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Card from '../ui/Card';
import { haptics } from '../../utils/haptics';

/**
 * ChallengeCard - pressable card representing a daily or mode challenge
 * Props: title, subtitle, onPress, icon, variant ('primary'|'secondary')
 */
const ChallengeCard = ({ title, subtitle, onPress, icon, variant = 'primary' }) => {
  const { theme } = useTheme();
  const accent = variant === 'primary' ? theme.colors.primary[500] : theme.colors.secondary.emerald;
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  };
  const handlePress = () => {
  if (Platform.OS !== 'web') { haptics.impact('Light'); }
    onPress && onPress();
  };

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        style={{ flex: 1 }}
      >
        <Card elevation="md" style={[styles(theme).container, { borderLeftColor: accent }]}>        
          <View style={styles(theme).iconRow}>          
            {icon && <Text style={styles(theme).icon}>{icon}</Text>}
            <Text style={[styles(theme).tag, { color: accent }]}>{variant.toUpperCase()}</Text>
          </View>
          <Text style={styles(theme).title}>{title}</Text>
          {subtitle && <Text style={styles(theme).subtitle}>{subtitle}</Text>}
        </Card>
      </Pressable>
    </Animated.View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    borderLeftWidth: 4,
    backgroundColor: theme.colors.mode.surfaceVariant,
    gap: theme.spacing.sm,
    flex: 1,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  icon: {
    fontSize: theme.typography.sizes.lg,
  },
  tag: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    letterSpacing: 1,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.mode.textSecondary,
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.sm,
  },
});

export default React.memo(ChallengeCard);
