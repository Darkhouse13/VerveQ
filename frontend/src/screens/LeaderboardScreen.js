import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Animated,
  Dimensions,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiConfig } from '../config/api';
import FilterBar from '../components/ui/FilterBar';
import LeaderboardList from '../components/ui/LeaderboardList';
import { LeaderboardSkeleton } from '../components/ui/ContentSkeletons';
import ResponsiveGrid from '../components/ui/ResponsiveGrid';
import useDynamicSizing from '../hooks/useDynamicSizing';
import useOrientation from '../hooks/useOrientation';
import ErrorFallback from '../components/ui/ErrorFallback';
import DynamicText from '../components/ui/DynamicText';

const { width } = Dimensions.get('window');

const LeaderboardScreen = ({ navigation }) => {
  const { apiCall, user } = useAuth();
  const { theme, styles: themeStyles } = useTheme();
  const { isTablet, deviceType, getContentWidth } = useDynamicSizing();
  const { orientation, isLandscape } = useOrientation();
  const [fadeAnim] = useState(new Animated.Value(0));
  
  const [leaderboards, setLeaderboards] = useState({});
  const [globalLeaderboard, setGlobalLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSport, setSelectedSport] = useState('football');
  const [selectedMode, setSelectedMode] = useState('quiz');
  const [selectedPeriod, setSelectedPeriod] = useState('all_time');
  const [showGlobal, setShowGlobal] = useState(false);

  const filterConfig = [
    {
      type: 'sport',
      label: 'Sport',
      options: [
        { value: 'football', label: 'Football' },
        { value: 'tennis', label: 'Tennis' },
        { value: 'basketball', label: 'Basketball' },
      ]
    },
    {
      type: 'mode', 
      label: 'Mode',
      options: [
        { value: 'quiz', label: 'Quiz' },
        { value: 'survival', label: 'Survival' },
      ]
    },
    {
      type: 'period',
      label: 'Period', 
      options: [
        { value: 'all_time', label: 'All Time' },
        { value: 'monthly', label: 'This Month' },
        { value: 'weekly', label: 'This Week' },
        { value: 'daily', label: 'Today' },
      ]
    }
  ];

  const currentFilters = {
    sport: selectedSport,
    mode: selectedMode,
    period: selectedPeriod,
  };

  useEffect(() => {
    loadLeaderboards();
    
    // Animate screen entrance
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [selectedSport, selectedMode, selectedPeriod, showGlobal]);

  const loadLeaderboards = async () => {
    try {
      if (showGlobal) {
        const response = await apiCall(apiConfig.endpoints.leaderboards.global);
        if (response.ok) {
          const data = await response.json();
          setGlobalLeaderboard(data.leaderboard);
        }
      } else {
        const response = await apiCall(
          `${apiConfig.endpoints.leaderboards.sport(selectedSport, selectedMode)}?period=${selectedPeriod}&limit=50`
        );
        if (response.ok) {
          const data = await response.json();
          setLeaderboards({
            ...leaderboards,
            [`${selectedSport}_${selectedMode}_${selectedPeriod}`]: data.leaderboard
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load leaderboards:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLeaderboards();
  };

  const getCurrentLeaderboard = () => {
    if (showGlobal) {
      return globalLeaderboard;
    }
    return leaderboards[`${selectedSport}_${selectedMode}_${selectedPeriod}`] || [];
  };

  const navigateToProfile = (targetUser) => {
    navigation.navigate('Profile', { userId: targetUser.id });
  };

  const handleChallenge = (targetUser) => {
    navigation.navigate('Challenges', { 
      screen: 'CreateChallenge',
      params: { targetUser }
    });
  };

  const handleFilterChange = (type, value) => {
    switch (type) {
      case 'sport':
        setSelectedSport(value);
        break;
      case 'mode':
        setSelectedMode(value);
        break;
      case 'period':
        setSelectedPeriod(value);
        break;
    }
  };

  const handleGlobalToggle = (isGlobal) => {
    setShowGlobal(isGlobal);
  };

  const currentLeaderboard = getCurrentLeaderboard();

  return (
    <SafeAreaView style={[themeStyles.container, styles(theme).container]}>
      <Animated.View 
        style={[
          styles(theme).content,
          { 
            opacity: fadeAnim,
            transform: [{ 
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              })
            }]
          }
        ]}
      >
        {/* Enhanced Filter Bar */}
        <FilterBar
          filters={filterConfig}
          activeFilter={currentFilters}
          onFilterChange={handleFilterChange}
          showGlobalToggle={true}
          isGlobal={showGlobal}
          onGlobalToggle={handleGlobalToggle}
          style={styles(theme).filterBar}
        />

        {/* Enhanced Leaderboard Header */}
        <View style={styles(theme).headerContainer}>
          <Text style={[themeStyles.heading2, styles(theme).headerTitle]}>
            {showGlobal 
              ? 'Global Champions' 
              : `${selectedSport.charAt(0).toUpperCase() + selectedSport.slice(1)} ${selectedMode.charAt(0).toUpperCase() + selectedMode.slice(1)}`
            }
          </Text>
          {!showGlobal && (
            <Text style={[themeStyles.caption, styles(theme).headerSubtitle]}>
              {filterConfig.find(f => f.type === 'period')?.options.find(o => o.value === selectedPeriod)?.label}
            </Text>
          )}
        </View>

        {/* Enhanced Leaderboard List */}
        <LeaderboardList
          data={currentLeaderboard}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onUserPress={navigateToProfile}
          onChallenge={handleChallenge}
          showPosition={!showGlobal}
          style={styles(theme).leaderboardList}
        />
      </Animated.View>
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
  filterBar: {
    marginBottom: theme.spacing.lg,
  },
  headerContainer: {
    marginBottom: theme.spacing.lg,
    alignItems: 'center',
  },
  headerTitle: {
    textAlign: 'center',
    color: theme.colors.mode.text,
    marginBottom: theme.spacing.xs,
  },
  headerSubtitle: {
    textAlign: 'center',
    color: theme.colors.mode.textSecondary,
  },
  leaderboardList: {
    flex: 1,
  },
});

export default LeaderboardScreen;