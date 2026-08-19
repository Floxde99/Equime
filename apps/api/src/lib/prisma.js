// @ts-check
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';
import { env } from '../config/env.js';

/**
 * Client Prisma singleton (Prisma 7 : driver adapter pg explicite).
 * Toute la couche service passe par cette instance ; les tests d'intégration
 * pointent une base dédiée via DATABASE_URL.
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
