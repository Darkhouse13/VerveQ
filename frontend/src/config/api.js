/**
 * VerveQ Platform Frontend Configuration
 * Centralized API configuration with environment detection
 */

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

// Environment-specific configuration
const environments = {
  development: {
    // Development API URL - replace with your local IP
    apiUrl: process.env.REACT_APP_API_URL || 'http://192.168.1.174:8000',
    debug: true,
    logLevel: 'debug',
  },
  staging: {
    // Staging API URL
    apiUrl: process.env.REACT_APP_API_URL || 'https://staging-api.verveq.com',
    debug: false,
    logLevel: 'warn',
  },
  production: {
    // Production API URL
    apiUrl: process.env.REACT_APP_API_URL || 'https://api.verveq.com',
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
      },
      survival: {
        initials: (sport) => `/${sport}/survival/initials`,
        guess: (sport) => `/${sport}/survival/guess`,
        reveal: (sport, initials) => `/${sport}/survival/reveal/${initials}`,
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
  console.log(`   API URL: ${apiConfig.baseURL}`);
  console.log(`   Debug: ${apiConfig.debug ? 'Enabled' : 'Disabled'}`);
  console.log(`   Timeout: ${apiConfig.timeout}ms`);
  
  // Validate configuration
  validateConfig();
};

// Initialize configuration
if (apiConfig.isDevelopment) {
  printConfigSummary();
}

export default apiConfig;