import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Image,
} from 'react-native';
import { useSession } from '../context/SessionContext';
import { useAuth } from '../context/AuthContext';

const HomeScreen = ({ navigation }) => {
  const { resetTheme, dashboard } = useSession();
  const { createGuestSession } = useAuth();

  React.useEffect(() => {
    // Reset to default theme when on home screen
    resetTheme();
  }, []);

  const navigateToQuiz = () => {
    navigation.navigate('SportSelection', { mode: 'quiz' });
  };

  const navigateToSurvival = () => {
    navigation.navigate('SportSelection', { mode: 'survival' });
  };

  const navigateToDashboard = () => {
    navigation.navigate('Dashboard');
  };

  const handleGuestPress = async () => {
    try {
      const result = await createGuestSession();
      if (result.success) {
        navigation.navigate('SportSelection', { mode: 'guest' });
      } else {
        console.error('Guest session failed:', result.error);
      }
    } catch (error) {
      console.error('Guest session error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>VerveQ Football</Text>
        <Text style={styles.subtitle}>Test Your Football Knowledge</Text>
        
        <View style={styles.modesContainer}>
          <TouchableOpacity
            style={[styles.modeButton, styles.quizButton]}
            onPress={navigateToQuiz}
            activeOpacity={0.8}
          >
            <Text style={styles.modeIcon}>🧠</Text>
            <Text style={styles.modeTitle}>Quiz Mode</Text>
            <Text style={styles.modeDescription}>
              Answer football trivia questions and test your knowledge
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeButton, styles.survivalButton]}
            onPress={navigateToSurvival}
            activeOpacity={0.8}
          >
            <Text style={styles.modeIcon}>⚡</Text>
            <Text style={styles.modeTitle}>Survival Mode</Text>
            <Text style={styles.modeDescription}>
              Guess players by their initials. How long can you survive?
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          {dashboard && dashboard.total_plays > 0 && (
            <TouchableOpacity
              style={styles.dashboardButton}
              onPress={navigateToDashboard}
            >
              <Text style={styles.dashboardText}>📊 View Dashboard</Text>
              <Text style={styles.statsText}>
                {dashboard.total_plays} games played • {dashboard.sports_played.length} sports
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.guestButton}
          onPress={handleGuestPress}
          activeOpacity={0.8}
        >
          <Text style={styles.guestText}>🎮 Play as Guest</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Choose your challenge!</Text>
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
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a237e',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  modesContainer: {
    gap: 20,
  },
  modeButton: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quizButton: {
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  survivalButton: {
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
  },
  modeIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  modeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  modeDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    color: '#888',
    fontStyle: 'italic',
  },
  statsContainer: {
    marginTop: 20,
    marginBottom: 20,
  },
  dashboardButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: '#6c5ce7',
  },
  dashboardText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  guestButton: {
    backgroundColor: '#2196f3',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  guestText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default HomeScreen;