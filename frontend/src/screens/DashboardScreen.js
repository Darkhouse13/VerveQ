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

const DashboardScreen = ({ navigation }) => {
  const { dashboard, loadDashboard, sessionId } = useSession();
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
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No Data Yet</Text>
          <Text style={styles.emptyText}>
            Start playing some games to see your stats here!
          </Text>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.startButtonText}>Start Playing</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          <View style={styles.headerStats}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{dashboard.total_plays}</Text>
              <Text style={styles.statLabel}>Total Games</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{dashboard.sports_played.length}</Text>
              <Text style={styles.statLabel}>Sports Played</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Your Best Scores</Text>
          
          {Object.entries(dashboard.best_scores).map(([sport, modes]) => (
            <View key={sport} style={styles.sportCard}>
              <View style={styles.sportHeader}>
                <Text style={styles.sportIcon}>{getSportIcon(sport)}</Text>
                <Text style={styles.sportTitle}>{getSportDisplayName(sport)}</Text>
              </View>
              
              <View style={styles.modesContainer}>
                {modes.quiz && (
                  <View style={styles.modeCard}>
                    <Text style={styles.modeTitle}>🧠 Quiz Mode</Text>
                    <Text style={styles.scoreText}>
                      Best: {modes.quiz.best_score}/{modes.quiz.best_total} 
                      ({modes.quiz.best_percentage}%)
                    </Text>
                    <Text style={styles.playsText}>
                      {modes.quiz.play_count} games played
                    </Text>
                    <TouchableOpacity
                      style={styles.playButton}
                      onPress={() => playQuiz(sport)}
                    >
                      <Text style={styles.playButtonText}>Play Quiz</Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                {modes.survival && (
                  <View style={styles.modeCard}>
                    <Text style={styles.modeTitle}>⚡ Survival Mode</Text>
                    <Text style={styles.scoreText}>
                      Best Score: {modes.survival.best_score}
                    </Text>
                    <Text style={styles.playsText}>
                      {modes.survival.play_count} games played
                    </Text>
                    <TouchableOpacity
                      style={styles.playButton}
                      onPress={() => playSurvival(sport)}
                    >
                      <Text style={styles.playButtonText}>Play Survival</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))}

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.newGameButton}
              onPress={() => navigation.navigate('SportSelection', { mode: 'quiz' })}
            >
              <Text style={styles.newGameButtonText}>🧠 New Quiz</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.newGameButton}
              onPress={() => navigation.navigate('SportSelection', { mode: 'survival' })}
            >
              <Text style={styles.newGameButtonText}>⚡ New Survival</Text>
            </TouchableOpacity>
          </View>
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
    color: '#333',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  startButton: {
    backgroundColor: '#1a237e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  startButtonText: {
    color: '#fff',
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
    backgroundColor: '#fff',
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
    color: '#1a237e',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  sportCard: {
    backgroundColor: '#fff',
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
    color: '#333',
  },
  modesContainer: {
    gap: 12,
  },
  modeCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  scoreText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  playsText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 12,
  },
  playButton: {
    backgroundColor: '#1a237e',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  playButtonText: {
    color: '#fff',
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
    backgroundColor: '#4caf50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  newGameButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default DashboardScreen;