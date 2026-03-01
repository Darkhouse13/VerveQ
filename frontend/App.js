import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SessionProvider } from './src/context/SessionContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { useOnboarding } from './src/hooks/useOnboarding';
import ErrorBoundary from './src/components/ErrorBoundary';
import ConnectionStatus from './src/components/ui/ConnectionStatus';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import SportSelectionScreen from './src/screens/SportSelectionScreen';
import DifficultySelectionScreen from './src/screens/DifficultySelectionScreen';
import QuizScreen from './src/screens/QuizScreen';
import SurvivalScreen from './src/screens/SurvivalScreen';
import ResultScreen from './src/screens/ResultScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import ChallengeScreen from './src/screens/ChallengeScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function ThemedStatusBar() {
  const { theme } = useTheme();
  return <StatusBar style={theme.isDark ? 'light' : 'dark'} />;
}

const getTabBarIcon = (routeName, focused) => {
  // Ionicons mapping for better readability & consistency
  const icons = {
    Home: focused ? 'home' : 'home-outline',
    Leaderboards: focused ? 'trophy' : 'trophy-outline',
    Challenges: focused ? 'people' : 'people-outline',
    Profile: focused ? 'person' : 'person-outline',
  };
  return icons[routeName] || (focused ? 'ellipse' : 'ellipse-outline');
};

function MainTabs() {
  const { theme } = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          const iconName = getTabBarIcon(route.name, focused);
          return <Ionicons name={iconName} size={22} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary[500],
        tabBarInactiveTintColor: theme.colors.mode.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.mode.background,
          borderTopWidth: 1,
          borderTopColor: theme.colors.mode.border,
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
          ...theme.elevation.sm
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: theme.colors.mode.surface,
          ...theme.elevation.md
        },
        headerTintColor: theme.colors.mode.text,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ title: 'VerveQ Platform', tabBarLabel: 'Home' }}
      />
      <Tab.Screen 
        name="Leaderboards" 
        component={LeaderboardScreen}
        options={{ title: 'Rankings', tabBarLabel: 'Ranks' }}
      />
      <Tab.Screen 
        name="Challenges" 
        component={ChallengeScreen}
        options={{ title: 'Social', tabBarLabel: 'Social' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: 'Profile', tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

function AuthenticatedApp() {
  const { theme } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.mode.surface,
          ...theme.elevation.md
        },
        headerTintColor: theme.colors.mode.text,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
      }}
    >
      <Stack.Screen 
        name="MainTabs" 
        component={MainTabs} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="SportSelection" 
        component={SportSelectionScreen} 
        options={{ title: 'Choose Sport' }}
      />
      <Stack.Screen 
        name="DifficultySelection" 
        component={DifficultySelectionScreen} 
        options={({ route }) => ({ 
          title: `${route.params?.sport ? route.params.sport.charAt(0).toUpperCase() + route.params.sport.slice(1) : 'Sports'} Difficulty` 
        })}
      />
      <Stack.Screen 
        name="Dashboard" 
        component={DashboardScreen} 
        options={{ title: 'Your Stats' }}
      />
      <Stack.Screen 
        name="Quiz" 
        options={({ route }) => ({ 
          title: `${route.params?.sport ? route.params.sport.charAt(0).toUpperCase() + route.params.sport.slice(1) : 'Sports'} Quiz` 
        })}
      >
        {(props) => (
          <ErrorBoundary navigation={props.navigation}>
            <QuizScreen {...props} />
          </ErrorBoundary>
        )}
      </Stack.Screen>
      <Stack.Screen 
        name="Survival" 
        options={({ route }) => ({ 
          title: `${route.params?.sport ? route.params.sport.charAt(0).toUpperCase() + route.params.sport.slice(1) : 'Sports'} Survival` 
        })}
      >
        {(props) => (
          <ErrorBoundary navigation={props.navigation}>
            <SurvivalScreen {...props} />
          </ErrorBoundary>
        )}
      </Stack.Screen>
      <Stack.Screen 
        name="Result" 
        component={ResultScreen} 
        options={{ title: 'Results' }}
      />
    </Stack.Navigator>
  );
}

function UnauthenticatedApp() {
  const { theme } = useTheme();
  const { isOnboardingComplete, loading: onboardingLoading } = useOnboarding();
  
  if (onboardingLoading) {
    return null; // Could show splash screen here
  }
  
  return (
    <Stack.Navigator
      initialRouteName={isOnboardingComplete ? "Login" : "Onboarding"}
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.mode.surface,
          ...theme.elevation.md
        },
        headerTintColor: theme.colors.mode.text,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
      }}
    >
      <Stack.Screen 
        name="Onboarding" 
        component={OnboardingScreen} 
        options={{ 
          title: 'Welcome',
          headerShown: false 
        }}
      />
      <Stack.Screen 
        name="Login" 
        component={LoginScreen} 
        options={{ 
          title: 'Welcome to VerveQ',
          headerShown: false 
        }}
      />
    </Stack.Navigator>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return null; // Could show splash screen here
  }

  return user ? <AuthenticatedApp /> : <UnauthenticatedApp />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SessionProvider>
          <NavigationContainer>
            <ThemedStatusBar />
            <ConnectionStatus />
            <AppContent />
          </NavigationContainer>
        </SessionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
