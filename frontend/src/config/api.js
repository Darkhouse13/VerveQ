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

const isExpoDev = (typeof __DEV__ !== 'undefined' && __DEV__);

// Environment detection
const getEnvironment = () => {
  // Check if we're in Expo development
  if (isExpoDev) {
    return 'development';
  }
  
  // Check for explicit environment variable
  if (process.env.NODE_ENV) {
    return process.env.NODE_ENV;
  }
  
  // Default to production
  return 'production';
};

// Helper: parse Expo dev host / LAN IP from Constants
const resolveExpoDevHost = () => {
  try {
    const hostUri =
      Constants?.expoConfig?.hostUri ||
      Constants?.manifest?.hostUri ||
      Constants?.manifest?.debuggerHost;
    if (hostUri && typeof hostUri === 'string') {
      const host = hostUri.split(':')[0];
      return host;
    }
  } catch (e) {
    // ignore
  }
  return null;
};

// Helper: basic check for private LAN IPv4
const isPrivateLanIp = (host) => {
  if (!host) return false;
  return (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
  );
};

const buildLanUrl = (host, port = '8000') => `http://${host}:${port}`;

// Helper to get API URL with platform-specific defaults
const getApiUrl = () => {
  // First check for explicitly set environment variable
  const envApiUrl = Constants?.expoConfig?.extra?.apiUrl || Constants?.manifest?.extra?.apiUrl;
  if (envApiUrl && envApiUrl !== "${API_URL}") {
    console.log('ðŸ“ Using API URL from config:', envApiUrl);
    return envApiUrl;
  }

  // Development auto-detection
  if (isExpoDev) {
    const host = resolveExpoDevHost();

    // If we resolved a LAN host from Expo, prefer it
    if (host) {
      // Android emulator special-case when host resolves to localhost/127.0.0.1
      if (Platform.OS === 'android' && (host === 'localhost' || host === '127.0.0.1')) {
        const url = 'http://10.0.2.2:8000';
        console.log('ðŸ“ Using Android emulator host:', url);
        return url;
      }
      // Use detected host for device/simulator
      const url = buildLanUrl(host, '8000');
      console.log(`ðŸ“ Using resolved Expo dev host for ${Platform.OS}:`, url);
      return url;
    }

    // Fallbacks when host could not be resolved
    if (Platform.OS === 'android') {
      const url = 'http://10.0.2.2:8000';
      console.log('ðŸ“ Using Android emulator fallback:', url);
      return url;
    }
    if (Platform.OS === 'web') {
      const url = 'http://localhost:8000';
      console.log('ðŸ“ Using web fallback:', url);
      return url;
    }

    // Last resort: instruct to set expo.extra.apiUrl
    const url = 'http://localhost:8000';
    console.warn('âš ï¸ Could not resolve LAN host. Consider setting expo.extra.apiUrl in app.json. Falling back to:', url);
    return url;
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
        session: (sport) => `/${sport}/quiz/session`,
        question: (sport) => `/${sport}/quiz/question`,
        check: (sport) => `/${sport}/quiz/check`,
        complete: (sport) => `/${sport}/quiz/complete`,
        endSession: (sport, sessionId) => `/${sport}/quiz/session/${sessionId}`,
        feedback: (sport) => `/${sport}/quiz/feedback`,
      },
      survival: {
        initials: (sport) => `/${sport}/survival/initials`,
        guess: (sport) => `/${sport}/survival/guess`,
        reveal: (sport, initials) => `/${sport}/survival/reveal/${initials}`,
        complete: (sport) => `/${sport}/survival/complete`,
        // Session-based endpoints (with /survival prefix)
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
      create: '/challenges/create',
      accept: (challengeId) => `/challenges/accept/${challengeId}`,
      decline: (challengeId) => `/challenges/decline/${challengeId}`,
      status: (challengeId) => `/challenges/${challengeId}/status`,
    },
    
    // Sports
    sports: {
      list: '/sports',
      theme: (sport) => `/sports/${sport}/theme`,
    },
    
    // Achievements
    achievements: {
      list: '/achievements',
      user: (userId) => `/achievements/user/${userId}`,
      check: (userId) => `/achievements/check/${userId}`,
    },
    
    // Health/Status
    health: {
      basic: '/health',
      detailed: '/health/detailed',
      ready: '/health/ready',
      live: '/health/live',
      metrics: '/health/metrics',
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
    console.log(`ðŸŒ API ${method.toUpperCase()}: ${url}`);
    if (data) {
      console.log('ðŸ“¤ Request data:', data);
    }
  }
};

// Helper function to log API responses (development only)
export const logApiResponse = (method, url, response, error = null) => {
  if (apiConfig.debug) {
    if (error) {
      console.error(`âŒ API ${method.toUpperCase()} ERROR: ${url}`, error);
    } else {
      console.log(`âœ… API ${method.toUpperCase()} SUCCESS: ${url}`);
      console.log('ðŸ“¥ Response data:', response);
    }
  }
};

// One-shot connectivity probe to verify chosen baseURL in development
export const probeApiReachability = (baseURL, timeoutMs = 1500) => {
  try {
    const url = `${baseURL.replace(/\/$/, '')}/health`;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const id = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    logApiCall('GET', url);
    return fetch(url, { signal: controller ? controller.signal : undefined })
      .then(res => {
        if (id) clearTimeout(id);
        if (res.ok) {
          console.log('ðŸ”Œ API reachable:', url);
        } else {
          console.warn(`âš ï¸ API responded with status ${res.status}:`, url);
        }
      })
      .catch(err => {
        if (id) clearTimeout(id);
        console.warn('âŒ API unreachable:', url, err?.message || err);
      });
  } catch (e) {
    console.warn('âŒ API probe failed to start:', e?.message || e);
    return Promise.resolve();
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
    console.error('âŒ Configuration validation errors:');
    errors.forEach(error => console.error(`   - ${error}`));
    
    if (apiConfig.isProduction) {
      throw new Error('Configuration validation failed in production');
    }
  }
  
  return errors.length === 0;
};

// Print configuration summary
export const printConfigSummary = () => {
  console.log('ðŸ“± VerveQ Frontend Configuration:');
  console.log(`   Environment: ${apiConfig.environment}`);
  console.log(`   Platform: ${Platform.OS}`);
  console.log(`   API URL: ${apiConfig.baseURL}`);
  console.log(`   Debug: ${apiConfig.debug ? 'Enabled' : 'Disabled'}`);
  console.log(`   Timeout: ${apiConfig.timeout}ms`);
  
  // Show environment variable status
  const envApiUrl = Constants?.expoConfig?.extra?.apiUrl || Constants?.manifest?.extra?.apiUrl;
  console.log(`   Environment API URL: ${envApiUrl || 'Not set (using default)'}`);

  // Show resolved Expo dev host when available
  if (isExpoDev) {
    const host = resolveExpoDevHost();
    console.log(`   Resolved Expo host: ${host || 'Not resolved'}`);
  }
  
  // Validate configuration
  validateConfig();
};

// Initialize configuration
if (apiConfig.isDevelopment) {
  printConfigSummary();
  // Fire-and-forget connectivity probe
  try { probeApiReachability(apiConfig.baseURL); } catch (e) { /* noop */ }
}

export default apiConfig;

