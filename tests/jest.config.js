/**
 * Jest configuration for VerveQ frontend tests
 */
module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/frontend/setup.js'],
  
  // Module paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/frontend/src/$1',
  },
  
  // Transform files
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  
  // Test match patterns
  testMatch: [
    '<rootDir>/tests/frontend/**/*.test.js',
    '<rootDir>/tests/e2e/**/*.test.js',
  ],
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'frontend/src/**/*.{js,jsx}',
    '!frontend/src/index.js',
    '!frontend/src/reportWebVitals.js',
    '!frontend/node_modules/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
  
  // Module directories
  moduleDirectories: ['node_modules', 'frontend/node_modules'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/frontend/node_modules/',
  ],
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation)/)',
  ],
  
  // Globals
  globals: {
    __DEV__: true,
  },
  
  // Verbose output
  verbose: true,
};