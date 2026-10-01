/** Databasefouten omzetten naar een begrijpelijke Nederlandse melding. */

export interface DbError {
  code?: string;
  message?: string;
}

const CONSTRAINT_MESSAGES: Record<string, string> = {
  employees_name_key: 'Er is al een medewerker met deze naam. Namen moeten uniek zijn.',
  employee_accounts_email_key: 'Dit e-mailadres hoort al bij een andere medewerker.',
  employee_accounts_email_format: 'Dit e-mailadres is niet geldig.',
  employees_name_format: 'Vul een naam in van maximaal 80 tekens, zonder dubbele spaties.',
  recurring_shifts_no_overlap: 'Er is al een vaste dienst op deze dag in die periode.',
  recurring_shifts_time_order: 'De eindtijd moet na de begintijd liggen.',
  recurring_shifts_valid_range: '"Geldig tot" mag niet vóór "geldig vanaf" liggen.',
  absences_unique: 'Deze afwezigheid bestaat al.',
  absences_half_day_single_date: 'Een halve dag kan alleen bij één dag.',
  absences_date_order: '"Tot" mag niet vóór "van" liggen.',
  closure_days_unique: 'Voor deze datum en groep bestaat al een afwijking.',
  calendar_feeds_active_key: 'Er is al een actieve link voor deze agenda.',
  settings_standard_shift_order: 'De standaarddienst moet eindigen na het begin.',
  settings_saturday_shift_order: 'De zaterdagdienst moet eindigen na het begin.',
};

export function dbErrorMessage(error: DbError | null | undefined, fallback = 'Opslaan is mislukt. Probeer het opnieuw.'): string {
  if (!error) return fallback;
  const message = error.message ?? '';
  for (const [constraint, text] of Object.entries(CONSTRAINT_MESSAGES)) {
    if (message.includes(constraint)) return text;
  }
  // Meldingen die de database zelf in het Nederlands geeft (raise exception).
  if (error.code === 'P0001' && message) return message;
  if (error.code === '42501') return 'Je hebt geen rechten voor deze actie.';
  if (error.code === '23514') return 'Een of meer waarden zijn niet toegestaan.';
  return fallback;
}
