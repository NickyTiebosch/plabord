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
  // Fase 5: de uitleen.
  vehicle_loans_one_open_per_plate: 'Deze auto staat nog uitgeleend. Meld hem eerst retour.',
  vehicle_loans_plate_format: 'Vul een kenteken in: 2 tot 10 letters en cijfers.',
  vehicle_loans_odometer_order: 'De kilometerstand bij retour is lager dan bij het meegeven.',
  vehicle_loans_return_order: 'Retour kan niet vóór het meegeven liggen.',
  vehicle_loans_group_fkey: 'Kies een vestiging met een balie.',
  groups_lends_vehicles_counter_only: 'Alleen een vestiging met een balie kan auto’s uitlenen.',
  groups_mobility_loans_range: 'Vul een aantal in van 0 tot en met 20.',
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
