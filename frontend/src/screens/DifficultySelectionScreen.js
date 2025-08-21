import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert
} from 'react-native';

const DifficultySelectionScreen = ({ navigation, route }) => {
  const { sport, theme } = route.params;

  const difficulties = [
    {
      level: 'easy',
      title: 'Easy',
      description: 'Perfect for beginners',
      color: '#4CAF50',
      icon: '🌟'
    },
    {
      level: 'intermediate',
      title: 'Medium',
      description: 'Good challenge for most players',
      color: '#FF9800',
      icon: '🏆'
    },
    {
      level: 'hard',
      title: 'Hard',
      description: 'For true experts',
      color: '#F44336',
      icon: '🔥'
    }
  ];

  const handleDifficultySelect = (difficulty) => {
    console.log('NAVIGATION:', `Difficulty selected: ${difficulty} for sport: ${sport}`);
    
    navigation.navigate('Quiz', {
      sport,
      theme,
      difficulty,
      reset: true // Ensure fresh quiz session
    });
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <Text style={styles.title}>Select Difficulty</Text>
        <Text style={styles.subtitle}>Choose your challenge level for {sport}</Text>
      </View>

      <View style={styles.difficultiesContainer}>
        {difficulties.map((diff, index) => (
          <TouchableOpacity
            key={diff.level}
            style={[styles.difficultyCard, { borderLeftColor: diff.color }]}
            onPress={() => handleDifficultySelect(diff.level)}
            activeOpacity={0.8}
          >
            <View style={styles.difficultyContent}>
              <Text style={styles.difficultyIcon}>{diff.icon}</Text>
              <View style={styles.difficultyText}>
                <Text style={[styles.difficultyTitle, { color: diff.color }]}>
                  {diff.title}
                </Text>
                <Text style={styles.difficultyDescription}>
                  {diff.description}
                </Text>
              </View>
              <Text style={styles.arrow}>→</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          You can change difficulty anytime by starting a new quiz
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#1a237e',
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a237e',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  difficultiesContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  difficultyCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderLeftWidth: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  difficultyContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  difficultyIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  difficultyText: {
    flex: 1,
  },
  difficultyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  difficultyDescription: {
    fontSize: 16,
    color: '#6c757d',
  },
  arrow: {
    fontSize: 20,
    color: '#dee2e6',
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 14,
    color: '#6c757d',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default DifficultySelectionScreen;