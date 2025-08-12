import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  entry: ['src/index.ts!', 'test/**/*.test.ts', 'web-test-runner.config.js'],
  project: ['src/**/*.ts', 'test/**/*.ts'],
  ignoreDependencies: ['@web/test-runner-playwright'],
};

export default config;
