import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { errorHandler } from './errorHandler.js';

describe('errorHandler Prisma P2025', () => {
  it('mappe P2025 vers 404', async () => {
    const app = express();
    app.get('/boom', (_req, _res, next) => {
      const err = new Error('Record to update not found');
      err.code = 'P2025';
      next(err);
    });
    app.use(errorHandler);

    const res = await request(app).get('/boom');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('errorHandler Prisma P2002 / P2003', () => {
  it.each([
    ['P2002', /existe déjà/],
    ['P2003', /encore utilisé/],
  ])('mappe %s vers un 409 lisible', async (code, message) => {
    const app = express();
    app.get('/boom', (_req, _res, next) => {
      const err = new Error('Foreign key constraint violated');
      err.code = code;
      next(err);
    });
    app.use(errorHandler);

    const res = await request(app).get('/boom');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toMatch(message);
  });
});
