import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // The calibration run is a real Monte-Carlo sim, not a unit test.
    testTimeout: 120_000,
  },
});
