/**
 * Schémas Zod — cavaliers et documents (EPIC 2).
 */
import { z } from 'zod';

import {
  AFFINITY_TYPE_VALUES,
  DOCUMENT_STATUS_VALUES,
  RIDER_LEVEL_VALUES,
} from '../constants.js';

const riderLevelSchema = z.enum(RIDER_LEVEL_VALUES);

/** Date de fin de validité d'un document (certificat / licence) — jour UTC. */
export const documentExpiresAtSchema = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date au format AAAA-MM-JJ'), z.coerce.date()])
  .transform((value) => (value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`)));

export const riderIdParamSchema = z.object({
  id: z.string().min(1),
});

export const createRiderSchema = z.object({
  firstName: z.string().trim().min(1, 'Le prénom est requis').max(80),
  lastName: z.string().trim().min(1, 'Le nom est requis').max(80),
  birthdate: z
    .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date au format AAAA-MM-JJ'), z.coerce.date()])
    .transform((value) =>
      value instanceof Date ? value : new Date(`${value}T00:00:00.000Z`)
    ),
  level: riderLevelSchema.default('initiation'),
});

export const updateRiderSchema = createRiderSchema.partial();

export const documentTypeParamSchema = z.object({
  id: z.string().min(1),
  docType: z.enum(['medical_certificate', 'license']),
});

/** Champs multipart hors fichier (validés après multer). */
export const documentUploadFieldsSchema = z.object({
  medicalConsent: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .optional()
    .transform((value) => value === true || value === 'true'),
  expiresAt: documentExpiresAtSchema,
});

export const upsertAffinitySchema = z.object({
  affinity: z.enum(AFFINITY_TYPE_VALUES),
});

export const affinityHorseParamSchema = z.object({
  id: z.string().min(1),
  horseId: z.string().min(1),
});

/** Réponse publique d'un cavalier (sans données sensibles inutiles). */
export const riderPublicSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  birthdate: z.coerce.date(),
  level: riderLevelSchema,
  medicalCertificateStatus: z.enum(DOCUMENT_STATUS_VALUES),
  medicalCertificateRejectionReason: z.string().nullable().optional(),
  medicalCertificateExpiresAt: z.coerce.date().nullable().optional(),
  licenseStatus: z.enum(DOCUMENT_STATUS_VALUES),
  licenseRejectionReason: z.string().nullable().optional(),
  licenseExpiresAt: z.coerce.date().nullable().optional(),
  medicalConsentAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
