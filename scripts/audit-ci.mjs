#!/usr/bin/env node
// @ts-check
/**
 * Contrôle des vulnérabilités des dépendances (CI).
 *
 * Remplace `npm audit --omit=dev --audit-level=high`, qui ne permet pas de
 * documenter une exception : la seule alternative serait d'abaisser le seuil
 * global, ce qui masquerait aussi les vulnérabilités futures.
 *
 * Ici, chaque exception est nominative, justifiée et datée. Toute advisory
 * high/critical non listée fait échouer la CI.
 *
 * Usage : node scripts/audit-ci.mjs
 */
import { spawnSync } from 'node:child_process';
import process from 'node:process';

/** Seuils considérés comme bloquants. */
const BLOCKING = new Set(['high', 'critical']);

/**
 * Exceptions acceptées, par identifiant d'advisory.
 * Chaque entrée doit porter une justification d'exposition réelle et une date
 * de réexamen. Retirer l'entrée dès qu'un correctif non-cassant existe.
 *
 * @type {Record<string, { paquet: string, motif: string, reexamen: string }>}
 */
const EXCEPTIONS = {
  'GHSA-ggr8-5vv4-36mx': {
    paquet: 'deepmerge-ts (via @prisma/config, via la CLI prisma)',
    motif:
      'Outillage de build uniquement : la CLI Prisma est marquée devOptional dans ' +
      "package-lock.json et absente de l'image de production (cible `prod` du " +
      'Dockerfile, npm ci --omit=dev) — les migrations passent par la cible ' +
      "`api-build`. L'épuisement de pile décrit suppose un graphe d'objets " +
      "récursif fourni en entrée du merge ; l'entrée est ici apps/api/prisma.config.js, " +
      'un fichier du dépôt, non contrôlable par un tiers. Aucun correctif ' +
      'non-cassant : npm ne propose que prisma@6.12.0, incompatible avec le ' +
      'socle Prisma 7 (générateur prisma-client, driver adapter pg, prisma.config.js). ' +
      'Un `overrides` vers deepmerge-ts@8 est ignoré par npm sur cette chaîne.',
    reexamen: '2026-11-19',
  },
};

// Commande passée en chaîne unique : `shell: true` avec un tableau d'arguments
// déclenche DEP0190. Aucune interpolation ici, la commande est littérale.
const result = spawnSync('npm audit --omit=dev --audit-level=high --json', {
  encoding: 'utf8',
  shell: true,
  maxBuffer: 32 * 1024 * 1024,
});

if (!result.stdout) {
  console.error('Échec de `npm audit` :', result.stderr || '(aucune sortie)');
  process.exit(1);
}

/** @type {{ vulnerabilities?: Record<string, any> }} */
const report = JSON.parse(result.stdout);
const vulnerabilities = report.vulnerabilities ?? {};

/**
 * Remonte la chaîne `via` jusqu'aux advisories racines.
 * @param {string} name
 * @param {Set<string>} seen
 * @returns {{ id: string, title: string, severity: string }[]}
 */
function advisoriesOf(name, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  const entry = vulnerabilities[name];
  if (!entry) return [];
  return (entry.via ?? []).flatMap((via) => {
    if (typeof via === 'string') return advisoriesOf(via, seen);
    const id = typeof via.url === 'string' ? via.url.split('/').pop() : String(via.source);
    return [{ id, title: via.title ?? '', severity: via.severity ?? entry.severity }];
  });
}

/** @type {Map<string, { title: string, severity: string, paquets: Set<string> }>} */
const bloquantes = new Map();

for (const [name, entry] of Object.entries(vulnerabilities)) {
  if (!BLOCKING.has(entry.severity)) continue;
  for (const advisory of advisoriesOf(name)) {
    if (!BLOCKING.has(advisory.severity)) continue;
    const existant = bloquantes.get(advisory.id);
    if (existant) existant.paquets.add(name);
    else
      bloquantes.set(advisory.id, {
        title: advisory.title,
        severity: advisory.severity,
        paquets: new Set([name]),
      });
  }
}

const nonCouvertes = [...bloquantes].filter(([id]) => !(id in EXCEPTIONS));
const couvertes = [...bloquantes].filter(([id]) => id in EXCEPTIONS);
const aujourdhui = new Date().toISOString().slice(0, 10);

for (const [id] of couvertes) {
  const exception = EXCEPTIONS[id];
  const perimee = aujourdhui > exception.reexamen;
  console.log(
    `${perimee ? '⚠' : '·'} ${id} — exception acceptée (${exception.paquet})` +
      (perimee
        ? ` — RÉEXAMEN ÉCHU depuis le ${exception.reexamen}`
        : ` — réexamen ${exception.reexamen}`)
  );
}

for (const id of Object.keys(EXCEPTIONS)) {
  if (!bloquantes.has(id)) {
    console.log(`· ${id} — exception devenue inutile, la retirer de scripts/audit-ci.mjs`);
  }
}

if (nonCouvertes.length > 0) {
  console.error(`\n${nonCouvertes.length} vulnérabilité(s) high/critical non traitée(s) :\n`);
  for (const [id, info] of nonCouvertes) {
    console.error(`  ${id} (${info.severity}) — ${info.title}`);
    console.error(`    paquets : ${[...info.paquets].join(', ')}`);
  }
  console.error('\nCorriger avec `npm audit fix`, ou documenter une exception');
  console.error('justifiée dans EXCEPTIONS (scripts/audit-ci.mjs).');
  process.exit(1);
}

console.log(`\nAucune vulnérabilité high/critical non traitée (${couvertes.length} exception(s)).`);
