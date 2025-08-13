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

const LeaderboardScreen = ({ navigation }) => {
  const { apiCall, user } = useAuth();
  
  const [leaderboards, setLeaderboards] = useState({});
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSport, setSelectedSport] = useState('football');
  const [selectedMode, setSelectedMode] = useState('quiz');
  const [selectedPeriod, setSelectedPeriod] = useState('all_time');
  const [showGlobal, setShowGlobal] = useState(false);

  const sports = ['football', 'tennis'];
  const modes = ['quiz', 'survival'];
  const periods = [
    { key: 'all_time', label: 'All Time' },
    { key: 'monthly', label: 'This Month' },
    { key: 'weekly', label: 'This Week' },
    { key: 'daily', label: 'Today' }
  ];

  useEffect(() => {
    loadLeaderboards();
  }, [selectedSport, selectedMode, selectedPeriod, showGlobal]);

  const loadLeaderboards = async () => {
    try {
      if (showGlobal) {
        const response = await apiCall('/leaderboards/global');
        if (response.ok) {
          const data = await response.json();
          setGlobalLeaderboard(data.leaderboard);
        }
      } else {
        const response = await apiCall(
          `/leaderboards/${selectedSport}/${selectedMode}?period=${selectedPeriod}&limit=50`
        );
        if (response.ok) {
          const data = await response.json();
          setLeaderboards({
            ...leaderboards,
            [`${selectedSport}_${selectedMode}_${selectedPeriod}`]: data.leaderboard
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load leaderboards:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLeaderboards();
  };

  const getCurrentLeaderboard = () => {
    if (showGlobal) {
      return globalLeaderboard;
    }
    return leaderboards[`${selectedSport}_${selectedMode}_${selectedPeriod}`] || [];
  };

  const getRankColor = (rank) => {
    if (rank === 1) return '#ffd700'; // Gold
    if (rank === 2) return '#c0c0c0'; // Silver
    if (rank === 3) return '#cd7f32'; // Bronze
    return '#f8f9fa';
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const isCurrentUser = (leaderboardUser) => {
    return user && leaderboardUser.id === user.id;
  };

  const navigateToProfile = (userId) => {
    navigation.navigate('Profile', { userId });
  };

  const currentLeaderboard = getCurrentLeaderboard();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header Controls */}
        <View style={styles.controls}>
          {/* Global vs Sport Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, !showGlobal && styles.toggleActive]}
              onPress={() => setShowGlobal(false)}
            >
              <Text style={[styles.toggleText, !showGlobal && styles.toggleTextActive]}>
                Sport Specific
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, showGlobal && styles.toggleActive]}
              onPress={() => setShowGlobal(true)}
            >
              <Text style={[styles.toggleText, showGlobal && styles.toggleTextActive]}>
                Global Champions
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sport/Mode/Period Selectors (only for sport-specific) */}
          {!showGlobal && (
            <>
              <View style={styles.selectorContainer}>
                <Text style={styles.selectorLabel}>Sport:</Text>
                <View style={styles.selectorButtons}>
                  {sports.map(sport => (
                    <TouchableOpacity
                      key={sport}
                      style={[
                        styles.selectorButton,
                        selectedSport === sport && styles.selectorButtonActive
                      ]}
                      onPress={() => setSelectedSport(sport)}
                    >
                      <Text style={[
                        styles.selectorButtonText,
                        selectedSport === sport && styles.selectorButtonTextActive
                      ]}>
                        {sport.charAt(0).toUpperCase() + sport.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.selectorContainer}>
                <Text style={styles.selectorLabel}>Mode:</Text>
                <View style={styles.selectorButtons}>
                  {modes.map(mode => (
                    <TouchableOpacity
                      key={mode}
                      style={[
                        styles.selectorButton,
                        selectedMode === mode && styles.selectorButtonActive
                      ]}
                      onPress={() => setSelectedMode(mode)}
                    >
                      <Text style={[
                        styles.selectorButtonText,
                        selectedMode === mode && styles.selectorButtonTextActive
                      ]}>
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.selectorContainer}>
                <Text style={styles.selectorLabel}>Period:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.selectorButtons}>
                    {periods.map(period => (
                      <TouchableOpacity
                        key={period.key}
                        style={[
                          styles.selectorButton,
                          selectedPeriod === period.key && styles.selectorButtonActive
                        ]}
                        onPress={() => setSelectedPeriod(period.key)}
                      >
                        <Text style={[
                          styles.selectorButtonText,
                          selectedPeriod === period.key && styles.selectorButtonTextActive
                        ]}>
                          {period.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </>
          )}
        </View>

        {/* Leaderboard */}
        <View style={styles.leaderboardContainer}>
          <Text style={styles.leaderboardTitle}>
            {showGlobal 
              ? '🏆 Global Champions' 
              : `🏆 ${selectedSport.charAt(0).toUpperCase() + selectedSport.slice(1)} ${selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1)} - ${periods.find(p => p.key === selectedPeriod)?.label}`
            }
          </Text>

          {loading ? (
            <ActivityIndicator size="large" color="#1a237e" style={styles.loader} />
          ) : (
            <ScrollView
              style={styles.leaderboardList}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
              {currentLeaderboard.length > 0 ? (
                currentLeaderboard.map((entry, index) => (
                  <TouchableOpacity
                    key={`${entry.user.id}-${index}`}
                    style={[
                      styles.leaderboardEntry,
                      isCurrentUser(entry.user) && styles.currentUserEntry,
                      { backgroundColor: getRankColor(entry.rank) }
                    ]}
                    onPress={() => navigateToProfile(entry.user.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.rankContainer}>
                      <Text style={styles.rankText}>{getRankIcon(entry.rank)}</Text>
                    </View>
                    
                    <View style={styles.userInfo}>
                      <Text style={styles.displayName}>{entry.user.display_name}</Text>
                      <Text style={styles.username}>@{entry.user.username}</Text>
                      {!showGlobal && (
                        <Text style={styles.stats}>
                          {entry.games_played} games • {entry.wins}W/{entry.losses}L
                        </Text>
                      )}
                      {showGlobal && (
                        <Text style={styles.sportMode}>
                          {entry.sport.charAt(0).toUpperCase() + entry.sport.slice(1)} {entry.mode.charAt(0).toUpperCase() + entry.mode.slice(1)}
                        </Text>
                      )}
                    </View>

                    <View style={styles.ratingContainer}>
                      <Text style={styles.eloRating}>{Math.round(entry.elo_rating)}</Text>
                      <View style={[styles.tierBadge, { backgroundColor: entry.tier.color }]}>
                        <Text style={styles.tierText}>{entry.tier.icon}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No rankings available yet</Text>
                  <Text style={styles.emptySubtext}>Play more games to appear on the leaderboard!</Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  controls: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleActive: {
    backgroundColor: '#1a237e',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
  },
  toggleTextActive: {
    color: '#fff',
  },
  selectorContainer: {
    marginBottom: 12,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  selectorButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  selectorButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  selectorButtonActive: {
    backgroundColor: '#1a237e',
    borderColor: '#1a237e',
  },
  selectorButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
  },
  selectorButtonTextActive: {
    color: '#fff',
  },
  leaderboardContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leaderboardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    textAlign: 'center',
  },
  loader: {
    marginTop: 40,
  },
  leaderboardList: {
    flex: 1,
  },
  leaderboardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  currentUserEntry: {
    borderLeftWidth: 4,
    borderLeftColor: '#1a237e',
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  username: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  stats: {
    fontSize: 12,
    color: '#888',
  },
  sportMode: {
    fontSize: 12,
    color: '#888',
  },
  ratingContainer: {
    alignItems: 'center',
  },
  eloRating: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a237e',
    marginBottom: 4,
  },
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tierText: {
    fontSize: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});

export default LeaderboardScreen;