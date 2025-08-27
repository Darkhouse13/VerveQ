import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiConfig } from '../config/api';
import ProfileHeader from '../components/ui/ProfileHeader';
import ProfileContent from '../components/ui/ProfileContent';

const ProfileScreen = ({ navigation, route }) => {
  const { user, apiCall, logout } = useAuth();
  const { theme, styles: themeStyles } = useTheme();
  const { userId } = route.params || { userId: user?.id };
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    loadProfile();
    
    // Animate screen entrance
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [userId]);

  const loadProfile = async () => {
    try {
      const response = await apiCall(apiConfig.endpoints.profile.user(userId));
      if (response.ok) {
        const profileData = await response.json();
        setProfile(profileData);
      }
    } catch (error) {
      console.warn('Failed to load profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProfile();
  };

  const isOwnProfile = userId === user?.id;

  const handleChallenge = (targetUser) => {
    navigation.navigate('Challenges', {
      screen: 'CreateChallenge',
      params: { targetUser }
    });
  };

  const handleEditProfile = () => {
    // Navigate to edit profile or show modal
    console.log('Edit profile requested');
  };

  if (loading) {
    return (
      <SafeAreaView style={[themeStyles.container, styles(theme).container]}>
        <View style={styles(theme).loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary[500]} />
          <Text style={styles(theme).loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[themeStyles.container, styles(theme).container]}>
        <View style={styles(theme).errorContainer}>
          <Text style={styles(theme).errorText}>Profile not found</Text>
          <TouchableOpacity 
            style={styles(theme).backButton} 
            onPress={() => navigation.goBack()}
          >
            <Text style={styles(theme).backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
        {/* Enhanced Profile Header */}
        <ProfileHeader
          user={profile.user}
          profile={profile}
          isOwnProfile={isOwnProfile}
          onEdit={handleEditProfile}
          onChallenge={handleChallenge}
          style={styles(theme).profileHeader}
        />

        {/* Profile Content */}
        <ProfileContent
          profile={profile}
          isOwnProfile={isOwnProfile}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onNavigate={navigation.navigate}
          onLogout={logout}
          style={styles(theme).profileContent}
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
  profileHeader: {
    marginBottom: theme.spacing.lg,
  },
  profileContent: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.mode.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  errorText: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.mode.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    backgroundColor: theme.colors.primary[500],
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.bold,
  },
  // Styles moved to ProfileHeader and ProfileContent components
});

export default ProfileScreen;