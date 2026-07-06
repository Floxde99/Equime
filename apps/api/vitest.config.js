import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
    // Les tests d'intégration partagent une base et un Redis : pas de parallélisme inter-fichiers
    fileParallelism: false,
    globalSetup: ['src/tests/globalSetup.js'],
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      // Base dédiée aux tests (créée par globalSetup), jamais la base de dev
      DATABASE_URL:
        process.env.DATABASE_URL_TEST ??
        'postgresql://equime:equime_dev_password@localhost:5432/equime_test',
      // Base Redis n° 1 : isole les clés de test de celles du dev (db 0)
      REDIS_URL: process.env.REDIS_URL_TEST ?? 'redis://localhost:6379/1',
      JWT_ACCESS_SECRET: 'test_secret_at_least_32_characters_long_0000',
      ACCESS_TOKEN_TTL_MIN: '15',
      REFRESH_TOKEN_TTL_DAYS: '7',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/tests/**', 'src/index.js'],
      reporter: ['text', 'lcov'],
      // Règle n° 8 : couverture minimale 70 % sur les modules critiques
      thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
    },
  },
});
