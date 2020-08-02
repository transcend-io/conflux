/* eslint-disable import/no-extraneous-dependencies */
const babel = require('@rollup/plugin-babel').default;
const json = require('@rollup/plugin-json');
const resolve = require('@rollup/plugin-node-resolve').default;
const nodePolyfills = require('rollup-plugin-node-polyfills');
const commonjs = require('@rollup/plugin-commonjs');

// const { join } = require('path');
// const webpackConfig = require('./webpack.config.js');

// const { CI } = process.env;
// const src = join(__dirname, 'src');

// const istanbul = CI
//   ? {
//       // Instrument sourcemaps for code coverage on CI
//       test: /\.(js)?$/,
//       include: [src],
//       use: {
//         loader: 'istanbul-instrumenter-loader',
//         options: { esModules: true },
//       },
//       enforce: 'post',
//     }
//   : {};

module.exports = (config) => ({
  // base path that will be used to resolve all patterns (eg. files, exclude)
  basePath: '',

  // frameworks to use
  // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
  frameworks: ['tap'],

  // list of files / patterns to load in the browser
  files: [{ pattern: 'test/**/*.test.js', watched: false }],

  // list of files / patterns to exclude
  exclude: [],

  // preprocess matching files before serving them to the browser
  // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
  preprocessors: {
    'test/**/*.test.js': ['rollup'], // TODO: re-enable sourcemap?
  },

  // see: https://github.com/jlmakes/karma-rollup-preprocessor
  rollupPreprocessor: {
    output: [
      {
        format: 'iife', // Helps prevent naming collisions.
        name: 'confluxTest', // Required for 'iife' format.
        sourcemap: 'inline', // Sensible for testing.
        file: 'dist/test2.js',
      },
    ],
    plugins: [
      resolve({
        preferBuiltins: true,
      }),
      commonjs(),
      json(),
      nodePolyfills(),
      babel({
        exclude: ['node_modules/**'],
        // see: https://github.com/rollup/plugins/tree/master/packages/babel#babelhelpers and the note about @babel/runtime for CJS/ES
        configFile: './babel.config.js',
      }),
    ],
  },

  // browserNoActivityTimeout: 60000,

  plugins: [
    'karma-rollup-preprocessor',
    'karma-tap',
    // 'karma-coverage',
    // 'karma-webpack',
    // 'karma-sourcemap-loader',
  ],

  // reporters: ['progress', 'coverage'], // TODO: re-enable reporters

  // coverageReporter: {
  //   reporters: [{ type: 'lcov' }],
  // },

  // web server port
  port: 9877,

  // enable / disable colors in the output (reporters and logs)
  colors: true,

  // level of logging
  // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
  logLevel: config.LOG_INFO,

  // enable / disable watching file and executing tests whenever any file changes
  autoWatch: true, // TODO: invert bool

  // Continuous Integration mode
  // if true, Karma captures browsers, runs the tests and exits
  // singleRun: true, // TODO: uncomment

  // Concurrency level
  // how many browser should be started simultaneous
  concurrency: Infinity,
});
