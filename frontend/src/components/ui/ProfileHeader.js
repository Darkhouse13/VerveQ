import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated,
  Modal,
  Share
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Button from './Button';
import StatsCard from './StatsCard';

const ProfileHeader = ({
  user,
  profile,
  isOwnProfile = false,
  onEdit,
  onChallenge,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const [slideAnim] = useState(new Animated.Value(0));
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, []);

  const getBackgroundGradient = () => {
    // Determine background based on user's highest tier or stats
    const highestTier = profile?.ratings?.[0]?.tier?.tier || 'Beginner';
    const gradients = {
      'Grandmaster': [theme.colors.secondary.coral, theme.colors.secondary.coralDark],
      'Master': [theme.colors.secondary.emerald, theme.colors.secondary.emeraldDark],
      'Expert': [theme.colors.secondary.amber, '#b7791f'],
      'Advanced': [theme.colors.primary[400], theme.colors.primary[600]],
      'Intermediate': [theme.colors.primary[300], theme.colors.primary[500]],
      'Beginner': [theme.colors.neutral[300], theme.colors.neutral[500]],
      'Novice': [theme.colors.neutral[200], theme.colors.neutral[400]],
    };
    return gradients[highestTier] || gradients['Beginner'];
  };

  const shareProfile = async () => {
    try {
      const message = `Check out ${user.display_name}'s profile on VerveQ! 🏆\n${profile?.ratings?.length || 0} sports played • ${user.total_games || 0} total games`;
      
      await Share.share({
        message,
        title: 'VerveQ Profile'
      });
    } catch (error) {
      console.warn('Failed to share profile:', error);
    }
  };

  const getTotalWins = () => {
    return profile?.ratings?.reduce((total, rating) => total + (rating.wins || 0), 0) || 0;
  };

  const getWinRate = () => {
    const totalGames = user.total_games || 0;
    const totalWins = getTotalWins();
    return totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;
  };

  const getBestScore = () => {
    return profile?.ratings?.reduce((best, rating) => 
      Math.max(best, rating.best_score || 0), 0) || 0;
  };

  const getQuickStats = () => ({
    gamesPlayed: user.total_games || 0,
    currentStreak: profile?.current_streak || 0,
    bestScore: getBestScore(),
    recentPerformance: getWinRate(),
  });

  return (
    <Animated.View
      style={[
        styles(theme).container,
        {
          transform: [{
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-50, 0],
            })
          }],
          opacity: slideAnim,
        },
        style
      ]}
      {...props}
    >
      {/* Background Gradient */}
      <View style={[styles(theme).backgroundGradient, { backgroundColor: getBackgroundGradient()[0] }]} />
      
      {/* Header Content */}
      <View style={styles(theme).headerContent}>
        {/* Avatar Section */}
        <View style={styles(theme).avatarSection}>
          <View style={styles(theme).avatarContainer}>
            <Text style={styles(theme).avatarText}>
              {user.display_name.charAt(0).toUpperCase()}
            </Text>
            {isOwnProfile && (
              <TouchableOpacity
                style={styles(theme).editOverlay}
                onPress={() => setShowEditModal(true)}
              >
                <Text style={styles(theme).editIcon}>✏️</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <Text style={styles(theme).displayName}>{user.display_name}</Text>
          <Text style={styles(theme).username}>@{user.username}</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles(theme).statsSection}>
          <StatsCard
            stats={getQuickStats()}
            showAnimatedCounters={false}
            style={styles(theme).statsCard}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles(theme).actionButtons}>
          {isOwnProfile ? (
            <>
              <Button
                title="Edit Profile"
                variant="outline"
                size="medium"
                onPress={() => setShowEditModal(true)}
                style={styles(theme).actionButton}
              />
              <Button
                title="Share Profile"
                variant="secondary"
                size="medium"
                onPress={shareProfile}
                style={styles(theme).actionButton}
              />
            </>
          ) : (
            <>
              <Button
                title="Challenge"
                variant="primary"
                size="medium"
                onPress={() => onChallenge?.(user)}
                style={styles(theme).actionButton}
              />
              <Button
                title="Share Profile"
                variant="outline"
                size="medium"
                onPress={shareProfile}
                style={styles(theme).actionButton}
              />
            </>
          )}
        </View>
      </View>

      {/* Edit Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles(theme).modalContainer}>
          <View style={styles(theme).modalHeader}>
            <Text style={styles(theme).modalTitle}>Edit Profile</Text>
            <TouchableOpacity
              onPress={() => setShowEditModal(false)}
              style={styles(theme).modalClose}
            >
              <Text style={styles(theme).modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles(theme).modalContent}>
            <Text style={styles(theme).modalMessage}>
              Profile editing features coming soon! 🚀
            </Text>
            <Text style={styles(theme).modalSubtext}>
              You'll be able to customize your avatar, background, and more.
            </Text>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
    ...theme.elevation.lg,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '60%',
    opacity: 0.1,
  },
  headerContent: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: theme.spacing.md,
  },
  avatarText: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary[500],
    color: theme.colors.onPrimary,
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    textAlign: 'center',
    lineHeight: 80,
    ...theme.elevation.md,
  },
  editOverlay: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.secondary.amber,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.elevation.sm,
  },
  editIcon: {
    fontSize: 14,
  },
  displayName: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  username: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.mode.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  statsSection: {
    width: '100%',
    marginBottom: theme.spacing.lg,
  },
  statsCard: {
    backgroundColor: theme.colors.mode.background,
    ...theme.elevation.xs,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
    maxWidth: 300,
  },
  actionButton: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.mode.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.mode.border,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
  },
  modalClose: {
    padding: theme.spacing.sm,
  },
  modalCloseText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary[500],
  },
  modalContent: {
    flex: 1,
    padding: theme.spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalMessage: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  modalSubtext: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.mode.textSecondary,
    textAlign: 'center',
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.md,
  },
});

export default ProfileHeader;
