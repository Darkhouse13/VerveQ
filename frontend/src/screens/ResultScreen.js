import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

const ResultScreen = ({ route, navigation }) => {
  const { score, total, mode, lives } = route.params;
  const { theme } = useTheme();
  
  const getScoreMessage = () => {
    if (mode === 'quiz') {
      const percentage = Math.round((score / total) * 100);
      if (percentage >= 80) return 'Excellent! ⭐⭐⭐';
      if (percentage >= 60) return 'Good job! ⭐⭐';
      if (percentage >= 40) return 'Not bad! ⭐';
      return 'Keep practicing!';
    } else {
      if (score >= 10) return 'Football Expert! ⚡⚡⚡';
      if (score >= 5) return 'Good run! ⚡⚡';
      if (score >= 2) return 'Nice try! ⚡';
      return 'Keep going!';
    }
  };

  const getScoreColor = () => {
    if (mode === 'quiz') {
      const percentage = Math.round((score / total) * 100);
      if (percentage >= 80) return theme.colors.success.light;
      if (percentage >= 60) return theme.colors.warning.light;
      return theme.colors.error.light;
    } else {
      if (score >= 10) return theme.colors.success.light;
      if (score >= 5) return theme.colors.warning.light;
      return theme.colors.error.light;
    }
  };

  const playAgain = () => {
    if (mode === 'quiz') {
      // Force new instance with navigation.reset to ensure component remounts
      navigation.reset({
        index: 1,
        routes: [
          { name: 'MainTabs' },
          {
            name: 'Quiz',
            params: {
              sport: route.params.sport,
              difficulty: route.params.difficulty,
              reset: true,
              key: `quiz-${Date.now()}` // Unique key forces remount
            }
          }
        ]
      });
    } else {
      // Force new instance for Survival mode
      navigation.reset({
        index: 1,
        routes: [
          { name: 'MainTabs' },
          {
            name: 'Survival',
            params: {
              sport: route.params.sport,
              difficulty: route.params.difficulty,
              reset: true,
              key: `survival-${Date.now()}` // Unique key forces remount
            }
          }
        ]
      });
    }
  };

  const goHome = () => {
    navigation.navigate('Home');
  };

  return (
    <SafeAreaView style={styles(theme).container}>
      <View style={styles(theme).content}>
        <View style={styles(theme).resultContainer}>
          <Text style={styles(theme).title}>
            {mode === 'quiz' ? 'Quiz Complete!' : 'Game Over!'}
          </Text>
          
          <View style={styles(theme).scoreContainer}>
            <Text style={[styles(theme).scoreText, { color: getScoreColor() }]}>
              {score}
            </Text>
          </View>
          
          <Text style={[styles(theme).messageText, { color: getScoreColor() }]}>
            {getScoreMessage()}
          </Text>

          {mode === 'quiz' && (
            <View style={styles(theme).statsContainer}>
              <Text style={styles(theme).statsTitle}>Your Stats:</Text>
              <Text style={styles(theme).statsText}>
                Score: {score} / {total}
              </Text>
              <Text style={styles(theme).statsText}>
                Questions Answered: {total / 100}
              </Text>
              <Text style={styles(theme).statsText}>
                Points Per Question: {score > 0 ? Math.round(score / (total / 100)) : 0}
              </Text>
            </View>
          )}

          {mode === 'survival' && (
            <View style={styles(theme).statsContainer}>
              <Text style={styles(theme).statsTitle}>Your Stats:</Text>
              <Text style={styles(theme).statsText}>
                Players guessed: {score}
              </Text>
              <Text style={styles(theme).statsText}>
                Lives remaining: {lives || 0} ❤️
              </Text>
              <Text style={styles(theme).statsText}>
                Status: {lives > 0 ? 'Survived!' : 'Eliminated'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles(theme).buttonContainer}>
          <TouchableOpacity
            style={styles(theme).playAgainButton}
            onPress={playAgain}
          >
            <Text style={styles(theme).playAgainButtonText}>
              {mode === 'quiz' ? 'Quiz Again' : 'Play Again'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles(theme).homeButton}
            onPress={goHome}
          >
            <Text style={styles(theme).homeButtonText}>Back to Home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles(theme).modeButton}
            onPress={() => navigation.navigate(mode === 'quiz' ? 'Survival' : 'Quiz')}
          >
            <Text style={styles(theme).modeButtonText}>
              Try {mode === 'quiz' ? 'Survival Mode' : 'Quiz Mode'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles(theme).footer}>
          <Text style={styles(theme).footerText}>
            {mode === 'quiz' 
              ? 'Challenge yourself with more questions!' 
              : 'See how many players you can guess!'}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.mode.background,
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  resultContainer: {
    backgroundColor: theme.colors.mode.surface,
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.mode.text,
    marginBottom: 20,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 15,
  },
  scoreText: {
    fontSize: 64,
    fontWeight: 'bold',
  },
  totalText: {
    fontSize: 32,
    color: theme.colors.mode.textSecondary,
    marginLeft: 5,
  },
  messageText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  statsContainer: {
    width: '100%',
    backgroundColor: theme.colors.mode.surfaceVariant,
    borderRadius: 8,
    padding: 15,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.mode.text,
    marginBottom: 10,
    textAlign: 'center',
  },
  statsText: {
    fontSize: 14,
    color: theme.colors.mode.textSecondary,
    marginBottom: 5,
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 12,
  },
  playAgainButton: {
    backgroundColor: theme.colors.primary[500],
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  playAgainButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  homeButton: {
    backgroundColor: theme.colors.success.light,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  homeButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  modeButton: {
    backgroundColor: theme.colors.warning.light,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.mode.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ResultScreen;
