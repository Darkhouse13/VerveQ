import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useSession } from '../context/SessionContext';
import { useTheme } from '../context/ThemeContext';

const DashboardScreen = ({ navigation }) => {
  const { dashboard, loadDashboard, sessionId } = useSession();
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (sessionId) {
      loadDashboard();
    }
  }, [sessionId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  const getSportIcon = (sport) => {
    const icons = {
      football: '⚽',
      tennis: '🎾',
      basketball: '🏀',
      baseball: '⚾',
      soccer: '⚽',
    };
    return icons[sport.toLowerCase()] || '🏆';
  };

  const getSportDisplayName = (sport) => {
    return sport.charAt(0).toUpperCase() + sport.slice(1);
  };

  const playQuiz = (sport) => {
    navigation.navigate('Quiz', { sport });
  };

  const playSurvival = (sport) => {
    navigation.navigate('Survival', { sport });
  };

  if (!dashboard) {
    return (
      <SafeAreaView style={styles(theme).container}>
        <View style={styles(theme).emptyContainer}>
          <Text style={styles(theme).emptyIcon}>📊</Text>
          <Text style={styles(theme).emptyTitle}>No Data Yet</Text>
          <Text style={styles(theme).emptyText}>
            Start playing some games to see your stats here!
          </Text>
          <TouchableOpacity
            style={styles(theme).startButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles(theme).startButtonText}>Start Playing</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles(theme).container}>
      <ScrollView
        style={styles(theme).scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles(theme).content}>
          <View style={styles(theme).headerStats}>
            <View style={styles(theme).statCard}>
              <Text style={styles(theme).statNumber}>{dashboard.total_plays}</Text>
              <Text style={styles(theme).statLabel}>Total Games</Text>
            </View>
            <View style={styles(theme).statCard}>
              <Text style={styles(theme).statNumber}>{dashboard.sports_played.length}</Text>
              <Text style={styles(theme).statLabel}>Sports Played</Text>
            </View>
          </View>

          <Text style={styles(theme).sectionTitle}>Your Best Scores</Text>
          
          {Object.entries(dashboard.best_scores).map(([sport, modes]) => (
            <View key={sport} style={styles(theme).sportCard}>
              <View style={styles(theme).sportHeader}>
                <Text style={styles(theme).sportIcon}>{getSportIcon(sport)}</Text>
                <Text style={styles(theme).sportTitle}>{getSportDisplayName(sport)}</Text>
              </View>
              
              <View style={styles(theme).modesContainer}>
                {modes.quiz && (
                  <View style={styles(theme).modeCard}>
                    <Text style={styles(theme).modeTitle}>🧠 Quiz Mode</Text>
                    <Text style={styles(theme).scoreText}>
                      Best: {modes.quiz.best_score}/{modes.quiz.best_total} 
                      ({modes.quiz.best_percentage}%)
                    </Text>
                    <Text style={styles(theme).playsText}>
                      {modes.quiz.play_count} games played
                    </Text>
                    <TouchableOpacity
                      style={styles(theme).playButton}
                      onPress={() => playQuiz(sport)}
                    >
                      <Text style={styles(theme).playButtonText}>Play Quiz</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                {modes.survival && (
                  <View style={styles(theme).modeCard}>
                    <Text style={styles(theme).modeTitle}>⚡ Survival Mode</Text>
                    <Text style={styles(theme).scoreText}>
                      Best Score: {modes.survival.best_score}
                    </Text>
                    <Text style={styles(theme).playsText}>
                      {modes.survival.play_count} games played
                    </Text>
                    <TouchableOpacity
                      style={styles(theme).playButton}
                      onPress={() => playSurvival(sport)}
                    >
                      <Text style={styles(theme).playButtonText}>Play Survival</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))}

          <View style={styles(theme).actionButtons}>
            <TouchableOpacity
              style={styles(theme).newGameButton}
              onPress={() => navigation.navigate('SportSelection', { mode: 'quiz' })}
            >
              <Text style={styles(theme).newGameButtonText}>🧠 New Quiz</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles(theme).newGameButton}
              onPress={() => navigation.navigate('SportSelection', { mode: 'survival' })}
            >
              <Text style={styles(theme).newGameButtonText}>⚡ New Survival</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.mode.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.mode.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.mode.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  startButton: {
    backgroundColor: theme.colors.primary[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerStats: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.mode.surface,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.primary[500],
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: theme.colors.mode.textSecondary,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.mode.text,
    marginBottom: 16,
  },
  sportCard: {
    backgroundColor: theme.colors.mode.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sportIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  sportTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.mode.text,
  },
  modesContainer: {
    gap: 12,
  },
  modeCard: {
    backgroundColor: theme.colors.mode.surfaceVariant,
    borderRadius: 8,
    padding: 16,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.mode.text,
    marginBottom: 8,
  },
  scoreText: {
    fontSize: 14,
    color: theme.colors.mode.textSecondary,
    marginBottom: 4,
  },
  playsText: {
    fontSize: 12,
    color: theme.colors.mode.textTertiary,
    marginBottom: 12,
  },
  playButton: {
    backgroundColor: theme.colors.primary[500],
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  playButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  newGameButton: {
    flex: 1,
    backgroundColor: theme.colors.success.light,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  newGameButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default DashboardScreen;
