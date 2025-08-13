import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SessionProvider } from './src/context/SessionContext';
import ErrorBoundary from './src/components/ErrorBoundary';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import SportSelectionScreen from './src/screens/SportSelectionScreen';
import QuizScreen from './src/screens/QuizScreen';
import SurvivalScreen from './src/screens/SurvivalScreen';
import ResultScreen from './src/screens/ResultScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import ChallengeScreen from './src/screens/ChallengeScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const getTabBarIcon = (routeName, focused) => {
  const icons = {
    Home: focused ? '🏠' : '🏡',
    Leaderboards: focused ? '🏆' : '🏅',
    Challenges: focused ? '⚡' : '⚪',
    Profile: focused ? '👤' : '👥',
  };
  return icons[routeName] || '📱';
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const icon = getTabBarIcon(route.name, focused);
          return <span style={{ fontSize: 24 }}>{icon}</span>;
        },
        tabBarActiveTintColor: '#1a237e',
        tabBarInactiveTintColor: '#666',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e9ecef',
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: 'bold',
        },
        headerStyle: {
          backgroundColor: '#1a237e',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ title: 'VerveQ Platform' }}
      />
      <Tab.Screen 
        name="Leaderboards" 
        component={LeaderboardScreen}
        options={{ title: 'Rankings' }}
      />
      <Tab.Screen 
        name="Challenges" 
        component={ChallengeScreen}
        options={{ title: 'Social' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

function AuthenticatedApp() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1a237e',
        },
        headerTintColor: '#fff',
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
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: '#1a237e',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
      }}
    >
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
    <AuthProvider>
      <SessionProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <AppContent />
        </NavigationContainer>
      </SessionProvider>
    </AuthProvider>
  );
}