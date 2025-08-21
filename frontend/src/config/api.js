/**
 * VerveQ Platform Frontend Configuration
 * Centralized API configuration with environment detection
 */

// Import Constants for proper Expo environment variable handling
import { Platform } from 'react-native';

// Safely import Constants with fallback
let Constants;
try {
  Constants = require('expo-constants').default;
} catch (error) {
  console.warn('expo-constants not available, using fallbacks');
  Constants = { expoConfig: null, manifest: null };
}

// Environment detection
const getEnvironment = () => {
  // Check if we're in Expo development
  if (__DEV__) {
    return 'development';
  }
  
  // Check for explicit environment variable
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }
  
  // Default to production
  return 'production';
};

// Helper to get API URL with platform-specific defaults
const getApiUrl = () => {
  // First check for explicitly set environment variable
  const envApiUrl = Constants?.expoConfig?.extra?.apiUrl || Constants?.manifest?.extra?.apiUrl;
  if (envApiUrl && envApiUrl !== "${API_URL}") {
    console.log('📍 Using API URL from config:', envApiUrl);
    return envApiUrl;
  }

  // Platform-specific defaults for development
  if (__DEV__) {
    let defaultUrl;
    if (Platform.OS === 'android') {
      // Android emulator uses 10.0.2.2 to access host machine
      defaultUrl = 'http://10.0.2.2:8000';
    } else if (Platform.OS === 'ios') {
      // iOS simulator can use localhost
      defaultUrl = 'http://localhost:8000';
    } else if (Platform.OS === 'web') {
      // Web can use localhost
      defaultUrl = 'http://localhost:8000';
    } else {
      // Physical device - use current network IP from backend
      defaultUrl = 'http://172.28.209.59:8000';
    }
    console.log(`📍 Using platform default for ${Platform.OS}:`, defaultUrl);
    return defaultUrl;
  }
  
  // Production default
  return 'https://api.verveq.com';
};

// Environment-specific configuration
const environments = {
  development: {
    // Development API URL with platform detection
    apiUrl: getApiUrl(),
    debug: true,
    logLevel: 'debug',
  },
  staging: {
    // Staging API URL
    apiUrl: Constants?.expoConfig?.extra?.apiUrl || Constants?.manifest?.extra?.apiUrl || 'https://staging-api.verveq.com',
    debug: false,
    logLevel: 'warn',
  },
  production: {
    // Production API URL
    apiUrl: Constants?.expoConfig?.extra?.apiUrl || Constants?.manifest?.extra?.apiUrl || 'https://api.verveq.com',
    debug: false,
    logLevel: 'error',
  },
};

// Get current environment
const currentEnv = getEnvironment();
const config = environments[currentEnv] || environments.development;

// Configuration object
export const apiConfig = {
  // Environment
  environment: currentEnv,
  isDevelopment: currentEnv === 'development',
  isProduction: currentEnv === 'production',
  
  // API Configuration
  baseURL: config.apiUrl,
  timeout: 10000, // 10 seconds
  
  // Request headers
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  
  // Debug settings
  debug: config.debug,
  logLevel: config.logLevel,
  
  // Endpoints
  endpoints: {
    // Authentication
    auth: {
      login: '/auth/login',
      me: '/auth/me',
      guestSession: '/auth/guest-session',
    },
    
    // Games
    games: {
      quiz: {
        question: (sport) => `/${sport}/quiz/question`,
        check: (sport) => `/${sport}/quiz/check`,
        complete: (sport) => `/${sport}/quiz/complete`,
      },
      survival: {
        initials: (sport) => `/${sport}/survival/initials`,
        guess: (sport) => `/${sport}/survival/guess`,
        reveal: (sport, initials) => `/${sport}/survival/reveal/${initials}`,
        complete: (sport) => `/${sport}/survival/complete`,
        // New session-based endpoints
        start: '/survival/start',
        sessionGuess: '/survival/guess',
        sessionHint: (sessionId) => `/survival/session/${sessionId}/hint`,
        sessionSkip: (sessionId) => `/survival/session/${sessionId}/skip`,
        sessionStatus: (sessionId) => `/survival/session/${sessionId}`,
        sessionEnd: (sessionId) => `/survival/session/${sessionId}`,
      },
    },
    
    // Leaderboards
    leaderboards: {
      global: '/leaderboards/global',
      sport: (sport, mode) => `/leaderboards/${sport}/${mode}`,
    },
    
    // Profile
    profile: {
      user: (userId) => `/profile/${userId}`,
    },
    
    // Challenges
    challenges: {
      pending: '/challenges/pending',
    },
    
    // Sports
    sports: {
      list: '/',
    },
  },
  
  // Network settings
  network: {
    retryAttempts: 3,
    retryDelay: 1000, // 1 second
    connectionTimeout: 5000, // 5 seconds
  },
};

// Helper function to build full URL
export const buildUrl = (endpoint) => {
  if (endpoint.startsWith('http')) {
    return endpoint;
  }
  return `${apiConfig.baseURL}${endpoint}`;
};

// Helper function to get endpoint URL
export const getEndpoint = (category, method, ...params) => {
  try {
    const categoryEndpoints = apiConfig.endpoints[category];
    if (!categoryEndpoints) {
      throw new Error(`Unknown endpoint category: ${category}`);
    }
    
    const endpoint = categoryEndpoints[method];
    if (!endpoint) {
      throw new Error(`Unknown endpoint method: ${category}.${method}`);
    }
    
    if (typeof endpoint === 'function') {
      return buildUrl(endpoint(...params));
    }
    
    return buildUrl(endpoint);
  } catch (error) {
    console.error('Error building endpoint URL:', error);
    throw error;
  }
};

// Helper function to log API calls (development only)
export const logApiCall = (method, url, data = null) => {
  if (apiConfig.debug) {
    console.log(`🌐 API ${method.toUpperCase()}: ${url}`);
    if (data) {
      console.log('📤 Request data:', data);
    }
  }
};

// Helper function to log API responses (development only)
export const logApiResponse = (method, url, response, error = null) => {
  if (apiConfig.debug) {
    if (error) {
      console.error(`❌ API ${method.toUpperCase()} ERROR: ${url}`, error);
    } else {
      console.log(`✅ API ${method.toUpperCase()} SUCCESS: ${url}`);
      console.log('📥 Response data:', response);
    }
  }
};

// Configuration validation
export const validateConfig = () => {
  const errors = [];
  
  if (!apiConfig.baseURL) {
    errors.push('API base URL is not configured');
  }
  
  if (!apiConfig.baseURL.startsWith('http')) {
    errors.push('API base URL must start with http:// or https://');
  }
  
  if (apiConfig.isProduction && apiConfig.baseURL.includes('localhost')) {
    errors.push('Production environment should not use localhost URLs');
  }
  
  if (apiConfig.isProduction && !apiConfig.baseURL.startsWith('https')) {
    errors.push('Production environment should use HTTPS URLs');
  }
  
  if (errors.length > 0) {
    console.error('❌ Configuration validation errors:');
    errors.forEach(error => console.error(`   - ${error}`));
    
    if (apiConfig.isProduction) {
      throw new Error('Configuration validation failed in production');
    }
  }
  
  return errors.length === 0;
};

// Print configuration summary
export const printConfigSummary = () => {
  console.log('📱 VerveQ Frontend Configuration:');
  console.log(`   Environment: ${apiConfig.environment}`);
  console.log(`   Platform: ${Platform.OS}`);
  console.log(`   API URL: ${apiConfig.baseURL}`);
  console.log(`   Debug: ${apiConfig.debug ? 'Enabled' : 'Disabled'}`);
  console.log(`   Timeout: ${apiConfig.timeout}ms`);
  
  // Show environment variable status
  const envApiUrl = Constants?.expoConfig?.extra?.apiUrl || Constants?.manifest?.extra?.apiUrl;
  console.log(`   Environment API URL: ${envApiUrl || 'Not set (using default)'}`);
  
  // Validate configuration
  validateConfig();
};

// Initialize configuration
if (apiConfig.isDevelopment) {
  printConfigSummary();
}

export default apiConfig;