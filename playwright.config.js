const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/e2e',
  timeout: 30_000,
  retries: 1,
  reporter: 'list',
  use: {
    // Screenshots on failure
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
});
