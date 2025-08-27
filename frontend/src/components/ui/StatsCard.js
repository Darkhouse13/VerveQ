import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Card from './Card';

const StatsCard = ({
  stats = {},
  style,
  showAnimatedCounters = true,
  ...props
}) => {
  const { theme, styles: themeStyles } = useTheme();
  const [animatedStats, setAnimatedStats] = useState({
    gamesPlayed: 0,
    currentStreak: 0,
    bestScore: 0,
  });

  // Animate numbers counting up
  useEffect(() => {
    if (!showAnimatedCounters) {
      setAnimatedStats({
        gamesPlayed: stats.gamesPlayed || 0,
        currentStreak: stats.currentStreak || 0,
        bestScore: stats.bestScore || 0,
      });
      return;
    }

    const duration = 1000; // 1 second animation
    const steps = 30;
    const interval = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const easeOut = 1 - Math.pow(1 - progress, 3); // Easing function

      setAnimatedStats({
        gamesPlayed: Math.round((stats.gamesPlayed || 0) * easeOut),
        currentStreak: Math.round((stats.currentStreak || 0) * easeOut),
        bestScore: Math.round((stats.bestScore || 0) * easeOut),
      });

      if (currentStep >= steps) {
        clearInterval(timer);
        setAnimatedStats({
          gamesPlayed: stats.gamesPlayed || 0,
          currentStreak: stats.currentStreak || 0,
          bestScore: stats.bestScore || 0,
        });
      }
    }, interval);

    return () => clearInterval(timer);
  }, [stats, showAnimatedCounters]);

  const getStreakColor = (streak) => {
    if (streak >= 10) return theme.colors.success.light;
    if (streak >= 5) return theme.colors.secondary.amber;
    if (streak >= 2) return theme.colors.primary[500];
    return theme.colors.mode.textSecondary;
  };

  const getScoreGrade = (score) => {
    if (score >= 90) return { grade: 'S', color: theme.colors.success.light };
    if (score >= 80) return { grade: 'A', color: theme.colors.secondary.emerald };
    if (score >= 70) return { grade: 'B', color: theme.colors.secondary.amber };
    if (score >= 60) return { grade: 'C', color: theme.colors.warning.light };
    return { grade: 'D', color: theme.colors.error.light };
  };

  return (
    <Card elevation="md" style={[styles(theme).container, style]} {...props}>
      <Text style={[themeStyles.heading3, styles(theme).title]}>
        Your Stats
      </Text>
      
      <View style={styles(theme).statsRow}>
        {/* Games Played */}
        <View style={styles(theme).statItem}>
          <Text style={[styles(theme).statValue, { color: theme.colors.primary[500] }]}>
            {animatedStats.gamesPlayed}
          </Text>
          <Text style={[themeStyles.caption, styles(theme).statLabel]}>
            Games
          </Text>
        </View>

        {/* Current Streak */}
        <View style={styles(theme).statItem}>
          <View style={styles(theme).streakContainer}>
            <Text style={[styles(theme).statValue, { color: getStreakColor(animatedStats.currentStreak) }]}>
              {animatedStats.currentStreak}
            </Text>
            {animatedStats.currentStreak >= 3 && (
              <Text style={styles(theme).streakFire}>🔥</Text>
            )}
          </View>
          <Text style={[themeStyles.caption, styles(theme).statLabel]}>
            Streak
          </Text>
        </View>

        {/* Best Score */}
        <View style={styles(theme).statItem}>
          <View style={styles(theme).scoreContainer}>
            <Text style={[styles(theme).statValue, { color: getScoreGrade(animatedStats.bestScore).color }]}>
              {animatedStats.bestScore}
            </Text>
            <View style={[styles(theme).gradeBadge, { backgroundColor: getScoreGrade(animatedStats.bestScore).color }]}>
              <Text style={styles(theme).gradeText}>
                {getScoreGrade(animatedStats.bestScore).grade}
              </Text>
            </View>
          </View>
          <Text style={[themeStyles.caption, styles(theme).statLabel]}>
            Best Score
          </Text>
        </View>
      </View>

      {/* Progress Indicators */}
      {stats.recentPerformance && (
        <View style={styles(theme).progressContainer}>
          <Text style={[themeStyles.caption, styles(theme).progressLabel]}>
            Recent Performance
          </Text>
          <View style={styles(theme).progressBar}>
            <View 
              style={[
                styles(theme).progressFill, 
                { 
                  width: `${Math.min(100, (stats.recentPerformance / 100) * 100)}%`,
                  backgroundColor: stats.recentPerformance >= 70 
                    ? theme.colors.success.light 
                    : stats.recentPerformance >= 50 
                    ? theme.colors.secondary.amber 
                    : theme.colors.error.light
                }
              ]} 
            />
          </View>
          <Text style={[themeStyles.caption, styles(theme).progressPercentage]}>
            {stats.recentPerformance}% avg
          </Text>
        </View>
      )}
    </Card>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    paddingVertical: theme.spacing.lg,
  },
  title: {
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.md,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    lineHeight: theme.typography.lineHeights.tight * theme.typography.sizes['2xl'],
  },
  statLabel: {
    marginTop: theme.spacing.xs,
    color: theme.colors.mode.textSecondary,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  streakFire: {
    fontSize: theme.typography.sizes.md,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  gradeBadge: {
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  gradeText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    color: '#ffffff',
  },
  progressContainer: {
    marginTop: theme.spacing.md,
  },
  progressLabel: {
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
    color: theme.colors.mode.textSecondary,
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
    borderRadius: theme.borderRadius.sm,
  },
  progressPercentage: {
    textAlign: 'center',
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.mode.textSecondary,
  },
});

export default StatsCard;