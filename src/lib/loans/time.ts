/**
 * Datum en tijd in Europe/Amsterdam naar een tijdstip, en terug (fase 5). Puur: "nu" komt binnen
 * als parameter. Een formulier geeft een datum en een tijd in Nederlandse tijd; de database bewaart
 * een tijdstempel.
 */
import { addDays, amsterdamDateTime } from '../engine/dates';
import { toMinutes } from '../engine/time';
import type { IsoDate, TimeOfDay } from '../engine/types';
import type { LocalMoment } from './types';

/** Het verschil tussen Nederlandse tijd en UTC op een moment, in minuten (60 of 120). */
function offsetMinutes(moment: number): number {
  const local = amsterdamDateTime(new Date(moment));
  const [year = 0, month = 1, day = 1] = local.date.split('-').map(Number);
  const [hours = 0, minutes = 0] = local.time.split(':').map(Number);
  const asUtc = Date.UTC(year, month - 1, day, hours, minutes);
  return Math.round((asUtc - Math.floor(moment / 60_000) * 60_000) / 60_000);
}

/**
 * Het tijdstip van een datum en tijd in Nederlandse tijd. Bestaat die tijd niet of twee keer (in de
 * nacht van de wisseling tussen zomer- en wintertijd), dan een tijdstip binnen een uur ervan.
 */
export function amsterdamInstant(date: IsoDate, time: TimeOfDay): Date {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const minutes = toMinutes(time);
  const naive = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
  const first = naive - offsetMinutes(naive) * 60_000;
  const second = naive - offsetMinutes(first) * 60_000;
  const exact = [first, second].find((moment) => {
    const local = amsterdamDateTime(new Date(moment));
    return local.date === date && local.time === time;
  });
  return new Date(exact ?? Math.max(first, second));
}

/** Datum en tijd (uu:mm) van een tijdstempel in Nederlandse tijd. */
export function localMoment(timestamp: string): LocalMoment {
  return amsterdamDateTime(new Date(timestamp));
}

/** Het begin van een dag in Nederlandse tijd, als ISO-tijdstempel: voor zoeken op datum. */
export function startOfLocalDay(date: IsoDate): string {
  return amsterdamInstant(date, '00:00').toISOString();
}

/** Het begin van de dag ná `date`, als ISO-tijdstempel: de bovengrens van een periode t/m `date`. */
export function endOfLocalDay(date: IsoDate): string {
  return amsterdamInstant(addDays(date, 1), '00:00').toISOString();
}
