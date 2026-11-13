/**
 * Het startscherm (V53): je dienst van vandaag en je eerstvolgende dienst daarna.
 */
import type { MyScheduleDay, MyScheduleWeek } from './my-schedule';

export interface StartShifts {
  today: MyScheduleDay | null;
  /** De eerstvolgende dag na vandaag waarop je werkt; null als die niet in de periode valt. */
  next: MyScheduleDay | null;
}

/** Werk je die dag? Een dag met alleen een gesloten vestiging of alleen afwezigheid telt niet. */
function works(day: MyScheduleDay): boolean {
  return day.lines.some((line) => line.tone === 'normal' || line.tone === 'deviation');
}

export function startShifts(weeks: readonly MyScheduleWeek[]): StartShifts {
  const days = weeks.flatMap((week) => week.days);
  const index = days.findIndex((day) => day.isToday);
  // Op zondag staat vandaag niet in het rooster (ma–za): dan is alles wat er staat "daarna".
  const later = index === -1 ? days : days.slice(index + 1);
  return { today: index === -1 ? null : (days[index] ?? null), next: later.find(works) ?? null };
}
