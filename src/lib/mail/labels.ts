/**
 * Woorden voor de mails in het beheer (fase 3): soort, status en het voorbeeld van morgen. Puur.
 */
import { addDays, weekdayOf } from '../engine/dates';
import type { IsoDate } from '../engine/types';
import type { MailFailure } from './smtp-errors';
import type { MailKind, MailStatus } from './types';

export const MAIL_KIND_LABELS: Record<MailKind, string> = {
  substitution_assigned: 'Ingezet als invaller',
  substitution_cancelled: 'Inval gaat niet door',
  day_changed: 'Rooster gewijzigd',
  reminder: 'Herinnering',
  test: 'Testmail',
  invite: 'Uitnodiging',
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
      if (lastError === 'mails uit') return 'niet verstuurd: mails uit';
      // Een nieuwe uitnodiging vervangt een oudere die nog openstond (V39).
      if (lastError === 'vervangen') return 'niet verstuurd: vervangen door een nieuwe';
      return 'niet verstuurd: geen werkmail';
  }
}

/** De oorzaken in de wachtrij die iets toevoegen aan "mislukt" (V39). Nooit een adres of wachtwoord. */
const FAILURE_REASONS = new Set([
  'mailserver niet ingesteld',
  'inloggen bij mailserver geweigerd',
  'mailserver onbereikbaar',
  'mail geweigerd',
]);

/** Waarom een mail mislukte, voor Beheer → Mails, of `null` als dat niets toevoegt. */
export function mailFailureReason(status: MailStatus, lastError: string | null): string | null {
  return status === 'failed' && lastError && FAILURE_REASONS.has(lastError) ? lastError : null;
}

const REDEPLOY = 'start daarna een nieuwe deploy (Deployments → de bovenste → ⋯ → Redeploy)';

/** Wat er mis is als de testmail niet lukt, en wat je eraan doet (V39). */
export function testMailErrorText(failure: MailFailure): string {
  switch (failure.kind) {
    case 'config':
      return `De testmail kon niet weg: in Vercel ontbreekt ${failure.variable}. Vul die in bij Settings → Environment Variables en ${REDEPLOY}.`;
    case 'auth':
      return `De mailserver weigert het inloggen: SMTP_USER of SMTP_PASSWORD klopt niet. Maak een nieuw app-wachtwoord voor die mailbox, zet het in Vercel bij SMTP_PASSWORD en ${REDEPLOY}.`;
    case 'connection':
      return `De mailserver is niet bereikbaar. Controleer in Vercel SMTP_HOST en SMTP_PORT (bij Google: smtp.gmail.com en 465) en ${REDEPLOY}. Klopt dat, probeer het dan over een paar minuten opnieuw.`;
    case 'rejected':
      return 'De mailserver weigerde de testmail. Controleer in Vercel MAIL_FROM: dat moet het adres van de mailbox zijn, of een alias ervan. Controleer ook je eigen werkmail in Planbord.';
    case 'unknown':
      return 'De testmail kon niet worden verstuurd. Controleer in Vercel SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD en MAIL_FROM (zie de README).';
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
