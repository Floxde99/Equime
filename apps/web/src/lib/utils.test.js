import { describe, expect, it } from 'vitest';

import { cn } from './utils.js';

describe('cn', () => {
  it('fusionne les classes Tailwind conflictuelles', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-muted', 'font-sans')).toContain('font-sans');
  });
});
