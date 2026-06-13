/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/unit/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }] },
    },
    {
      displayName: 'dom',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/test/dom/**/*.test.ts'],
      transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }] },
    },
  ],
};
