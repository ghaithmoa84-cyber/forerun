import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/integration/**/*.spec.ts'],
    environment: 'node',
    globals: true,
    setupFiles: ['test/integration/setup.ts'],
    pool: 'forks',
    singleFork: true,
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
