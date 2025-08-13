import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

const ProfileScreen = ({ navigation, route }) => {
  const { user, apiCall, logout } = useAuth();
  const { userId } = route.params || { userId: user?.id };
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      const response = await apiCall(`/profile/${userId}`);
      if (response.ok) {
        const profileData = await response.json();
        setProfile(profileData);
      }
    } catch (error) {
      console.warn('Failed to load profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  const getRatingColor = (tier) => {
    const colors = {
      'Grandmaster': '#ff6b6b',
      'Master': '#4ecdc4',
      'Expert': '#45b7d1',
      'Advanced': '#96ceb4',
      'Intermediate': '#ffeaa7',
      'Beginner': '#ddd6fe',
      'Novice': '#fee2e2'
    };
    return colors[tier] || '#f8f9fa';
  };

  const isOwnProfile = userId === user?.id;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1a237e" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Profile not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile.user.display_name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.displayName}>{profile.user.display_name}</Text>
            <Text style={styles.username}>@{profile.user.username}</Text>
            <Text style={styles.totalGames}>{profile.user.total_games} total games</Text>
          </View>

          {/* Ratings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ELO Ratings</Text>
            {profile.ratings.length > 0 ? (
              <View style={styles.ratingsGrid}>
                {profile.ratings.map((rating, index) => (
                  <View key={index} style={styles.ratingCard}>
                    <View style={styles.ratingHeader}>
                      <Text style={styles.ratingTitle}>
                        {rating.sport.charAt(0).toUpperCase() + rating.sport.slice(1)} - {rating.mode.charAt(0).toUpperCase() + rating.mode.slice(1)}
                      </Text>
                      <View style={[styles.tierBadge, { backgroundColor: getRatingColor(rating.tier.tier) }]}>
                        <Text style={styles.tierText}>{rating.tier.icon} {rating.tier.tier}</Text>
                      </View>
                    </View>
                    <Text style={styles.eloRating}>{Math.round(rating.elo_rating)}</Text>
                    <View style={styles.ratingStats}>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{rating.games_played}</Text>
                        <Text style={styles.statLabel}>Games</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{rating.wins}</Text>
                        <Text style={styles.statLabel}>Wins</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{rating.best_score}</Text>
                        <Text style={styles.statLabel}>Best</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                          {rating.games_played > 0 ? Math.round((rating.wins / rating.games_played) * 100) : 0}%
                        </Text>
                        <Text style={styles.statLabel}>Win Rate</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noDataText}>No ratings yet. Start playing to build your profile!</Text>
            )}
          </View>

          {/* Recent Achievements */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Achievements</Text>
            {profile.recent_achievements.length > 0 ? (
              <View style={styles.achievementsList}>
                {profile.recent_achievements.map((achievement, index) => (
                  <View key={index} style={styles.achievementCard}>
                    <Text style={styles.achievementIcon}>{achievement.icon}</Text>
                    <View style={styles.achievementInfo}>
                      <Text style={styles.achievementName}>{achievement.name}</Text>
                      <Text style={styles.achievementDescription}>{achievement.description}</Text>
                      <Text style={styles.achievementDate}>
                        Unlocked {new Date(achievement.unlocked_at).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noDataText}>No achievements yet. Keep playing to unlock them!</Text>
            )}
          </View>

          {/* Engagement Stats */}
          {profile.engagement && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Engagement Stats</Text>
              <View style={styles.engagementGrid}>
                <View style={styles.engagementCard}>
                  <Text style={styles.engagementValue}>{profile.engagement.total_games}</Text>
                  <Text style={styles.engagementLabel}>Total Games</Text>
                </View>
                <View style={styles.engagementCard}>
                  <Text style={styles.engagementValue}>{profile.engagement.recent_games_30d}</Text>
                  <Text style={styles.engagementLabel}>Last 30 Days</Text>
                </View>
                <View style={styles.engagementCard}>
                  <Text style={styles.engagementValue}>
                    {Math.round(profile.engagement.average_session_duration / 60) || 0}m
                  </Text>
                  <Text style={styles.engagementLabel}>Avg Session</Text>
                </View>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {!isOwnProfile && (
              <TouchableOpacity
                style={styles.challengeButton}
                onPress={() => navigation.navigate('CreateChallenge', { targetUser: profile.user })}
              >
                <Text style={styles.challengeButtonText}>⚡ Challenge</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={styles.leaderboardButton}
              onPress={() => navigation.navigate('Leaderboards')}
            >
              <Text style={styles.leaderboardButtonText}>🏆 Leaderboards</Text>
            </TouchableOpacity>
          </View>

          {/* Settings for own profile */}
          {isOwnProfile && (
            <View style={styles.settingsSection}>
              <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                <Text style={styles.logoutButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#1a237e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a237e',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  displayName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  totalGames: {
    fontSize: 14,
    color: '#888',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  ratingsGrid: {
    gap: 16,
  },
  ratingCard: {
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 16,
  },
  ratingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
  },
  eloRating: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a237e',
    textAlign: 'center',
    marginBottom: 12,
  },
  ratingStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  achievementsList: {
    gap: 12,
  },
  achievementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  achievementIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  achievementInfo: {
    flex: 1,
  },
  achievementName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  achievementDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  achievementDate: {
    fontSize: 12,
    color: '#888',
  },
  engagementGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  engagementCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  engagementValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a237e',
  },
  engagementLabel: {
    fontSize: 12,
    color: '#666',
  },
  noDataText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  challengeButton: {
    flex: 1,
    backgroundColor: '#ff6b6b',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  challengeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  leaderboardButton: {
    flex: 1,
    backgroundColor: '#4ecdc4',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  leaderboardButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingsSection: {
    marginTop: 20,
  },
  logoutButton: {
    backgroundColor: '#6c757d',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ProfileScreen;