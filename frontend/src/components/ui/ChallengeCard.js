import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated,
  Alert
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Button from './Button';

const ChallengeCard = ({
  challenge,
  onAccept,
  onDecline,
  onViewHistory,
  showActions = true,
  showTimer = true,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const [timeLeft, setTimeLeft] = useState('');
  const [pulseAnim] = useState(new Animated.Value(1));
  const [slideAnim] = useState(new Animated.Value(0));

  const sportIcons = {
    football: '⚽',
    tennis: '🎾',
    basketball: '🏀',
  };

  const modeIcons = {
    quiz: '🧠',
    survival: '⚡',
  };

  useEffect(() => {
    // Entrance animation
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Pulse animation for urgent challenges
    if (showTimer && challenge.expires_at) {
      const now = new Date().getTime();
      const expiresAt = new Date(challenge.expires_at).getTime();
      const hoursLeft = (expiresAt - now) / (1000 * 60 * 60);

      if (hoursLeft < 1) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.05,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }
    }

    // Update timer every minute
    const interval = setInterval(updateTimer, 60000);
    updateTimer();

    return () => clearInterval(interval);
  }, [challenge]);

  const updateTimer = () => {
    if (!challenge.expires_at) return;

    const now = new Date().getTime();
    const expiresAt = new Date(challenge.expires_at).getTime();
    const timeDiff = expiresAt - now;

    if (timeDiff <= 0) {
      setTimeLeft('Expired');
      return;
    }

    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      setTimeLeft(`${days}d ${hours}h left`);
    } else if (hours > 0) {
      setTimeLeft(`${hours}h ${minutes}m left`);
    } else {
      setTimeLeft(`${minutes}m left`);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const getStatusColor = () => {
    switch (challenge.status) {
      case 'pending':
        return theme.colors.secondary.amber;
      case 'accepted':
        return theme.colors.secondary.emerald;
      case 'declined':
        return theme.colors.neutral[400];
      case 'expired':
        return theme.colors.error.main;
      case 'completed':
        return theme.colors.success.main;
      default:
        return theme.colors.primary[500];
    }
  };

  const handleAccept = () => {
    Alert.alert(
      'Accept Challenge',
      `Ready to take on ${challenge.challenger.display_name} in ${challenge.sport} ${challenge.mode}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Accept', 
          onPress: () => onAccept?.(challenge)
        }
      ]
    );
  };

  const handleDecline = () => {
    Alert.alert(
      'Decline Challenge',
      'Are you sure you want to decline this challenge?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Decline', 
          style: 'destructive',
          onPress: () => onDecline?.(challenge)
        }
      ]
    );
  };

  return (
    <Animated.View
      style={[
        styles(theme).container,
        {
          opacity: slideAnim,
          transform: [
            { 
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0],
              })
            },
            { scale: pulseAnim }
          ],
        },
        style
      ]}
      {...props}
    >
      {/* Status Indicator */}
      <View style={[styles(theme).statusIndicator, { backgroundColor: getStatusColor() }]} />

      {/* Header */}
      <View style={styles(theme).header}>
        <View style={styles(theme).challengerInfo}>
          <View style={styles(theme).avatar}>
            <Text style={styles(theme).avatarText}>
              {challenge.challenger.display_name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles(theme).challengerDetails}>
            <Text style={styles(theme).challengerName}>
              {challenge.challenger.display_name}
            </Text>
            <Text style={styles(theme).challengeDate}>
              {formatDate(challenge.created_at)}
            </Text>
          </View>
        </View>

        {showTimer && timeLeft && (
          <View style={[
            styles(theme).timerBadge,
            timeLeft === 'Expired' && styles(theme).expiredBadge
          ]}>
            <Text style={[
              styles(theme).timerText,
              timeLeft === 'Expired' && styles(theme).expiredText
            ]}>
              {timeLeft}
            </Text>
          </View>
        )}
      </View>

      {/* Challenge Details */}
      <View style={styles(theme).details}>
        <View style={styles(theme).gameInfo}>
          <View style={styles(theme).gameType}>
            <Text style={styles(theme).gameIcon}>
              {sportIcons[challenge.sport] || '🏃'}
            </Text>
            <Text style={styles(theme).gameText}>
              {challenge.sport.charAt(0).toUpperCase() + challenge.sport.slice(1)}
            </Text>
          </View>
          
          <View style={styles(theme).separator} />
          
          <View style={styles(theme).gameType}>
            <Text style={styles(theme).gameIcon}>
              {modeIcons[challenge.mode] || '🎯'}
            </Text>
            <Text style={styles(theme).gameText}>
              {challenge.mode.charAt(0).toUpperCase() + challenge.mode.slice(1)}
            </Text>
          </View>
        </View>

        {challenge.message && (
          <Text style={styles(theme).challengeMessage}>
            "{challenge.message}"
          </Text>
        )}

        {/* Comparison Stats */}
        {challenge.comparison_stats && (
          <View style={styles(theme).comparisonStats}>
            <View style={styles(theme).statItem}>
              <Text style={styles(theme).statLabel}>You</Text>
              <Text style={styles(theme).statValue}>
                {challenge.comparison_stats.your_rating || 1200}
              </Text>
            </View>
            <Text style={styles(theme).vsText}>VS</Text>
            <View style={styles(theme).statItem}>
              <Text style={styles(theme).statLabel}>Them</Text>
              <Text style={styles(theme).statValue}>
                {challenge.comparison_stats.their_rating || 1200}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      {showActions && challenge.status === 'pending' && (
        <View style={styles(theme).actions}>
          <Button
            title="Accept"
            variant="primary"
            size="medium"
            onPress={handleAccept}
            style={styles(theme).actionButton}
          />
          <Button
            title="Decline"
            variant="outline"
            size="medium"
            onPress={handleDecline}
            style={styles(theme).actionButton}
          />
        </View>
      )}

      {/* History Link */}
      {onViewHistory && (
        <TouchableOpacity
          style={styles(theme).historyLink}
          onPress={() => onViewHistory(challenge)}
        >
          <Text style={styles(theme).historyText}>View History</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.lg,
    marginVertical: theme.spacing.sm,
    overflow: 'hidden',
    ...theme.elevation.md,
  },
  statusIndicator: {
    height: 3,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  challengerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  avatarText: {
    color: theme.colors.onPrimary,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
  },
  challengerDetails: {
    flex: 1,
  },
  challengerName: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
    marginBottom: 2,
  },
  challengeDate: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.mode.textSecondary,
  },
  timerBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.secondary.amber + '20',
    borderWidth: 1,
    borderColor: theme.colors.secondary.amber,
  },
  expiredBadge: {
    backgroundColor: theme.colors.error.light,
    borderColor: theme.colors.error.main,
  },
  timerText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.secondary.amber,
  },
  expiredText: {
    color: theme.colors.error.dark,
  },
  details: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  gameInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  gameType: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  gameIcon: {
    fontSize: 18,
    marginRight: theme.spacing.sm,
  },
  gameText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.mode.text,
  },
  separator: {
    width: 1,
    height: 20,
    backgroundColor: theme.colors.mode.border,
    marginHorizontal: theme.spacing.md,
  },
  challengeMessage: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.mode.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    lineHeight: theme.typography.lineHeights.relaxed * theme.typography.sizes.md,
  },
  comparisonStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.mode.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.mode.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  statValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
  },
  vsText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary[500],
  },
  actions: {
    flexDirection: 'row',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  historyLink: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.mode.border,
  },
  historyText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary[500],
    fontWeight: theme.typography.weights.medium,
  },
});

export default ChallengeCard;
