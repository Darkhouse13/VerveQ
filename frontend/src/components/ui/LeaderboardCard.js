import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  Pressable,
  Dimensions 
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import TrophyTier from './TrophyTier';
import Button from './Button';

const { width } = Dimensions.get('window');

const LeaderboardCard = ({
  entry,
  rank,
  isCurrentUser = false,
  onPress,
  onChallenge,
  showDetails = false,
  style,
  ...props
}) => {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [pressAnim] = useState(new Animated.Value(1));
  const slideAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.timing(pressAnim, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(pressAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const toggleExpanded = () => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    
    Animated.timing(slideAnim, {
      toValue: newExpanded ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  const getRankStyle = (rank) => {
    if (rank <= 3) {
      return {
        backgroundColor: rank === 1 ? '#ffd70020' : rank === 2 ? '#c0c0c020' : '#cd7f3220',
        borderLeftColor: rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : '#cd7f32',
        borderLeftWidth: 4,
      };
    }
    return {};
  };

  const formatWinRate = (wins, totalGames) => {
    return totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  };

  return (
    <Animated.View
      style={[
        styles(theme).container,
        getRankStyle(rank),
        isCurrentUser && styles(theme).currentUserCard,
        { transform: [{ scale: pressAnim }] },
        style
      ]}
      {...props}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() => {
          toggleExpanded();
          onPress?.();
        }}
        style={styles(theme).pressable}
      >
        {/* Main Card Content */}
        <View style={styles(theme).mainContent}>
          {/* Rank Section */}
          <View style={styles(theme).rankSection}>
            {getRankIcon(rank) ? (
              <Text style={styles(theme).rankIcon}>{getRankIcon(rank)}</Text>
            ) : (
              <View style={styles(theme).rankBadge}>
                <Text style={styles(theme).rankNumber}>#{rank}</Text>
              </View>
            )}
          </View>

          {/* User Info */}
          <View style={styles(theme).userSection}>
            <View style={styles(theme).avatar}>
              <Text style={styles(theme).avatarText}>
                {entry.user.display_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles(theme).userInfo}>
              <Text style={styles(theme).displayName} numberOfLines={1}>
                {entry.user.display_name}
              </Text>
              <Text style={styles(theme).username} numberOfLines={1}>
                @{entry.user.username}
              </Text>
            </View>
          </View>

          {/* Stats Section */}
          <View style={styles(theme).statsSection}>
            <Text style={styles(theme).eloRating}>
              {Math.round(entry.elo_rating)}
            </Text>
            <TrophyTier
              tier={entry.tier?.tier || 'Beginner'}
              size="small"
              showProgress={false}
              animated={false}
            />
          </View>

          {/* Expand Arrow */}
          <Animated.View
            style={[
              styles(theme).expandArrow,
              {
                transform: [{
                  rotate: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg'],
                  })
                }]
              }
            ]}
          >
            <Text style={styles(theme).expandIcon}>▼</Text>
          </Animated.View>
        </View>

        {/* Expanded Details */}
        <Animated.View
          style={[
            styles(theme).expandedContent,
            {
              height: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 120],
              }),
              opacity: slideAnim,
            }
          ]}
        >
          <View style={styles(theme).detailsGrid}>
            <View style={styles(theme).statItem}>
              <Text style={styles(theme).statValue}>{entry.games_played || 0}</Text>
              <Text style={styles(theme).statLabel}>Games</Text>
            </View>
            <View style={styles(theme).statItem}>
              <Text style={styles(theme).statValue}>{entry.wins || 0}</Text>
              <Text style={styles(theme).statLabel}>Wins</Text>
            </View>
            <View style={styles(theme).statItem}>
              <Text style={styles(theme).statValue}>
                {formatWinRate(entry.wins || 0, entry.games_played || 0)}%
              </Text>
              <Text style={styles(theme).statLabel}>Win Rate</Text>
            </View>
            <View style={styles(theme).statItem}>
              <Text style={styles(theme).statValue}>{entry.best_score || 0}</Text>
              <Text style={styles(theme).statLabel}>Best</Text>
            </View>
          </View>

          {/* Challenge Button */}
          {!isCurrentUser && onChallenge && (
            <View style={styles(theme).challengeSection}>
              <Button
                title="Challenge"
                variant="outline"
                size="small"
                onPress={() => onChallenge(entry.user)}
                style={styles(theme).challengeButton}
              />
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.mode.surface,
    borderRadius: theme.borderRadius.lg,
    marginVertical: theme.spacing.xs,
    ...theme.elevation.sm,
    overflow: 'hidden',
  },
  currentUserCard: {
    borderColor: theme.colors.primary[500],
    borderWidth: 2,
  },
  pressable: {
    padding: theme.spacing.md,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rankSection: {
    width: 50,
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  rankIcon: {
    fontSize: 24,
  },
  rankBadge: {
    backgroundColor: theme.colors.primary[100],
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    minWidth: 32,
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary[600],
  },
  userSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
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
    color: '#ffffff',
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
    marginBottom: 2,
  },
  username: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.mode.textSecondary,
  },
  statsSection: {
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  eloRating: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary[600],
    marginBottom: theme.spacing.xs,
  },
  expandArrow: {
    padding: theme.spacing.sm,
  },
  expandIcon: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.mode.textSecondary,
  },
  expandedContent: {
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: theme.colors.mode.border,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.spacing.md,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
  },
  statLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.mode.textSecondary,
    marginTop: 2,
  },
  challengeSection: {
    alignItems: 'center',
  },
  challengeButton: {
    minWidth: 100,
  },
});

export default LeaderboardCard;