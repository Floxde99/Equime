import { describe, expect, it } from 'vitest';

import { escapeHtml } from './mailer.js';

describe('escapeHtml', () => {
  it('échappe les caractères HTML dangereux', () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'
    );
    expect(escapeHtml("O'Brien & Cie")).toBe('O&#39;Brien &amp; Cie');
  });

  it('convertit les valeurs vides en chaîne', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
