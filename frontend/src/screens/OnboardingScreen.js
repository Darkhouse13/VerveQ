import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ProgressIndicator from '../components/ui/ProgressIndicator';

const { width } = Dimensions.get('window');
const ONBOARDING_COMPLETE_KEY = 'verveq_onboarding_complete';

const OnboardingScreen = ({ navigation }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedSports, setSelectedSports] = useState([]);
  const [selectedSkillLevel, setSelectedSkillLevel] = useState('');
  
  const { theme, styles: themeStyles } = useTheme();

  const sports = [
    { id: 'football', name: 'Football', description: 'Premier League, Champions League, World Cup' },
    { id: 'tennis', name: 'Tennis', description: 'Grand Slams, ATP, WTA Tours' },
    { id: 'basketball', name: 'Basketball', description: 'NBA, FIBA, EuroLeague' },
    { id: 'more', name: 'More Sports', description: 'Coming Soon!' }
  ];

  const skillLevels = [
    { id: 'beginner', name: 'Beginner', description: 'New to sports trivia' },
    { id: 'intermediate', name: 'Intermediate', description: 'Some knowledge' },
    { id: 'expert', name: 'Expert', description: 'Deep sports knowledge' }
  ];

  const handleSportToggle = (sportId) => {
    setSelectedSports(prev => 
      prev.includes(sportId) 
        ? prev.filter(id => id !== sportId)
        : [...prev, sportId]
    );
  };

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeOnboarding();
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
      
      // Store user preferences
      if (selectedSports.length > 0) {
        await AsyncStorage.setItem('verveq_preferred_sports', JSON.stringify(selectedSports));
      }
      if (selectedSkillLevel) {
        await AsyncStorage.setItem('verveq_skill_level', selectedSkillLevel);
      }
      
      navigation.replace('Login');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      navigation.replace('Login');
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return true; // Welcome step
      case 1:
        return selectedSports.length > 0;
      case 2:
        return selectedSkillLevel !== '';
      default:
        return false;
    }
  };

  const renderWelcomeStep = () => (
    <View style={styles(theme).stepContainer}>
      <Text style={[themeStyles.heading1, styles(theme).stepTitle]}>
        Welcome to VerveQ
      </Text>
      <Text style={[themeStyles.body, styles(theme).stepDescription]}>
        The ultimate competitive sports gaming platform
      </Text>
      
      <View style={styles(theme).featuresContainer}>
        <Card elevation="md" style={styles(theme).featureCard}>
          <Text style={styles(theme).featureIcon}>🎯</Text>
          <Text style={[themeStyles.heading3, styles(theme).featureTitle]}>
            ELO Rating System
          </Text>
          <Text style={[themeStyles.caption, styles(theme).featureDescription]}>
            Compete and climb the global rankings
          </Text>
        </Card>

        <Card elevation="md" style={styles(theme).featureCard}>
          <Text style={styles(theme).featureIcon}>⚡</Text>
          <Text style={[themeStyles.heading3, styles(theme).featureTitle]}>
            Multiple Game Modes
          </Text>
          <Text style={[themeStyles.caption, styles(theme).featureDescription]}>
            Quiz trivia and survival challenges
          </Text>
        </Card>

        <Card elevation="md" style={styles(theme).featureCard}>
          <Text style={styles(theme).featureIcon}>🏆</Text>
          <Text style={[themeStyles.heading3, styles(theme).featureTitle]}>
            Achievements
          </Text>
          <Text style={[themeStyles.caption, styles(theme).featureDescription]}>
            Unlock rewards and showcase your skills
          </Text>
        </Card>
      </View>
    </View>
  );

  const renderSportsStep = () => (
    <View style={styles(theme).stepContainer}>
      <Text style={[themeStyles.heading2, styles(theme).stepTitle]}>
        Choose Your Sports
      </Text>
      <Text style={[themeStyles.body, styles(theme).stepDescription]}>
        Select the sports you're interested in
      </Text>
      
      <View style={styles(theme).optionsContainer}>
        {sports.map((sport) => (
          <Card
            key={sport.id}
            elevation={selectedSports.includes(sport.id) ? "lg" : "sm"}
            pressable
            onPress={() => handleSportToggle(sport.id)}
            style={[
              styles(theme).optionCard,
              selectedSports.includes(sport.id) && styles(theme).selectedOptionCard
            ]}
          >
            <Text style={[themeStyles.heading3, styles(theme).optionTitle]}>
              {sport.name}
            </Text>
            <Text style={[themeStyles.caption, styles(theme).optionDescription]}>
              {sport.description}
            </Text>
            {selectedSports.includes(sport.id) && (
              <View style={styles(theme).selectedIndicator}>
                <Text style={styles(theme).checkmark}>✓</Text>
              </View>
            )}
          </Card>
        ))}
      </View>
    </View>
  );

  const renderSkillStep = () => (
    <View style={styles(theme).stepContainer}>
      <Text style={[themeStyles.heading2, styles(theme).stepTitle]}>
        What's Your Level?
      </Text>
      <Text style={[themeStyles.body, styles(theme).stepDescription]}>
        Help us customize your experience
      </Text>
      
      <View style={styles(theme).optionsContainer}>
        {skillLevels.map((level) => (
          <Card
            key={level.id}
            elevation={selectedSkillLevel === level.id ? "lg" : "sm"}
            pressable
            onPress={() => setSelectedSkillLevel(level.id)}
            style={[
              styles(theme).optionCard,
              selectedSkillLevel === level.id && styles(theme).selectedOptionCard
            ]}
          >
            <Text style={[themeStyles.heading3, styles(theme).optionTitle]}>
              {level.name}
            </Text>
            <Text style={[themeStyles.caption, styles(theme).optionDescription]}>
              {level.description}
            </Text>
            {selectedSkillLevel === level.id && (
              <View style={styles(theme).selectedIndicator}>
                <Text style={styles(theme).checkmark}>✓</Text>
              </View>
            )}
          </Card>
        ))}
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return renderWelcomeStep();
      case 1:
        return renderSportsStep();
      case 2:
        return renderSkillStep();
      default:
        return renderWelcomeStep();
    }
  };

  return (
    <SafeAreaView style={[themeStyles.container, styles(theme).container]}>
      <View style={styles(theme).content}>
        {/* Progress Indicator */}
        <View style={styles(theme).progressContainer}>
          <ProgressIndicator
            currentStep={currentStep}
            totalSteps={3}
            size="large"
          />
        </View>

        {/* Step Content */}
        <ScrollView 
          style={styles(theme).scrollView}
          contentContainerStyle={styles(theme).scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderCurrentStep()}
        </ScrollView>

        {/* Navigation Buttons */}
        <View style={styles(theme).navigationContainer}>
          <Button
            title="Skip"
            variant="outline"
            onPress={handleSkip}
            style={styles(theme).skipButton}
          />
          
          <Button
            title={currentStep === 2 ? 'Get Started' : 'Next'}
            variant="primary"
            onPress={handleNext}
            disabled={!canProceed()}
            style={styles(theme).nextButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    // Additional container styles if needed
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    marginTop: theme.spacing.lg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  stepContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  stepTitle: {
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  stepDescription: {
    textAlign: 'center',
    color: theme.colors.mode.textSecondary,
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
  },
  featuresContainer: {
    gap: theme.spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  featureCard: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: theme.spacing.md,
  },
  featureTitle: {
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  featureDescription: {
    textAlign: 'center',
    color: theme.colors.mode.textSecondary,
  },
  optionsContainer: {
    gap: theme.spacing.md,
    width: '100%',
    maxWidth: 400,
  },
  optionCard: {
    position: 'relative',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  selectedOptionCard: {
    borderWidth: 2,
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.primary[50],
  },
  optionTitle: {
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  optionDescription: {
    textAlign: 'center',
    color: theme.colors.mode.textSecondary,
  },
  selectedIndicator: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.borderRadius.full,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: theme.colors.onPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  navigationContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  skipButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
});

export default OnboardingScreen;
