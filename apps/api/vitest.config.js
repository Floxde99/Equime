import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/equime_test',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/tests/**', 'src/index.js'],
      reporter: ['text', 'lcov'],
    },
  },
});
