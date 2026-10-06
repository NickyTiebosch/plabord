/**
 * Fouten van de mailserver (fase 3). Puur, zodat het los te testen is.
 *
 * Weigert de server één adres of één mail, dan kunnen de andere mails nog wel. Is de server
 * onbereikbaar of klopt het wachtwoord niet, dan heeft verder proberen die keer geen zin: elke
 * poging kost dan tot tien seconden, en de geplande taak probeert het later opnieuw.
 *
 * Sinds V39 onderscheidt Planbord ook het soort fout, voor de testmail en Beheer → Mails. Alleen
 * het soort: de melding van de mailserver zelf kan een adres bevatten.
 */
import { ConfigError } from '../env';

/** Foutcodes van nodemailer waarbij het inloggen bij de mailserver mislukt. */
const AUTH = new Set(['EAUTH', 'ENOAUTH']);
/** Foutcodes van nodemailer waarbij de verbinding met de mailserver mislukt. */
const CONNECTION = new Set(['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ETLS', 'EPROXY']);
/** Foutcodes van nodemailer waarbij de mailserver deze ene mail weigert (afzender, ontvanger of inhoud). */
const REJECTED = new Set(['EENVELOPE', 'EMESSAGE']);

/** Het soort fout (V39). Bij een ontbrekende instelling de naam ervan, nooit een waarde. */
export type MailFailure =
  | { kind: 'config'; variable: string }
  | { kind: 'auth' }
  | { kind: 'connection' }
  | { kind: 'rejected' }
  | { kind: 'unknown' };

/** De code van een fout, zonder de melding: daarin kan een e-mailadres staan. */
export function mailErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') return error.code;
  return error instanceof Error ? error.name : 'onbekend';
}

export function mailFailure(error: unknown): MailFailure {
  if (error instanceof ConfigError) return { kind: 'config', variable: error.variable };
  const code = mailErrorCode(error);
  if (AUTH.has(code)) return { kind: 'auth' };
  if (CONNECTION.has(code)) return { kind: 'connection' };
  if (REJECTED.has(code)) return { kind: 'rejected' };
  return { kind: 'unknown' };
}

/** `true` als de mailserver zelf niet bruikbaar is, en niet alleen deze ene mail mislukte. */
export function serverUnavailable(error: unknown): boolean {
  const { kind } = mailFailure(error);
  return kind === 'auth' || kind === 'connection';
}

/** De korte oorzaak in de wachtrij (`last_error`), zonder adres of wachtwoord. */
export function failureCode(failure: MailFailure | null): string {
  switch (failure?.kind) {
    case 'config':
      return 'mailserver niet ingesteld';
    case 'auth':
      return 'inloggen bij mailserver geweigerd';
    case 'connection':
      return 'mailserver onbereikbaar';
    case 'rejected':
      return 'mail geweigerd';
    default:
      return 'versturen mislukt';
  }
}
