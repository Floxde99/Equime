// @ts-check
/**
 * Contrôle des documents cavalier requis pour une inscription (Excel 7.2).
 * Les règles de validité sont partagées avec le front (`@equime/shared`).
 */
import { areRiderDocumentsValidAt, isDocumentExpiredAt } from '@equime/shared';

import { AppError } from './appError.js';

/**
 * Un document est expiré si sa date de fin est strictement antérieure au jour de référence.
 * @param {Date | string | null | undefined} expiresAt
 * @param {Date} [now]
 */
export function isDocumentExpired(expiresAt, now = new Date()) {
  return isDocumentExpiredAt(expiresAt, now);
}

/**
 * Refuse l'inscription si le certificat médical ou la licence n'est pas approuvé,
 * ou s'il ne sera plus valide à la date de la séance ou de l'événement (Excel 7.2).
 *
 * @param {{
 *   medicalCertificateStatus: string,
 *   licenseStatus: string,
 *   medicalCertificateExpiresAt?: Date | string | null,
 *   licenseExpiresAt?: Date | string | null,
 * }} rider
 * @param {Date} [at] date de la séance (par défaut : maintenant)
 */
export function assertRiderDocumentsApproved(rider, at = new Date()) {
  if (!areRiderDocumentsValidAt(rider, at)) {
    throw AppError.badRequest(
      'Le certificat médical et la licence FFE doivent être validés et en cours de validité à la date de la séance'
    );
  }
}
