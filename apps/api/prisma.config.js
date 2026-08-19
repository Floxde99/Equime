import 'dotenv/config';

import { defineConfig } from 'prisma/config';

/**
 * Configuration de la CLI Prisma.
 *
 * `process.env['DATABASE_URL']` plutôt que le helper `env('DATABASE_URL')` :
 * `env()` lève une PrismaConfigEnvError dès le chargement du fichier si la
 * variable est absente, ce qui fait échouer `prisma generate` — commande qui
 * ne se connecte pourtant à aucune base. C'est le cas en CI et dans le build
 * Docker, où aucun .env n'est présent (cf. .dockerignore).
 * C'est la forme générée par `prisma init` pour Node.js.
 *
 * Les commandes qui touchent réellement la base (migrate, db push, studio)
 * échouent explicitement si l'URL est absente.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node prisma/seed.js',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
