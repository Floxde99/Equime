import { describe, expect, it } from 'vitest';

import { envSchema } from './env.js';

const valid = {
  DATABASE_URL: 'postgresql://equime:secret@localhost:5432/equime',
  JWT_ACCESS_SECRET: 'a_real_secret_at_least_32_characters_long',
};

describe('envSchema secrets de production', () => {
  it('accepte un secret change_me hors production', () => {
    const result = envSchema.safeParse({
      ...valid,
      NODE_ENV: 'development',
      JWT_ACCESS_SECRET: 'change_me_dev_secret_at_least_32_characters_long',
    });
    expect(result.success).toBe(true);
  });

  it('refuse un secret commençant par change_me en production', () => {
    const result = envSchema.safeParse({
      ...valid,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'change_me_dev_secret_at_least_32_characters_long',
    });
    expect(result.success).toBe(false);
  });

  it('accepte un secret réel en production', () => {
    const result = envSchema.safeParse({
      ...valid,
      NODE_ENV: 'production',
    });
    expect(result.success).toBe(true);
  });
});
