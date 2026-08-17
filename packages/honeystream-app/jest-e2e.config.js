module.exports = {
  moduleDirectories: ['node_modules', 'test'],
  testRegex: '(e2e){1}.*?\\.spec\\.tsx?$',
  transform: { '^.+\\.tsx?$': 'ts-jest' },
  testEnvironment: './test/environment/env.js',
  setupFiles: ['./test/environment/playwright-compat.js'],
  globalSetup: './test/environment/setup.js',
  globalTeardown: './test/environment/teardown.js',
}
