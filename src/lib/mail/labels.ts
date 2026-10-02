/**
 * Woorden voor de mails in het beheer (fase 3): soort, status en het voorbeeld van morgen. Puur.
 */
import { addDays, weekdayOf } from '../engine/dates';
import type { IsoDate } from '../engine/types';
import type { MailKind, MailStatus } from './types';

export const MAIL_KIND_LABELS: Record<MailKind, string> = {
  substitution_assigned: 'Ingezet als invaller',
  substitution_cancelled: 'Inval gaat niet door',
  day_changed: 'Rooster gewijzigd',
  reminder: 'Herinnering',
  test: 'Testmail',
};

/** "verstuurd", "mislukt (2× geprobeerd)", "niet verstuurd: mails uit", … */
export function mailStatusLabel(status: MailStatus, lastError: string | null, attempts: number): string {
  switch (status) {
    case 'sent':
      return 'verstuurd';
    case 'pending':
      return 'wordt verstuurd';
    case 'failed':
      return attempts > 1 ? `mislukt (${attempts}× geprobeerd)` : 'mislukt';
    case 'skipped':
      return lastError === 'mails uit' ? 'niet verstuurd: mails uit' : 'niet verstuurd: geen werkmail';
  }
}

/** "push naar 2 toestellen" bij een mail (fase 4), of `null` als er geen push ging. */
export function pushLabel(devices: number): string | null {
  if (devices <= 0) return null;
  return `push naar ${devices} ${devices === 1 ? 'toestel' : 'toestellen'}`;
}

/**
 * Voor het voorbeeld in Instellingen: de eerstvolgende werkdag na vandaag, en de dag waarop de
 * herinneringen daarvoor om 16:00 weggaan (de dag ervoor; voor maandag is dat zondag).
 */
export function previewReminderDate(today: IsoDate): { date: IsoDate; sendDate: IsoDate } {
  const tomorrow = addDays(today, 1);
  const date = weekdayOf(tomorrow) === 7 ? addDays(tomorrow, 1) : tomorrow;
  return { date, sendDate: addDays(date, -1) };
}
