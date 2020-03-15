/**
 * All test logic lives in the Karma files - (any difference in test bundles happens there)
 * The only env differences is prod vs dev - the tests work in both environments.
 */
const { join } = require('path');
const TerserPlugin = require('terser-webpack-plugin');

const src = join(__dirname, 'src');
const example = join(__dirname, 'example');

const shouldMinify = ['staging', 'production'].includes(process.env.DEPLOY_ENV);

const config = {
  node: {
    fs: 'empty',
  },
  mode: shouldMinify ? 'production' : 'development',
  entry: {
    index: `${src}/index.js`,
    tests: `${src}/index.test.js`,
    'example/downloadZip/index': `${example}/downloadZip/index.js`,
    'example/pipes/index': `${example}/pipes/index.js`,
    'example/pipes2/index': `${example}/pipes2/index.js`,
    'example/reading/index': `${example}/reading/index.js`,
  },
  output: {
    path: join(__dirname, 'build'),
    filename: '[name].js',
  },
  resolve: {
    extensions: ['.js'],
  },
  watch: false,
  module: {
    rules: [
      {
        test: /\.(js|jsx)?$/, // Transform all .js/.jsx files required somewhere with Babel
        include: [src],
        use: {
          loader: 'babel-loader',
          // eslint-disable-next-line global-require
          options: require('./babel.config'),
        },
      },
    ],
  },
  target: 'web', // Make web variables accessible to webpack, e.g. window
  devtool: shouldMinify ? false : 'eval-source-map',
  optimization: {
    minimize: shouldMinify,
    minimizer: shouldMinify ? [new TerserPlugin()] : [],
  },
};

module.exports = config;
