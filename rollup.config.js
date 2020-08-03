import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';

const babelDefaults = {
  // see: https://github.com/rollup/plugins/tree/master/packages/babel#babelhelpers and the note about @babel/runtime for CJS/ES
  babelHelpers: 'runtime',
  configFile: './babel.config.js',
  plugins: [
    [
      '@babel/plugin-transform-runtime',
      {
        regenerator: true,
        corejs: 3,
      },
    ],
  ],
}

export default [
  // browser-friendly UMD build
  {
    input: 'src/index.js',
    output: [
      {
        name: 'conflux',
        file: pkg.main,
        format: 'umd',
      },
    ],
    plugins: [
      resolve(), // so Rollup can find package dependencies
      commonjs(), // so Rollup can convert package dependencies to an ES module
      babel(babelDefaults),
      terser(),
    ],
  },

  // CommonJS (for Node) and ES module (for bundlers) build.
  // (We could have three entries in the configuration array
  // instead of two, but it's quicker to generate multiple
  // builds from a single configuration where possible, using
  // an array for the `output` option, where we can specify
  // `file` and `format` for each target)
  {
    input: 'src/index.js',
    external: [/pako/, /web-streams-polyfill/, /@babel\/runtime/],
    output: [
      // { file: pkg.main, format: 'cjs' }, // don't need a Node import yet
      { file: pkg.module, format: 'es' },
    ],
    plugins: [
      babel({
        ...babelDefaults,
        exclude: ['node_modules/**'],
      }),
    ],
  },
];
