import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
// import json from '@rollup/plugin-json';
// import nodePolyfills from 'rollup-plugin-node-polyfills';
import pkg from './package.json';

export default [
  // browser-friendly UMD build
  {
    input: 'src/index.js',
    output: {
      name: 'conflux',
      file: pkg.browser,
      format: 'umd',
    },
    plugins: [
      resolve(), // so Rollup can find package dependencies
      commonjs(), // so Rollup can convert package dependencies to an ES module
      babel({
        exclude: ['node_modules/**'],
        babelHelpers: 'runtime',
        configFile: './babel.config.js',
        plugins: [
          [
            '@babel/plugin-transform-runtime',
            {
              regenerator: true,
            },
          ],
        ],
      }),
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
      { file: pkg.main, format: 'cjs' },
      { file: pkg.module, format: 'es' },
    ],
    plugins: [
      babel({
        exclude: ['node_modules/**'],
        // see: https://github.com/rollup/plugins/tree/master/packages/babel#babelhelpers and the note about @babel/runtime for CJS/ES
        babelHelpers: 'runtime',
        configFile: './babel.config.js',
        plugins: [
          [
            '@babel/plugin-transform-runtime',
            {
              regenerator: true,
            },
          ],
        ],
      }),
    ],
  },

  // // Test
  // {
  //   input: 'test/index.test.js',
  //   output: [
  //     {
  //       format: 'iife', // Helps prevent naming collisions.
  //       name: 'confluxTest', // Required for 'iife' format.
  //       // sourcemap: 'inline', // Sensible for testing.
  //       file: 'dist/test.js',
  //     },
  //   ],
  //   plugins: [
  //     resolve({
  //       preferBuiltins: true,
  //     }),
  //     commonjs(),
  //     json(),
  //     nodePolyfills(),
  //     babel({
  //       exclude: ['node_modules/**'],
  //       // see: https://github.com/rollup/plugins/tree/master/packages/babel#babelhelpers and the note about @babel/runtime for CJS/ES
  //       configFile: './babel.config.js',
  //     }),
  //   ],
  // },
];
