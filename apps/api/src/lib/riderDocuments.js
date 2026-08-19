// @ts-check
/**
 * Contrôle des documents cavalier requis pour une inscription (Excel 7.2).
 */
import { DOCUMENT_STATUS } from '@equime/shared';

import { AppError } from './appError.js';

/**
 * Un document est expiré si sa date de fin est strictement antérieure au jour courant (UTC).
 *
 * @param {Date | string | null | undefined} expiresAt
 * @param {Date} [now]
 */
export function isDocumentExpired(expiresAt, now = new Date()) {
  if (!expiresAt) return false;
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return false;
  const expiryDay = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return expiryDay < today;
}

/**
 * Refuse l'inscription si le certificat médical ou la licence n'est pas approuvé,
 * ou si la date de validité est échue (Excel 7.2).
 *
 * @param {{
 *   medicalCertificateStatus: string,
 *   licenseStatus: string,
 *   medicalCertificateExpiresAt?: Date | string | null,
 *   licenseExpiresAt?: Date | string | null,
 * }} rider
 * @param {Date} [now]
 */
export function assertRiderDocumentsApproved(rider, now = new Date()) {
  if (
    rider.medicalCertificateStatus !== DOCUMENT_STATUS.APPROVED ||
    rider.licenseStatus !== DOCUMENT_STATUS.APPROVED
  ) {
    throw AppError.badRequest(
      'Le certificat médical et la licence FFE doivent être validés et en cours de validité avant toute inscription'
    );
  }

  if (
    isDocumentExpired(rider.medicalCertificateExpiresAt, now) ||
    isDocumentExpired(rider.licenseExpiresAt, now)
  ) {
    throw AppError.badRequest(
      'Le certificat médical et la licence FFE doivent être validés et en cours de validité avant toute inscription'
    );
  }
}
