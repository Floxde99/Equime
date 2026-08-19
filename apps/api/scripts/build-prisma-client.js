// @ts-check
/**
 * Transpile le client Prisma généré (TypeScript) en JavaScript pur.
 *
 * Prisma 7 ne sait émettre que du TypeScript (`generatedFileExtension: ts`).
 * Le projet étant 100 % JavaScript (ADR 004), cette étape transforme chaque
 * fichier .ts généré en .js équivalent (esbuild, types simplement effacés),
 * puis supprime les .ts. Les imports internes pointent déjà vers ".js"
 * (`importFileExtension: js`), le résultat est donc un module ESM cohérent.
 *
 * Usage : npm run prisma:generate (enchaîne `prisma generate` puis ce script).
 */
import { execFileSync } from 'node:child_process';
import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const generatedDir = fileURLToPath(new URL('../generated/prisma', import.meta.url));
const apiDir = fileURLToPath(new URL('..', import.meta.url));

// Nettoyage préalable : Prisma refuse de générer dans un dossier non vide
// qui contient les .js d'une génération précédente.
await rm(generatedDir, { recursive: true, force: true });

execFileSync('npx', ['prisma', 'generate'], { cwd: apiDir, stdio: 'inherit', shell: true });

/**
 * Liste récursivement les fichiers .ts d'un dossier.
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function listTsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listTsFiles(fullPath);
      return entry.name.endsWith('.ts') ? [fullPath] : [];
    })
  );
  return files.flat();
}

const tsFiles = await listTsFiles(generatedDir);
if (tsFiles.length === 0) {
  console.error('Aucun fichier .ts généré trouvé — lancer `prisma generate` d’abord.');
  process.exit(1);
}

await build({
  entryPoints: tsFiles,
  outdir: generatedDir,
  outbase: generatedDir,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: false,
  logLevel: 'silent',
});

await Promise.all(tsFiles.map((file) => rm(file)));

// eslint-disable-next-line no-console
console.log(`Client Prisma transpilé en JavaScript (${tsFiles.length} fichiers).`);
