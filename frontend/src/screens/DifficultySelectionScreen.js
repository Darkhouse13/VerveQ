import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

const DifficultySelectionScreen = ({ navigation, route }) => {
  const { sport, theme: sportTheme } = route.params;
  const { theme } = useTheme();

  const difficulties = [
    {
      level: 'easy',
      title: 'Easy',
      description: 'Perfect for beginners',
      color: theme.colors.success.light,
      icon: '🌟'
    },
    {
      level: 'intermediate',
      title: 'Medium',
      description: 'Good challenge for most players',
      color: theme.colors.warning.light,
      icon: '🏆'
    },
    {
      level: 'hard',
      title: 'Hard',
      description: 'For true experts',
      color: theme.colors.error.light,
      icon: '🔥'
    }
  ];

  const handleDifficultySelect = (difficulty) => {
    console.log('NAVIGATION:', `Difficulty selected: ${difficulty} for sport: ${sport}`);
    
    navigation.navigate('Quiz', {
      sport,
      theme: sportTheme,
      difficulty,
      reset: true // Ensure fresh quiz session
    });
  };

  const handleGoBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles(theme).container}>
      <View style={styles(theme).header}>
        <TouchableOpacity style={styles(theme).backButton} onPress={handleGoBack}>
          <Text style={styles(theme).backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <Text style={styles(theme).title}>Select Difficulty</Text>
        <Text style={styles(theme).subtitle}>Choose your challenge level for {sport}</Text>
      </View>

      <View style={styles(theme).difficultiesContainer}>
        {difficulties.map((diff, index) => (
          <TouchableOpacity
            key={diff.level}
            style={[styles(theme).difficultyCard, { borderLeftColor: diff.color }]}
            onPress={() => handleDifficultySelect(diff.level)}
            activeOpacity={0.8}
          >
            <View style={styles(theme).difficultyContent}>
              <Text style={styles(theme).difficultyIcon}>{diff.icon}</Text>
              <View style={styles(theme).difficultyText}>
                <Text style={[styles(theme).difficultyTitle, { color: diff.color }]}>
                  {diff.title}
                </Text>
                <Text style={styles(theme).difficultyDescription}>
                  {diff.description}
                </Text>
              </View>
              <Text style={styles(theme).arrow}>→</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles(theme).footer}>
        <Text style={styles(theme).footerText}>
          You can change difficulty anytime by starting a new quiz
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.mode.background,
  },
  header: {
    padding: 20,
    backgroundColor: theme.colors.mode.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.mode.border,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.mode.surfaceVariant,
    borderRadius: 8,
    marginBottom: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: theme.colors.primary[500],
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.primary[500],
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.mode.textSecondary,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  difficultiesContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  difficultyCard: {
    backgroundColor: theme.colors.mode.surface,
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
    color: theme.colors.mode.textSecondary,
  },
  arrow: {
    fontSize: 20,
    color: theme.colors.mode.border,
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.mode.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default DifficultySelectionScreen;
