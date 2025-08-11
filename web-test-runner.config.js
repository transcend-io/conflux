import { esbuildPlugin } from '@web/dev-server-esbuild';

/** The timeout for all tests in milliseconds */
const TIMEOUT_MS = 10 * 60 * 1000;

const FF_BIG_FIXTURES = process.env['FF_BIG_FIXTURES'] ?? 'skip';

/**
 * Pass environment variables to the test environment.
 *
 * @type {Record<string, string>}
 */
const environment = {
  FF_BIG_FIXTURES: FF_BIG_FIXTURES,
};

/** @type {import('@web/test-runner').TestRunnerConfig} */
const config = {
  plugins: [esbuildPlugin({ ts: true })],
  testRunnerHtml: (testFramework) => `
    <html>
      <head>
        <script>
          window.environment = ${JSON.stringify(environment)};
        </script>
      </head>
      <body>
        <script type="module" src="${testFramework}"></script>
      </body>
    </html>
  `,
  testFramework: {
    config: {
      timeout: TIMEOUT_MS,
    },
  },
  testsFinishTimeout: TIMEOUT_MS,
  concurrentBrowsers: 3,
  coverage: true,
  coverageConfig: {
    include: ['src/**/*.ts', 'wasm/**/*.ts'],
    report: true,
    reportDir: 'coverage',
  },
};

export default config;
