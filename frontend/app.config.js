// Dynamic Expo config to allow environment-driven settings without changing app.json
// Reads API URL from process.env.API_URL and falls back to app.json or localhost

const appJson = require('./app.json');

module.exports = () => {
  const expoConfig = appJson.expo || {};
  const existingExtra = expoConfig.extra || {};

  const apiUrl = process.env.API_URL || existingExtra.apiUrl || 'http://localhost:8000';

  return {
    ...expoConfig,
    extra: {
      ...existingExtra,
      apiUrl,
    },
  };
};

