/**
 * Fouten van de mailserver (fase 3). Puur, zodat het los te testen is.
 *
 * Weigert de server één adres of één mail, dan kunnen de andere mails nog wel. Is de server
 * onbereikbaar of klopt het wachtwoord niet, dan heeft verder proberen die keer geen zin: elke
 * poging kost dan tot tien seconden, en de geplande taak probeert het later opnieuw.
 */

/** Foutcodes van nodemailer waarbij de verbinding of het inloggen bij de mailserver mislukt. */
const SERVER_UNAVAILABLE = new Set(['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ETLS', 'EAUTH', 'ENOAUTH', 'EPROXY']);

/** De code van een fout, zonder de melding: daarin kan een e-mailadres staan. */
export function mailErrorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') return error.code;
  return error instanceof Error ? error.name : 'onbekend';
}

/** `true` als de mailserver zelf niet bruikbaar is, en niet alleen deze ene mail mislukte. */
export function serverUnavailable(error: unknown): boolean {
  return SERVER_UNAVAILABLE.has(mailErrorCode(error));
}
