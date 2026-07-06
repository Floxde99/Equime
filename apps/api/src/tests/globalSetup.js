/**
 * Setup global Vitest (exécuté UNE fois avant tous les fichiers de tests) :
 * 1. crée la base `equime_test` si absente ;
 * 2. applique les migrations (`prisma migrate deploy`) — jamais de db push ;
 * 3. vide la base Redis de test (db 1).
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Redis } from 'ioredis';
import pg from 'pg';

const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  'postgresql://equime:equime_dev_password@localhost:5432/equime_test';
const TEST_REDIS_URL = process.env.REDIS_URL_TEST ?? 'redis://localhost:6379/1';

const apiDir = fileURLToPath(new URL('../..', import.meta.url));

export default async function globalSetup() {
  // 1. Création de la base de test si nécessaire
  const url = new URL(TEST_DATABASE_URL);
  const dbName = url.pathname.slice(1);
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = '/postgres';

  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (rowCount === 0) {
    await client.query(`CREATE DATABASE "${dbName}"`);
  }
  await client.end();

  // 2. Migrations
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: apiDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });

  // 3. Nettoyage Redis (db de test uniquement)
  const redis = new Redis(TEST_REDIS_URL);
  await redis.flushdb();
  redis.disconnect();
}
