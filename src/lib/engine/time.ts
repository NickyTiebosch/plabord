import type { TimeOfDay } from './types';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const LOOSE_TIME_PATTERN = /^(\d{1,2})[:.](\d{2})(?::(\d{2}))?$/;

export function isTimeOfDay(value: unknown): value is TimeOfDay {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

/**
 * Leest een tijd als 'H:MM', 'HH:MM', 'HH.MM' of 'HH:MM:SS' (zoals Postgres die teruggeeft).
 * Geeft 'HH:MM' terug, of `null` als het geen geldige tijd is.
 */
export function parseTime(value: string): TimeOfDay | null {
  const match = LOOSE_TIME_PATTERN.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] === undefined ? 0 : Number(match[3]);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return fromMinutes(hours * 60 + minutes);
}

export function toMinutes(time: TimeOfDay): number {
  const match = TIME_PATTERN.exec(time);
  if (!match) throw new RangeError(`Ongeldige tijd: ${time}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function fromMinutes(minutes: number): TimeOfDay {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= 24 * 60) {
    throw new RangeError(`Ongeldig aantal minuten: ${minutes}`);
  }
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Tijdvak met en-dash: '07:30–18:00'. */
export function formatTimeRange(start: TimeOfDay, end: TimeOfDay): string {
  return `${start}–${end}`;
}
