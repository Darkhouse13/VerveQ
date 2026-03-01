import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { apiConfig, buildUrl, logApiCall, logApiResponse } from '../config/api';
import { useTheme } from '../context/ThemeContext';

const SportSelectionScreen = ({ navigation, route }) => {
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState(null);
  const { mode } = route.params || { mode: 'quiz' };
  const { theme } = useTheme();

  useEffect(() => {
    loadAvailableSports();
  }, []);

  const loadAvailableSports = async () => {
    try {
      const url = buildUrl(apiConfig.endpoints.sports.list);
      logApiCall('GET', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      logApiResponse('GET', url, data);
      setSports(data.sports);
    } catch (error) {
      logApiResponse('GET', buildUrl(apiConfig.endpoints.sports.list), null, error);
      Alert.alert('Error', 'Failed to load sports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectSport = async (sport) => {
    try {
      setSelectedSport(sport);
      
      // Get sport theme
      const url = buildUrl(apiConfig.endpoints.sports.theme(sport));
      logApiCall('GET', url);
      
      const themeResponse = await fetch(url);
      const theme = await themeResponse.json();
      
      logApiResponse('GET', url, theme);
      
      // Navigate to the appropriate game mode with sport and theme
      if (mode === 'quiz') {
        navigation.navigate('DifficultySelection', { sport, theme });
      } else {
        navigation.navigate('Survival', { sport, theme });
      }
    } catch (error) {
      logApiResponse('GET', buildUrl(apiConfig.endpoints.sports.theme(sport)), null, error);
      Alert.alert('Error', 'Failed to load sport theme. Please try again.');
      setSelectedSport(null);
    }
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

  if (loading) {
    return (
      <SafeAreaView style={styles(theme).container}>
        <View style={styles(theme).loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary[500]} />
          <Text style={styles(theme).loadingText}>Loading sports...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles(theme).container}>
      <View style={styles(theme).content}>
        <Text style={styles(theme).title}>Choose Your Sport</Text>
        <Text style={styles(theme).subtitle}>
          Select a sport for {mode === 'quiz' ? 'Quiz' : 'Survival'} mode
        </Text>
        
        <View style={styles(theme).sportsContainer}>
          {sports.map((sport) => (
            <TouchableOpacity
              key={sport}
              style={[
                styles(theme).sportButton,
                selectedSport === sport && styles(theme).selectedSport
              ]}
              onPress={() => selectSport(sport)}
              disabled={selectedSport !== null}
              activeOpacity={0.8}
            >
              <Text style={styles(theme).sportIcon}>
                {getSportIcon(sport)}
              </Text>
              <Text style={styles(theme).sportName}>
                {getSportDisplayName(sport)}
              </Text>
              {selectedSport === sport && (
                <ActivityIndicator size="small" color={theme.colors.onPrimary} style={styles(theme).loader} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles(theme).footer}>
          <TouchableOpacity
            style={styles(theme).backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles(theme).backButtonText}>← Back to Modes</Text>
          </TouchableOpacity>
          
          <Text style={styles(theme).footerText}>
            More sports coming soon!
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: theme.colors.mode.textSecondary,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.primary[500],
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.mode.textSecondary,
    textAlign: 'center',
    marginBottom: 40,
  },
  sportsContainer: {
    gap: 16,
  },
  sportButton: {
    backgroundColor: theme.colors.mode.surface,
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
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  selectedSport: {
    backgroundColor: theme.colors.primary[500],
    borderColor: theme.colors.primary[500],
  },
  sportIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  sportName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.mode.text,
    flex: 1,
  },
  loader: {
    marginLeft: 16,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    backgroundColor: theme.colors.neutral[700],
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: theme.colors.onPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.mode.textSecondary,
    fontStyle: 'italic',
  },
});

export default SportSelectionScreen;
