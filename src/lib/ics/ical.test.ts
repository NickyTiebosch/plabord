import { describe, expect, it } from 'vitest';
import { buildCalendar, escapeText, foldLine, formatUtcTimestamp, type CalendarEvent } from './ical';

const decoder = new TextDecoder('utf-8', { fatal: true });
const encoder = new TextEncoder();

function physicalLines(ics: string): string[] {
  expect(ics.endsWith('\r\n')).toBe(true);
  // Geen losse \n of \r: elke regel eindigt op CRLF.
  expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  return ics.slice(0, -2).split('\r\n');
}

function unfold(ics: string): string[] {
  return ics.replace(/\r\n /g, '').slice(0, -2).split('\r\n');
}

const events: CalendarEvent[] = [
  {
    kind: 'timed',
    uid: 'dienst-sanne-2026-10-14@planbord',
    stamp: '2026-10-01T09:15:30.123Z',
    date: '2026-10-14',
    start: '07:30',
    end: '18:00',
    summary: 'Dienst Den Bosch 07:30–18:00',
  },
  {
    kind: 'all_day',
    uid: 'afwezig-a1@planbord',
    stamp: '2026-09-20T10:00:00.000Z',
    startDate: '2026-10-14',
    endDate: '2026-10-16',
    summary: 'Afwezig: Zoë (aangevraagd)',
  },
];

describe('escapeText', () => {
  it('escapet backslash, puntkomma, komma en regeleinden', () => {
    expect(escapeText('a,b;c\\d\ne\r\nf')).toBe('a\\,b\\;c\\\\d\\ne\\nf');
  });
});

describe('foldLine', () => {
  it('laat korte regels met rust', () => {
    expect(foldLine('SUMMARY:kort')).toBe('SUMMARY:kort');
  });

  it('breekt af op 75 octets, ook met tekens van meerdere bytes', () => {
    const line = `SUMMARY:${'Café – Zoë en Anouk, '.repeat(8)}`;
    const folded = foldLine(line);
    const parts = folded.split('\r\n');
    expect(parts.length).toBeGreaterThan(1);
    for (const [index, part] of parts.entries()) {
      const bytes = encoder.encode(part);
      expect(bytes.length).toBeLessThanOrEqual(75);
      if (index > 0) expect(part.startsWith(' ')).toBe(true);
      // Geen teken middendoor gebroken: elke regel is geldige UTF-8.
      expect(() => decoder.decode(bytes)).not.toThrow();
    }
    expect(folded.replace(/\r\n /g, '')).toBe(line);
  });
});

describe('buildCalendar', () => {
  const ics = buildCalendar({ name: 'Planbord – Mijn rooster', events });

  it('heeft een geldige structuur met CRLF en regels van hoogstens 75 octets', () => {
    const lines = physicalLines(ics);
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines.at(-1)).toBe('END:VCALENDAR');
    for (const line of lines) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    const stack: string[] = [];
    for (const line of unfold(ics)) {
      if (line.startsWith('BEGIN:')) stack.push(line.slice(6));
      if (line.startsWith('END:')) expect(stack.pop()).toBe(line.slice(4));
    }
    expect(stack).toEqual([]);
  });

  it('bevat de verplichte kalendervelden, VTIMEZONE en de verversing van 1 uur', () => {
    const lines = unfold(ics);
    for (const expected of [
      'VERSION:2.0',
      'PRODID:-//Planbord//Rooster en verlof//NL',
      'X-WR-CALNAME:Planbord – Mijn rooster',
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
      'X-PUBLISHED-TTL:PT1H',
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Amsterdam',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
      'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    ]) {
      expect(lines).toContain(expected);
    }
  });

  it('schrijft een dienst in lokale tijd met TZID', () => {
    const lines = unfold(ics);
    expect(lines).toContain('DTSTART;TZID=Europe/Amsterdam:20261014T073000');
    expect(lines).toContain('DTEND;TZID=Europe/Amsterdam:20261014T180000');
    expect(lines).toContain('SUMMARY:Dienst Den Bosch 07:30–18:00');
    expect(lines).toContain('DTSTAMP:20261001T091530Z');
  });

  it('schrijft afwezigheid als hele-dag-event met een exclusieve einddatum', () => {
    const lines = unfold(ics);
    expect(lines).toContain('DTSTART;VALUE=DATE:20261014');
    expect(lines).toContain('DTEND;VALUE=DATE:20261017');
    expect(lines).toContain('SUMMARY:Afwezig: Zoë (aangevraagd)');
    expect(lines).toContain('TRANSP:TRANSPARENT');
  });

  it('geeft elk event een UID, DTSTAMP, DTSTART, DTEND en SUMMARY', () => {
    const blocks = unfold(ics)
      .join('\n')
      .split('BEGIN:VEVENT')
      .slice(1);
    expect(blocks).toHaveLength(2);
    for (const block of blocks) {
      for (const field of ['UID:', 'DTSTAMP:', 'DTSTART', 'DTEND', 'SUMMARY:']) expect(block).toContain(field);
    }
  });

  it('geeft bij dezelfde invoer byte voor byte dezelfde uitvoer, ongeacht de volgorde', () => {
    expect(buildCalendar({ name: 'Planbord – Mijn rooster', events: [...events].reverse() })).toBe(ics);
  });

  it('escapet de kalendernaam', () => {
    expect(buildCalendar({ name: 'A, B; C', events: [] })).toContain('X-WR-CALNAME:A\\, B\\; C');
  });
});

describe('formatUtcTimestamp', () => {
  it('schrijft een tijdstempel in UTC', () => {
    expect(formatUtcTimestamp('2026-07-01T12:00:00+02:00')).toBe('20260701T100000Z');
  });
});
