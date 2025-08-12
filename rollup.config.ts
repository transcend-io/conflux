import { nodeResolve } from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import packageJson from './package.json' with { type: 'json' };

export default [
  // browser-friendly UMD build
  {
    input: 'src/index.ts',
    output: [
      {
        name: 'conflux',
        file: packageJson.main,
        format: 'umd',
      },
    ],
    plugins: [
      nodeResolve(), // so Rollup can find package dependencies
      typescript(),
    ],
  },

  // CommonJS (for Node) and ES module (for bundlers) build.
  // (We could have three entries in the configuration array
  // instead of two, but it's quicker to generate multiple
  // builds from a single configuration where possible, using
  // an array for the `output` option, where we can specify
  // `file` and `format` for each target)
  {
    input: 'src/index.ts',
    external: [/pako/],
    output: [
      // { file: pkg.main, format: 'cjs' }, // don't need a Node import yet
      { file: packageJson.module, format: 'es' },
    ],
    plugins: [typescript()],
  },
];
