// Safe environment check that works across React Native, Expo, and web
export const isDevelopment = () => {
  // Check if __DEV__ is defined (React Native/Expo)
  if (typeof __DEV__ !== 'undefined') {
    return __DEV__;
  }
  
  // Fallback to NODE_ENV (web/other environments)
  return process.env.NODE_ENV === 'development';
};

export const getEnvironment = () => {
  if (isDevelopment()) {
    return 'development';
  }
  return process.env.NODE_ENV || 'production';
};