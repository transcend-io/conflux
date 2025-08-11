import resolve from '@rollup/plugin-node-resolve';
import pkg from './package.json' with { type: 'json' };

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
    external: [/pako/],
    output: [
      // { file: pkg.main, format: 'cjs' }, // don't need a Node import yet
      { file: pkg.module, format: 'es' },
    ],
  },
];
