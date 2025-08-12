import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: ['src/index.ts!', 'test/**/*.test.ts', 'web-test-runner.config.js'],
  project: ['src/**/*.ts', 'test/**/*.ts'],
  ignoreDependencies: ['@web/test-runner-playwright', 'tsx'],
  // Bypass unlisted binaries "scripts/postbuild.ts package.json"]
  exclude: ['binaries'],
};

export default config;
