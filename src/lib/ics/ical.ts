/**
 * Een kleine, pure iCalendar-schrijver (RFC 5545) voor abonneerbare agenda's.
 * Alles in Europe/Amsterdam; afwezigheid als hele-dag-event.
 */
import { addDays } from '../engine/dates';
import type { IsoDate, TimeOfDay } from '../engine/types';

const CRLF = '\r\n';
const MAX_LINE_OCTETS = 75;
const encoder = new TextEncoder();

export const TIMEZONE = 'Europe/Amsterdam';

export interface TimedEvent {
  kind: 'timed';
  uid: string;
  /** ISO-timestamp van de laatste wijziging; wordt DTSTAMP. */
  stamp: string;
  date: IsoDate;
  start: TimeOfDay;
  end: TimeOfDay;
  summary: string;
}

export interface AllDayEvent {
  kind: 'all_day';
  uid: string;
  stamp: string;
  startDate: IsoDate;
  /** Laatste dag, inclusief. */
  endDate: IsoDate;
  summary: string;
}

export type CalendarEvent = TimedEvent | AllDayEvent;

export interface CalendarInput {
  name: string;
  events: readonly CalendarEvent[];
}

/** Escaping voor TEXT-waarden: backslash, puntkomma, komma en regeleinden. */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Breekt een regel af op 75 octets (UTF-8). Een vervolgregel begint met een spatie, die meetelt.
 * Er wordt nooit midden in een teken afgebroken.
 */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= MAX_LINE_OCTETS) return line;
  const parts: string[] = [];
  let current = '';
  let currentOctets = 0;
  let limit = MAX_LINE_OCTETS;
  for (const char of line) {
    const octets = encoder.encode(char).length;
    if (currentOctets + octets > limit) {
      parts.push(current);
      current = '';
      currentOctets = 0;
      limit = MAX_LINE_OCTETS - 1;
    }
    current += char;
    currentOctets += octets;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

function formatDateValue(date: IsoDate): string {
  return date.replaceAll('-', '');
}

function formatLocalDateTime(date: IsoDate, time: TimeOfDay): string {
  return `${formatDateValue(date)}T${time.replace(':', '')}00`;
}

/** UTC-tijdstempel zoals 20261014T090000Z. */
export function formatUtcTimestamp(iso: string): string {
  const ms = Date.parse(iso);
  const date = new Date(Number.isFinite(ms) ? ms : 0);
  return `${date.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`;
}

const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${TIMEZONE}`,
  `X-LIC-LOCATION:${TIMEZONE}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

function eventStart(event: CalendarEvent): string {
  return event.kind === 'timed' ? `${event.date}T${event.start}` : `${event.startDate}T00:00`;
}

function eventLines(event: CalendarEvent): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${event.uid}`, `DTSTAMP:${formatUtcTimestamp(event.stamp)}`];
  if (event.kind === 'timed') {
    lines.push(
      `DTSTART;TZID=${TIMEZONE}:${formatLocalDateTime(event.date, event.start)}`,
      `DTEND;TZID=${TIMEZONE}:${formatLocalDateTime(event.date, event.end)}`,
      `SUMMARY:${escapeText(event.summary)}`,
      'TRANSP:OPAQUE',
    );
  } else {
    lines.push(
      `DTSTART;VALUE=DATE:${formatDateValue(event.startDate)}`,
      // DTEND telt bij hele-dag-events niet mee: de dag na de laatste dag.
      `DTEND;VALUE=DATE:${formatDateValue(addDays(event.endDate, 1))}`,
      `SUMMARY:${escapeText(event.summary)}`,
      'TRANSP:TRANSPARENT',
    );
  }
  lines.push('END:VEVENT');
  return lines;
}

/** Bouwt een complete agenda. Dezelfde invoer geeft byte voor byte dezelfde uitvoer. */
export function buildCalendar(input: CalendarInput): string {
  const events = [...input.events].sort((a, b) => {
    const startA = eventStart(a);
    const startB = eventStart(b);
    if (startA !== startB) return startA < startB ? -1 : 1;
    return a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0;
  });
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Planbord//Rooster en verlof//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(input.name)}`,
    `X-WR-TIMEZONE:${TIMEZONE}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...VTIMEZONE,
    ...events.flatMap(eventLines),
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}
