import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Phase 3 simulation runs are real Monte-Carlo sweeps, not unit tests.
    testTimeout: 120_000,
  },
});
