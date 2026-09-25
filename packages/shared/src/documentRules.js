/**
 * Règles de validité des documents cavalier (Excel 7.2) — partagées front / back.
 *
 * Les dates d'expiration sont des dates calendaires stockées à minuit UTC :
 * la comparaison se fait donc jour par jour en UTC. Un document reste valide
 * pendant toute sa journée d'expiration.
 */
import { DOCUMENT_STATUS } from './constants.js';

/**
 * @param {Date | string | null | undefined} expiresAt
 * @param {Date | string | number} [at] date de référence (par défaut : maintenant)
 */
export function isDocumentExpiredAt(expiresAt, at = new Date()) {
  if (!expiresAt) return false;
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  const ref = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(expiry.getTime()) || Number.isNaN(ref.getTime())) return false;
  const expiryDay = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());
  const refDay = Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate());
  return expiryDay < refDay;
}

/**
 * Certificat médical et licence validés et encore valides à la date `at`.
 * @param {{
 *   medicalCertificateStatus?: string,
 *   licenseStatus?: string,
 *   medicalCertificateExpiresAt?: Date | string | null,
 *   licenseExpiresAt?: Date | string | null,
 * } | null | undefined} rider
 * @param {Date | string | number} [at]
 */
export function areRiderDocumentsValidAt(rider, at = new Date()) {
  return (
    rider?.medicalCertificateStatus === DOCUMENT_STATUS.APPROVED &&
    rider?.licenseStatus === DOCUMENT_STATUS.APPROVED &&
    !isDocumentExpiredAt(rider.medicalCertificateExpiresAt, at) &&
    !isDocumentExpiredAt(rider.licenseExpiresAt, at)
  );
}
