const path = require('path');
module.exports = function (api) {
  api.cache(true);
  // Resolve babel-preset-expo from frontend's node_modules to satisfy Jest
  let expoPreset;
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    expoPreset = require(path.join(__dirname, 'frontend', 'node_modules', 'babel-preset-expo'));
  } catch (e) {
    expoPreset = 'babel-preset-expo';
  }
  return {
    presets: [expoPreset],
  };
};
