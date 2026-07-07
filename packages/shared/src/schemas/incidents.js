/**
 * Schémas Zod — incidents.
 */
import { z } from 'zod';

import { INCIDENT_SEVERITY_VALUES, INCIDENT_STATUS_VALUES } from '../constants.js';

export const incidentIdParamSchema = z.object({
  id: z.string().min(1),
});

export const incidentQuerySchema = z.object({
  status: z.enum(INCIDENT_STATUS_VALUES).optional(),
  severity: z.enum(INCIDENT_SEVERITY_VALUES).optional(),
});

export const createIncidentSchema = z.object({
  courseId: z.string().min(1).optional(),
  horseId: z.string().min(1).optional(),
  riderId: z.string().min(1).optional(),
  severity: z.enum(INCIDENT_SEVERITY_VALUES),
  description: z.string().trim().min(10, 'La description doit contenir au moins 10 caractères').max(5000),
  occurredAt: z.coerce.date(),
});
