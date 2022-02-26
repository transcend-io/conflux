// Karma configuration
const getGlobalConfig = require('./karma.global.js');

module.exports = (config) => {
  const globalConfig = getGlobalConfig(config);

  config.set({
    ...globalConfig,

    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: false,

    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['Chrome', 'Firefox'],

    plugins: [
      ...globalConfig.plugins,
      'karma-chrome-launcher',
      'karma-firefox-launcher',
    ],
  });
};
