#!/usr/bin/env node
// @ts-check
/**
 * Génère les variantes redimensionnées des images de la vitrine (éco-conception,
 * docs/eco-conception.md). Les originaux restent intacts ; chaque variante est
 * nommée `<image>-<largeur>.webp` et référencée par un `srcSet` dans HomePage.
 *
 * Largeurs choisies d'après la taille d'affichage mesurée à 1280 px (×2 pour
 * les écrans haute densité) et la largeur pleine page sur mobile.
 *
 * Usage : node scripts/optimize-images.mjs
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const IMAGES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../apps/web/public/images'
);

/** @type {Record<string, number[]>} image source → largeurs à produire */
const VARIANTS = {
  'hero-centre.webp': [768, 1280],
  'programme-dressage.webp': [480, 960],
  'programme-obstacle.webp': [480, 960],
  'programme-poney.webp': [480, 960],
  'experience-ecuries.webp': [640, 800, 1200],
  'experience-carriere.webp': [640, 800, 1200],
  'temoin-claire.webp': [112],
  // Espace famille : colonne de 20rem sur la page Factures, pleine largeur sous 1024 px.
  'ecuries-or.webp': [640, 960],
};

for (const [file, widths] of Object.entries(VARIANTS)) {
  const source = path.join(IMAGES_DIR, file);
  const base = file.replace(/\.webp$/, '');
  for (const width of widths) {
    const target = path.join(IMAGES_DIR, `${base}-${width}.webp`);
    const info = await sharp(source)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 80, effort: 6 })
      .toFile(target);
    console.log(
      `${base}-${width}.webp  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} Ko`
    );
  }
}
