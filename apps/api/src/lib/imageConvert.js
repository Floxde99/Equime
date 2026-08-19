// @ts-check
/**
 * Conversion d’images téléversées vers WebP (Sharp) pour limiter le poids disque.
 */
import sharp from 'sharp';

/** Largeur / hauteur max (le plus grand côté), sans agrandir les petites images. */
export const HORSE_PHOTO_MAX_PX = 1200;

/** Qualité WebP (0–100) — compromis lisibilité / poids. */
export const HORSE_PHOTO_WEBP_QUALITY = 80;

/**
 * Convertit un buffer image (JPEG, PNG, WebP…) en WebP redimensionné.
 *
 * @param {Buffer} input Buffer brut du fichier source
 * @param {{ maxPx?: number, quality?: number }} [options]
 * @returns {Promise<Buffer>} Image WebP
 */
export async function convertImageToWebp(input, options = {}) {
  const maxPx = options.maxPx ?? HORSE_PHOTO_MAX_PX;
  const quality = options.quality ?? HORSE_PHOTO_WEBP_QUALITY;

  return sharp(input)
    .rotate()
    .resize(maxPx, maxPx, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}
