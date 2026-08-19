/**
 * Schémas Zod — espaces d'équitation (EPIC 3).
 */
import { z } from 'zod';

import { SPACE_TYPE_VALUES } from '../constants.js';

export const spaceIdParamSchema = z.object({
  id: z.string().min(1),
});

export const createSpaceSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(80),
  type: z.enum(SPACE_TYPE_VALUES),
  capacity: z.coerce.number().int().positive().optional(),
});

export const updateSpaceSchema = createSpaceSchema.partial();
