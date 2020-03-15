const { join } = require('path');
const webpackConfig = require('./webpack.config.js');

const src = join(__dirname, 'src');

module.exports = (config) => ({
  // base path that will be used to resolve all patterns (eg. files, exclude)
  basePath: '',

  // frameworks to use
  // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
  frameworks: ['tap'],

  // list of files / patterns to load in the browser
  files: [
    {
      pattern: 'src/read.js',
      included: true,
      served: true,
      nocache: false,
    },
    {
      pattern: 'src/write.js',
      included: true,
      served: true,
      nocache: false,
    },
    {
      pattern: 'src/crc.js',
      included: false,
      served: true,
      nocache: false,
    },
    {
      pattern: 'src/index.test.js',
      included: true,
      served: true,
      nocache: false,
    },
  ],

  // list of files / patterns to exclude
  exclude: [],

  // preprocess matching files before serving them to the browser
  // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
  preprocessors: {
    'src/**': ['webpack', 'sourcemap'],
  },

  // webpack configuration
  webpack: {
    // eslint-disable-next-line global-require
    ...webpackConfig,
    module: {
      ...webpackConfig.module,
      rules: [
        ...webpackConfig.module.rules,
        {
          // Instrument sourcemaps for code coverage
          test: /\.(js)?$/,
          include: [src],
          use: {
            loader: 'istanbul-instrumenter-loader',
            options: { esModules: true },
          },
          enforce: 'post',
        },
      ],
    },
  },

  plugins: [
    'karma-tap',
    'karma-coverage',
    'karma-webpack',
    'karma-sourcemap-loader',
  ],

  reporters: ['progress', 'coverage'],

  coverageReporter: {
    reporters: [{ type: 'lcov' }],
  },

  // web server port
  port: 9877,

  // enable / disable colors in the output (reporters and logs)
  colors: true,

  // level of logging
  // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
  logLevel: config.LOG_INFO,

  // enable / disable watching file and executing tests whenever any file changes
  autoWatch: false,

  // Continuous Integration mode
  // if true, Karma captures browsers, runs the tests and exits
  singleRun: true,

  // Concurrency level
  // how many browser should be started simultaneous
  concurrency: Infinity,
});
