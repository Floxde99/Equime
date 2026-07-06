// @ts-check
import { Router } from 'express';

import { pingRedis } from '../lib/redis.js';

const router = Router();

/**
 * GET /health — endpoint public de supervision.
 * Répond 200 dès que le process est vivant ; l'état Redis est informatif.
 */
router.get('/', async (_req, res) => {
  const redisUp = await pingRedis();
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    redis: redisUp ? 'up' : 'down',
    timestamp: new Date().toISOString(),
  });
});

export default router;
