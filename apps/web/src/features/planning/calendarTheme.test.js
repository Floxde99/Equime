import { describe, expect, it } from 'vitest';

import {
  courseEventClassName,
  courseEventColors,
  formatEventAriaLabel,
  planningSlotWindow,
  toCalendarEvent,
} from './calendarTheme.js';

describe('courseEventColors', () => {
  it('associe chaque statut cours à son token sémantique', () => {
    expect(courseEventColors('scheduled').borderColor).toBe('var(--color-info)');
    expect(courseEventColors('ongoing').borderColor).toBe('var(--color-accent)');
    expect(courseEventColors('completed').borderColor).toBe('var(--color-success)');
    expect(courseEventColors('cancelled').borderColor).toBe('var(--color-muted)');
    expect(courseEventColors('draft').borderColor).toBe('var(--color-muted)');
  });

  it('utilise un fond à 15 % et le texte on-card', () => {
    const colors = courseEventColors('scheduled');
    expect(colors.backgroundColor).toContain('15%');
    expect(colors.textColor).toBe('var(--color-on-card)');
  });

  it('retombe sur programmé si le statut est inconnu', () => {
    expect(courseEventColors('unknown').borderColor).toBe('var(--color-info)');
    expect(courseEventColors().borderColor).toBe('var(--color-info)');
  });
});

describe('courseEventClassName', () => {
  it('suffixe la classe par le statut', () => {
    expect(courseEventClassName('ongoing')).toEqual([
      'equime-fc-event',
      'equime-fc-event--ongoing',
    ]);
  });

  it('retombe sur scheduled', () => {
    expect(courseEventClassName('nope')).toContain('equime-fc-event--scheduled');
  });
});

describe('formatEventAriaLabel', () => {
  it('concatène titre, horaire, statut libellé, lieu et moniteur', () => {
    expect(
      formatEventAriaLabel({
        title: 'Dressage',
        timeText: '09:00 – 10:00',
        extendedProps: {
          status: 'scheduled',
          spaceName: 'Manège',
          instructorName: 'Léa Martin',
        },
      })
    ).toBe('Dressage · 09:00 – 10:00 · Programmé · Manège · Léa Martin');
  });
});

describe('toCalendarEvent', () => {
  it('conserve id / title / dates de l’API', () => {
    const source = {
      id: 'c1',
      title: 'Obstacle',
      start: '2026-08-18T08:00:00.000Z',
      end: '2026-08-18T09:00:00.000Z',
      extendedProps: { status: 'completed', spaceName: 'Carrière', instructorName: 'Paul' },
    };
    const mapped = toCalendarEvent(source);
    expect(mapped.id).toBe('c1');
    expect(mapped.title).toBe('Obstacle');
    expect(mapped.start).toBe(source.start);
    expect(mapped.classNames).toEqual(['equime-fc-event', 'equime-fc-event--completed']);
    expect(mapped.borderColor).toBe('var(--color-success)');
  });

  it('n’injecte pas le libellé de statut dans le titre', () => {
    const mapped = toCalendarEvent({
      id: 'c2',
      title: 'Dressage',
      start: '2026-08-18T09:00:00.000Z',
      end: '2026-08-18T10:00:00.000Z',
      extendedProps: { status: 'scheduled', spaceName: 'Carrière de dressage' },
    });
    expect(mapped.title).toBe('Dressage');
    expect(mapped.title).not.toMatch(/programmé/i);
  });
});

/**
 * @param {number} hour
 * @param {number} [minute]
 */
function localIso(hour, minute = 0) {
  return new Date(2026, 7, 18, hour, minute, 0).toISOString();
}

describe('planningSlotWindow', () => {
  it('reste sur 8 h–18 h quand les cours sont dans la plage', () => {
    expect(
      planningSlotWindow([
        { start: localIso(9), end: localIso(10) },
        { start: localIso(14), end: localIso(15) },
      ])
    ).toEqual({ slotMinTime: '08:00:00', slotMaxTime: '18:00:00' });
  });

  it('élargit le matin si un cours commence avant 8 h', () => {
    expect(planningSlotWindow([{ start: localIso(7), end: localIso(8) }])).toEqual({
      slotMinTime: '07:00:00',
      slotMaxTime: '18:00:00',
    });
  });

  it('élargit le soir si un cours se termine après 18 h', () => {
    expect(planningSlotWindow([{ start: localIso(18), end: localIso(19) }])).toEqual({
      slotMinTime: '08:00:00',
      slotMaxTime: '19:00:00',
    });
  });

  it('arrondit à l’heure supérieure si la fin n’est pas pile', () => {
    expect(planningSlotWindow([{ start: localIso(17), end: localIso(18, 30) }])).toEqual({
      slotMinTime: '08:00:00',
      slotMaxTime: '19:00:00',
    });
  });

  it('retombe sur 8 h–18 h sans événements', () => {
    expect(planningSlotWindow()).toEqual({ slotMinTime: '08:00:00', slotMaxTime: '18:00:00' });
    expect(planningSlotWindow([])).toEqual({ slotMinTime: '08:00:00', slotMaxTime: '18:00:00' });
  });
});
