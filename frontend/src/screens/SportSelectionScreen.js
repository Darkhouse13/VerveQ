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

const SportSelectionScreen = ({ navigation, route }) => {
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState(null);
  const { mode } = route.params || { mode: 'quiz' };

  useEffect(() => {
    loadAvailableSports();
  }, []);

  const loadAvailableSports = async () => {
    try {
      const url = buildUrl('/sports');
      logApiCall('GET', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      logApiResponse('GET', url, data);
      setSports(data.sports);
    } catch (error) {
      logApiResponse('GET', buildUrl('/sports'), null, error);
      Alert.alert('Error', 'Failed to load sports. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectSport = async (sport) => {
    try {
      setSelectedSport(sport);
      
      // Get sport theme
      const url = buildUrl(`/sports/${sport}/theme`);
      logApiCall('GET', url);
      
      const themeResponse = await fetch(url);
      const theme = await themeResponse.json();
      
      logApiResponse('GET', url, theme);
      
      // Navigate to the appropriate game mode with sport and theme
      if (mode === 'quiz') {
        navigation.navigate('Quiz', { sport, theme });
      } else {
        navigation.navigate('Survival', { sport, theme });
      }
    } catch (error) {
      logApiResponse('GET', buildUrl(`/sports/${sport}/theme`), null, error);
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
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1a237e" />
          <Text style={styles.loadingText}>Loading sports...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Choose Your Sport</Text>
        <Text style={styles.subtitle}>
          Select a sport for {mode === 'quiz' ? 'Quiz' : 'Survival'} mode
        </Text>
        
        <View style={styles.sportsContainer}>
          {sports.map((sport) => (
            <TouchableOpacity
              key={sport}
              style={[
                styles.sportButton,
                selectedSport === sport && styles.selectedSport
              ]}
              onPress={() => selectSport(sport)}
              disabled={selectedSport !== null}
              activeOpacity={0.8}
            >
              <Text style={styles.sportIcon}>
                {getSportIcon(sport)}
              </Text>
              <Text style={styles.sportName}>
                {getSportDisplayName(sport)}
              </Text>
              {selectedSport === sport && (
                <ActivityIndicator size="small" color="#fff" style={styles.loader} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>← Back to Modes</Text>
          </TouchableOpacity>
          
          <Text style={styles.footerText}>
            More sports coming soon!
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a237e',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  sportsContainer: {
    gap: 16,
  },
  sportButton: {
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
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  selectedSport: {
    backgroundColor: '#1a237e',
    borderColor: '#1a237e',
  },
  sportIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  sportName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
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
    backgroundColor: '#666',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footerText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
});

export default SportSelectionScreen;