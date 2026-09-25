/**
 * Tests unitaires — messages de validation génériques en français.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import './zodLocale.js';

const messageOf = (schema, value) => schema.safeParse(value).error.issues[0].message;

describe('messages Zod en français', () => {
  it('signale un champ requis', () => {
    expect(messageOf(z.object({ a: z.string() }), {})).toBe('Ce champ est requis');
    expect(messageOf(z.string().min(1), '')).toBe('Ce champ est requis');
  });

  it('signale un nombre invalide et les bornes', () => {
    expect(messageOf(z.coerce.number(), 'abc')).toBe('Saisissez un nombre valide');
    expect(messageOf(z.number().positive(), 0)).toBe('La valeur doit être supérieure à 0');
    expect(messageOf(z.number().max(10), 11)).toBe('La valeur ne peut pas dépasser 10');
  });

  it('garde les messages métier des schémas', () => {
    expect(messageOf(z.string().min(3, 'Trop court'), 'a')).toBe('Trop court');
  });

  it('traduit les listes et les e-mails', () => {
    expect(messageOf(z.enum(['a', 'b']), 'c')).toBe('Choisissez une valeur dans la liste');
    expect(messageOf(z.email(), 'x')).toBe('Adresse e-mail invalide');
  });
});
