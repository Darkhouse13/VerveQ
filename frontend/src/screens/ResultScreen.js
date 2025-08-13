import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

const ResultScreen = ({ route, navigation }) => {
  const { score, total, mode, lives } = route.params;
  
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
      if (percentage >= 80) return '#4caf50';
      if (percentage >= 60) return '#ff9800';
      return '#f44336';
    } else {
      if (score >= 10) return '#4caf50';
      if (score >= 5) return '#ff9800';
      return '#f44336';
    }
  };

  const playAgain = () => {
    if (mode === 'quiz') {
      navigation.navigate('Quiz', { sport: route.params.sport, reset: true });
    } else {
      navigation.navigate('Survival', { sport: route.params.sport, reset: true });
    }
  };

  const goHome = () => {
    navigation.navigate('Home');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.resultContainer}>
          <Text style={styles.title}>
            {mode === 'quiz' ? 'Quiz Complete!' : 'Game Over!'}
          </Text>
          
          <View style={styles.scoreContainer}>
            <Text style={[styles.scoreText, { color: getScoreColor() }]}>
              {score}
            </Text>
          </View>
          
          <Text style={[styles.messageText, { color: getScoreColor() }]}>
            {getScoreMessage()}
          </Text>

          {mode === 'quiz' && (
            <View style={styles.statsContainer}>
              <Text style={styles.statsTitle}>Your Stats:</Text>
              <Text style={styles.statsText}>
                Score: {score} / {total}
              </Text>
              <Text style={styles.statsText}>
                Questions Answered: {total / 100}
              </Text>
              <Text style={styles.statsText}>
                Points Per Question: {score > 0 ? Math.round(score / (total / 100)) : 0}
              </Text>
            </View>
          )}

          {mode === 'survival' && (
            <View style={styles.statsContainer}>
              <Text style={styles.statsTitle}>Your Stats:</Text>
              <Text style={styles.statsText}>
                Players guessed: {score}
              </Text>
              <Text style={styles.statsText}>
                Lives remaining: {lives || 0} ❤️
              </Text>
              <Text style={styles.statsText}>
                Status: {lives > 0 ? 'Survived!' : 'Eliminated'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.playAgainButton}
            onPress={playAgain}
          >
            <Text style={styles.playAgainButtonText}>
              {mode === 'quiz' ? 'Quiz Again' : 'Play Again'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.homeButton}
            onPress={goHome}
          >
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modeButton}
            onPress={() => navigation.navigate(mode === 'quiz' ? 'Survival' : 'Quiz')}
          >
            <Text style={styles.modeButtonText}>
              Try {mode === 'quiz' ? 'Survival Mode' : 'Quiz Mode'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {mode === 'quiz' 
              ? 'Challenge yourself with more questions!' 
              : 'See how many players you can guess!'}
          </Text>
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
  resultContainer: {
    backgroundColor: '#fff',
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
    color: '#333',
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
    color: '#666',
    marginLeft: 5,
  },
  messageText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  statsContainer: {
    width: '100%',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 15,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  statsText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
    textAlign: 'center',
  },
  buttonContainer: {
    gap: 12,
  },
  playAgainButton: {
    backgroundColor: '#1a237e',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  playAgainButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  homeButton: {
    backgroundColor: '#4caf50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modeButton: {
    backgroundColor: '#ff9800',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default ResultScreen;