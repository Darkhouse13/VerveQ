import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import SkeletonLoader, { SkeletonText, SkeletonGroup } from './SkeletonLoader';

export const QuizSkeleton = ({ style, ...props }) => {
  const { theme } = useTheme();

  return (
    <View style={[styles(theme).quizContainer, style]} {...props}>
      {/* Question Header */}
      <View style={styles(theme).questionHeader}>
        <SkeletonLoader type="text" width="40%" height={16} />
        <SkeletonLoader type="circle" height={24} />
      </View>

      {/* Question Text */}
      <View style={styles(theme).questionSection}>
        <SkeletonText lines={2} lastLineWidth="75%" />
      </View>

      {/* Answer Options */}
      <View style={styles(theme).optionsContainer}>
        {Array.from({ length: 4 }).map((_, index) => (
          <View key={index} style={styles(theme).optionCard}>
            <SkeletonLoader type="circle" height={20} />
            <SkeletonLoader type="text" width="80%" style={{ marginLeft: 12 }} />
          </View>
        ))}
      </View>

      {/* Action Button */}
      <SkeletonLoader 
        type="button" 
        style={styles(theme).actionButton}
      />
    </View>
  );
};

export const LeaderboardSkeleton = ({ itemCount = 5, style, ...props }) => {
  const { theme } = useTheme();

  return (
    <View style={[styles(theme).leaderboardContainer, style]} {...props}>
      {/* Header */}
      <View style={styles(theme).headerSection}>
        <SkeletonLoader type="text" width="60%" height={20} />
        <SkeletonLoader type="rect" width={80} height={32} />
      </View>

      {/* Filter Bar */}
      <View style={styles(theme).filterBar}>
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonLoader 
            key={index}
            type="button"
            width={70}
            height={36}
            style={{ marginRight: 8 }}
          />
        ))}
      </View>

      {/* Leaderboard Items */}
      <View style={styles(theme).itemsList}>
        {Array.from({ length: itemCount }).map((_, index) => (
          <View key={index} style={styles(theme).leaderboardItem}>
            <View style={styles(theme).rankSection}>
              <SkeletonLoader type="text" width={20} height={16} />
            </View>
            <SkeletonLoader type="avatar" height={48} />
            <View style={styles(theme).userInfo}>
              <SkeletonLoader type="text" width="70%" height={16} />
              <SkeletonLoader type="text" width="50%" height={12} style={{ marginTop: 4 }} />
            </View>
            <View style={styles(theme).statsSection}>
              <SkeletonLoader type="text" width={40} height={18} />
              <SkeletonLoader type="text" width={30} height={12} style={{ marginTop: 2 }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

export const ProfileSkeleton = ({ style, ...props }) => {
  const { theme } = useTheme();

  return (
    <View style={[styles(theme).profileContainer, style]} {...props}>
      {/* Header Section */}
      <View style={styles(theme).profileHeader}>
        <View style={styles(theme).avatarSection}>
          <SkeletonLoader type="avatar" height={80} />
          <View style={styles(theme).userDetails}>
            <SkeletonLoader type="text" width={120} height={20} />
            <SkeletonLoader type="text" width={80} height={14} style={{ marginTop: 4 }} />
          </View>
        </View>
        <View style={styles(theme).actionButtons}>
          <SkeletonLoader type="button" width={80} height={36} />
          <SkeletonLoader type="button" width={80} height={36} style={{ marginLeft: 8 }} />
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles(theme).statsGrid}>
        {Array.from({ length: 3 }).map((_, index) => (
          <View key={index} style={styles(theme).statCard}>
            <SkeletonLoader type="text" width="60%" height={14} />
            <SkeletonLoader type="text" width={40} height={24} style={{ marginTop: 8 }} />
            <SkeletonLoader type="text" width="80%" height={12} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>

      {/* Chart Section */}
      <View style={styles(theme).chartSection}>
        <SkeletonLoader type="text" width="40%" height={18} />
        <SkeletonLoader type="card" height={180} style={{ marginTop: 12 }} />
      </View>

      {/* Achievements */}
      <View style={styles(theme).achievementsSection}>
        <SkeletonLoader type="text" width="50%" height={18} />
        <View style={styles(theme).achievementsList}>
          {Array.from({ length: 2 }).map((_, index) => (
            <View key={index} style={styles(theme).achievementItem}>
              <SkeletonLoader type="circle" height={40} />
              <View style={styles(theme).achievementInfo}>
                <SkeletonLoader type="text" width="70%" height={14} />
                <SkeletonLoader type="text" width="90%" height={12} style={{ marginTop: 4 }} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

export const ChallengeSkeleton = ({ itemCount = 3, style, ...props }) => {
  const { theme } = useTheme();

  return (
    <View style={[styles(theme).challengeContainer, style]} {...props}>
      {/* Create Challenge Section */}
      <View style={styles(theme).createSection}>
        <SkeletonLoader type="text" width="50%" height={20} />
        <View style={styles(theme).formSection}>
          <SkeletonLoader type="rect" height={48} style={{ marginVertical: 8 }} />
          <View style={styles(theme).optionButtons}>
            <SkeletonLoader type="button" width="45%" height={40} />
            <SkeletonLoader type="button" width="45%" height={40} />
          </View>
          <SkeletonLoader type="button" height={48} style={{ marginTop: 16 }} />
        </View>
      </View>

      {/* Pending Challenges */}
      <View style={styles(theme).pendingSection}>
        <SkeletonLoader type="text" width="60%" height={20} />
        <View style={styles(theme).challengesList}>
          {Array.from({ length: itemCount }).map((_, index) => (
            <View key={index} style={styles(theme).challengeItem}>
              <View style={styles(theme).challengeHeader}>
                <SkeletonLoader type="avatar" height={32} />
                <View style={styles(theme).challengerInfo}>
                  <SkeletonLoader type="text" width="60%" height={16} />
                  <SkeletonLoader type="text" width="40%" height={12} style={{ marginTop: 4 }} />
                </View>
                <SkeletonLoader type="text" width={60} height={12} />
              </View>
              <SkeletonLoader type="text" width="80%" height={14} style={{ marginVertical: 8 }} />
              <View style={styles(theme).challengeActions}>
                <SkeletonLoader type="button" width="45%" height={36} />
                <SkeletonLoader type="button" width="45%" height={36} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  // Quiz Skeleton Styles
  quizContainer: {
    padding: theme.spacing.lg,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  questionSection: {
    marginBottom: theme.spacing.xl,
  },
  optionsContainer: {
    marginBottom: theme.spacing.xl,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
  },
  actionButton: {
    marginTop: theme.spacing.lg,
  },

  // Leaderboard Skeleton Styles
  leaderboardContainer: {
    padding: theme.spacing.lg,
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  filterBar: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
  },
  itemsList: {
    gap: theme.spacing.md,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
  },
  rankSection: {
    width: 30,
    marginRight: theme.spacing.md,
  },
  userInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  statsSection: {
    alignItems: 'flex-end',
  },

  // Profile Skeleton Styles
  profileContainer: {
    padding: theme.spacing.lg,
  },
  profileHeader: {
    marginBottom: theme.spacing.xl,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  userDetails: {
    marginLeft: theme.spacing.lg,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  statCard: {
    flex: 1,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
  },
  chartSection: {
    marginBottom: theme.spacing.xl,
  },
  achievementsSection: {
    marginBottom: theme.spacing.xl,
  },
  achievementsList: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  achievementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
  },
  achievementInfo: {
    marginLeft: theme.spacing.md,
    flex: 1,
  },

  // Challenge Skeleton Styles
  challengeContainer: {
    padding: theme.spacing.lg,
  },
  createSection: {
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
  },
  formSection: {
    marginTop: theme.spacing.lg,
  },
  optionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: theme.spacing.md,
  },
  pendingSection: {
    marginBottom: theme.spacing.xl,
  },
  challengesList: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  challengeItem: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  challengerInfo: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  challengeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export default {
  QuizSkeleton,
  LeaderboardSkeleton,
  ProfileSkeleton,
  ChallengeSkeleton,
};