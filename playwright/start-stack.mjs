import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = path.join(fileURLToPath(new URL('.', import.meta.url)), '..');
const webPort = process.env.PLAYWRIGHT_WEB_PORT ?? '5173';
const apiPort = process.env.PLAYWRIGHT_API_PORT ?? '3000';
const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${webPort}`;

/** @type {NodeJS.ProcessEnv} */
const apiEnv = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: apiPort,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    'postgresql://equime:equime_dev_password@localhost:5432/equime',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  JWT_ACCESS_SECRET:
    process.env.JWT_ACCESS_SECRET ?? 'change_me_dev_secret_at_least_32_characters_long',
  CORS_ORIGIN: baseUrl,
  APP_URL: baseUrl,
};

/**
 * @param {string} url
 * @param {number} [timeoutMs]
 */
async function waitFor(url, timeoutMs = 90_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // La stack démarre encore.
    }
    await delay(1000);
  }
  throw new Error(`Délai dépassé en attendant ${url}`);
}

/**
 * @param {import('node:child_process').ChildProcess} child
 */
function stopChild(child) {
  if (!child.killed) {
    child.kill('SIGTERM');
  }
}

async function prepareDatabase() {
  await new Promise((resolve, reject) => {
    const seeder = spawn('npm', ['run', 'seed', '-w', 'apps/api'], {
      cwd: root,
      env: apiEnv,
      stdio: 'inherit',
      shell: true,
    });
    seeder.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error('Échec du seed avant les tests E2E'))
    );
  });
}

async function clearRateLimits() {
  await new Promise((resolve, reject) => {
    const cleaner = spawn('node', ['playwright/clear-rate-limits.mjs'], {
      cwd: root,
      env: apiEnv,
      stdio: 'inherit',
      shell: true,
    });
    cleaner.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error('Échec du reset des rate limits E2E'))
    );
  });
}

async function main() {
  /** @type {import('node:child_process').ChildProcess[]} */
  const children = [];
  let exitCode = 1;
  const useExternalStack = process.env.PLAYWRIGHT_EXTERNAL_STACK === '1';

  await clearRateLimits();
  if (!useExternalStack) {
    await prepareDatabase();
  }

  await new Promise((resolve, reject) => {
    const installer = spawn('npx', ['playwright', 'install', 'chromium'], {
      cwd: root,
      stdio: 'inherit',
      shell: true,
    });
    installer.on('close', (code) => (code === 0 ? resolve() : reject(new Error('Playwright install failed'))));
  });

  try {
    if (!useExternalStack) {
      const api = spawn('node', ['src/index.js'], {
        cwd: path.join(root, 'apps/api'),
        env: apiEnv,
        stdio: 'inherit',
        shell: true,
      });
      const web = spawn(
        'npm',
        ['run', 'dev', '-w', 'apps/web', '--', '--host', '127.0.0.1', '--port', webPort, '--strictPort'],
        {
          cwd: root,
          env: {
            ...process.env,
            VITE_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
          },
          stdio: 'inherit',
          shell: true,
        }
      );

      children.push(api, web);
      await waitFor(`http://127.0.0.1:${apiPort}/health`);
      await waitFor(baseUrl);
    }

    exitCode = await new Promise((resolve) => {
      const runner = spawn('npx', ['playwright', 'test'], {
        cwd: root,
        env: {
          ...process.env,
          PLAYWRIGHT_BASE_URL: baseUrl,
        },
        stdio: 'inherit',
        shell: true,
      });
      runner.on('close', (code) => resolve(code ?? 1));
    });
  } finally {
    for (const child of children) {
      stopChild(child);
    }
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
