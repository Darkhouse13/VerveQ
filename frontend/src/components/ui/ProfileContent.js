import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView,
  RefreshControl
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Card from './Card';
import AchievementCard from './AchievementCard';
import StatsChart from './StatsChart';
import TrophyTier from './TrophyTier';
import Button from './Button';

const ProfileContent = ({
  profile,
  isOwnProfile = false,
  refreshing = false,
  onRefresh,
  onNavigate,
  onLogout,
  style,
  ...props
}) => {
  const { theme, styles: themeStyles } = useTheme();

  const generatePerformanceData = () => {
    if (!profile?.ratings || profile.ratings.length === 0) return [];
    
    return profile.ratings.map((rating, index) => ({
      label: rating.sport.charAt(0).toUpperCase() + rating.sport.slice(1),
      value: rating.games_played > 0 ? Math.round((rating.wins / rating.games_played) * 100) : 0,
      color: index === 0 ? theme.colors.primary[500] : 
             index === 1 ? theme.colors.secondary.emerald : 
             theme.colors.secondary.coral
    }));
  };

  const generateEloProgressData = () => {
    // Mock data - in real app, this would come from API
    return [
      { label: 'Week 1', value: 1200 },
      { label: 'Week 2', value: 1250 },
      { label: 'Week 3', value: 1180 },
      { label: 'Week 4', value: 1320 },
      { label: 'Week 5', value: 1350 },
    ];
  };

  return (
    <ScrollView
      style={[styles(theme).container, style]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl 
          refreshing={refreshing} 
          onRefresh={onRefresh}
          colors={[theme.colors.primary[500]]}
          tintColor={theme.colors.primary[500]}
        />
      }
      {...props}
    >
      {/* ELO Ratings Section */}
      <Card elevation="md" style={styles(theme).section}>
        <Text style={[themeStyles.heading3, styles(theme).sectionTitle]}>
          ELO Ratings
        </Text>
        {profile?.ratings && profile.ratings.length > 0 ? (
          <View style={styles(theme).ratingsGrid}>
            {profile.ratings.map((rating, index) => (
              <View key={index} style={styles(theme).ratingCard}>
                <View style={styles(theme).ratingHeader}>
                  <Text style={styles(theme).ratingTitle}>
                    {rating.sport.charAt(0).toUpperCase() + rating.sport.slice(1)} - {rating.mode.charAt(0).toUpperCase() + rating.mode.slice(1)}
                  </Text>
                  <TrophyTier
                    tier={rating.tier?.tier || 'Beginner'}
                    size="small"
                    showProgress={false}
                    animated={false}
                  />
                </View>
                <Text style={styles(theme).eloRating}>
                  {Math.round(rating.elo_rating)}
                </Text>
                <View style={styles(theme).ratingStats}>
                  <View style={styles(theme).statItem}>
                    <Text style={styles(theme).statValue}>{rating.games_played || 0}</Text>
                    <Text style={styles(theme).statLabel}>Games</Text>
                  </View>
                  <View style={styles(theme).statItem}>
                    <Text style={styles(theme).statValue}>{rating.wins || 0}</Text>
                    <Text style={styles(theme).statLabel}>Wins</Text>
                  </View>
                  <View style={styles(theme).statItem}>
                    <Text style={styles(theme).statValue}>{rating.best_score || 0}</Text>
                    <Text style={styles(theme).statLabel}>Best</Text>
                  </View>
                  <View style={styles(theme).statItem}>
                    <Text style={styles(theme).statValue}>
                      {rating.games_played > 0 ? Math.round((rating.wins / rating.games_played) * 100) : 0}%
                    </Text>
                    <Text style={styles(theme).statLabel}>Win Rate</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles(theme).noDataText}>
            No ratings yet. Start playing to build your profile!
          </Text>
        )}
      </Card>

      {/* Performance Charts */}
      {profile?.ratings && profile.ratings.length > 0 && (
        <StatsChart
          data={generatePerformanceData()}
          type="bar"
          title="Performance by Sport"
          subtitle="Win rate percentage"
          style={styles(theme).section}
        />
      )}

      {/* ELO Progress Chart */}
      {isOwnProfile && (
        <StatsChart
          data={generateEloProgressData()}
          type="line"
          title="ELO Progress"
          subtitle="Recent rating changes"
          style={styles(theme).section}
        />
      )}

      {/* Recent Achievements */}
      <Card elevation="md" style={styles(theme).section}>
        <Text style={[themeStyles.heading3, styles(theme).sectionTitle]}>
          Recent Achievements
        </Text>
        {profile?.recent_achievements && profile.recent_achievements.length > 0 ? (
          <View style={styles(theme).achievementsList}>
            {profile.recent_achievements.slice(0, 3).map((achievement, index) => (
              <AchievementCard
                key={index}
                achievement={achievement}
                isUnlocked={true}
                showProgress={false}
                showShare={true}
                style={styles(theme).achievementCard}
              />
            ))}
            {profile.recent_achievements.length > 3 && (
              <TouchableOpacity
                style={styles(theme).viewAllButton}
                onPress={() => onNavigate?.('Achievements')}
              >
                <Text style={styles(theme).viewAllText}>
                  View All Achievements ({profile.recent_achievements.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <Text style={styles(theme).noDataText}>
            No achievements yet. Keep playing to unlock them!
          </Text>
        )}
      </Card>

      {/* Engagement Stats */}
      {profile?.engagement && (
        <Card elevation="md" style={styles(theme).section}>
          <Text style={[themeStyles.heading3, styles(theme).sectionTitle]}>
            Engagement Stats
          </Text>
          <View style={styles(theme).engagementGrid}>
            <View style={styles(theme).engagementCard}>
              <Text style={styles(theme).engagementValue}>
                {profile.engagement.total_games || 0}
              </Text>
              <Text style={styles(theme).engagementLabel}>Total Games</Text>
            </View>
            <View style={styles(theme).engagementCard}>
              <Text style={styles(theme).engagementValue}>
                {profile.engagement.recent_games_30d || 0}
              </Text>
              <Text style={styles(theme).engagementLabel}>Last 30 Days</Text>
            </View>
            <View style={styles(theme).engagementCard}>
              <Text style={styles(theme).engagementValue}>
                {Math.round((profile.engagement.average_session_duration || 0) / 60)}m
              </Text>
              <Text style={styles(theme).engagementLabel}>Avg Session</Text>
            </View>
          </View>
        </Card>
      )}

      {/* Action Buttons */}
      <Card elevation="md" style={styles(theme).section}>
        <View style={styles(theme).actionButtons}>
          {!isOwnProfile ? (
            <>
              <Button
                title="View Leaderboards"
                variant="outline"
                size="medium"
                onPress={() => onNavigate?.('Leaderboards')}
                style={styles(theme).actionButton}
              />
              <Button
                title="Challenge History"
                variant="secondary"
                size="medium"
                onPress={() => onNavigate?.('ChallengeHistory')}
                style={styles(theme).actionButton}
              />
            </>
          ) : (
            <>
              <Button
                title="View Leaderboards"
                variant="outline"
                size="medium"
                onPress={() => onNavigate?.('Leaderboards')}
                style={styles(theme).actionButton}
              />
              <Button
                title="Settings"
                variant="secondary"
                size="medium"
                onPress={() => onNavigate?.('Settings')}
                style={styles(theme).actionButton}
              />
            </>
          )}
        </View>
      </Card>

      {/* Settings for own profile */}
      {isOwnProfile && (
        <Card elevation="sm" style={styles(theme).settingsSection}>
          <Button
            title="Logout"
            variant="outline"
            size="large"
            onPress={onLogout}
            style={styles(theme).logoutButton}
          />
        </Card>
      )}

      {/* Bottom Spacing */}
      <View style={styles(theme).bottomSpacing} />
    </ScrollView>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    marginBottom: theme.spacing.lg,
  },
  ratingsGrid: {
    gap: theme.spacing.lg,
  },
  ratingCard: {
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.mode.background,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  ratingTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
    flex: 1,
    marginRight: theme.spacing.md,
  },
  eloRating: {
    fontSize: theme.typography.sizes['3xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary[600],
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  ratingStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.mode.text,
  },
  statLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.mode.textSecondary,
    marginTop: theme.spacing.xs,
  },
  achievementsList: {
    gap: theme.spacing.md,
  },
  achievementCard: {
    marginVertical: 0,
  },
  viewAllButton: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.mode.border,
    marginTop: theme.spacing.md,
  },
  viewAllText: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.primary[500],
  },
  engagementGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  engagementCard: {
    flex: 1,
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.mode.background,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.mode.border,
  },
  engagementValue: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary[600],
    marginBottom: theme.spacing.xs,
  },
  engagementLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.mode.textSecondary,
    textAlign: 'center',
  },
  noDataText: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.mode.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: theme.spacing.xl,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  settingsSection: {
    marginBottom: theme.spacing.lg,
  },
  logoutButton: {
    borderColor: theme.colors.error.main,
  },
  bottomSpacing: {
    height: theme.spacing.xl,
  },
});

export default ProfileContent;