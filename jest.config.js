/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/unit/**/*.test.js'],
    },
    {
      displayName: 'dom',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/test/dom/**/*.test.js'],
    },
  ],
  collectCoverageFrom: [
    'main.js',
    'renderer.js',
    '!**/node_modules/**',
    '!**/lib/**',
  ],
  coverageReporters: ['text', 'lcov'],
};
