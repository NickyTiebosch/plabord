/**
 * Het logboek leesbaar maken: van databaserij naar een Nederlandse zin.
 * Het logboek bevat geen namen of e-mailadressen; namen zoeken we hier op bij de id's.
 */
import { amsterdamDateTime, isIsoDate } from '../engine/dates';
import { formatDate, formatDateRange, formatDayShortWithYear, weekdayShort } from '../engine/format';
import { ABSENCE_PART_LABELS, ABSENCE_STATUS_LABELS, DAY_PART_LABELS, ROLE_LABELS } from '../engine/labels';
import { parseTime } from '../engine/time';
import type { AbsencePart, AbsenceStatus, DayPart, Role, Weekday } from '../engine/types';
import { formatPlate } from '../loans/plates';
import { DESTINATION_LABELS, isDestination } from '../loans/types';
import { INCIDENT_KIND_LABELS, MISSING_LABELS, isIncidentKind, isMissing } from '../registrations/types';

export interface AuditRow {
  id: number;
  occurred_at: string;
  actor_user_id: string | null;
  actor_employee_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  employee_id: string | null;
  changed_fields: string[] | null;
  details: unknown;
  source: string | null;
}

export interface AuditView {
  id: number;
  when: string;
  who: string;
  what: string;
  detail: string | null;
  source: string | null;
}

export const AUDIT_ENTITIES: Record<string, string> = {
  absences: 'Afwezigheid',
  employees: 'Medewerkers',
  employee_accounts: 'E-mail en accounts',
  counter_eligibility: 'Inzetbaarheid',
  recurring_shifts: 'Vaste diensten',
  closure_days: 'Sluitingsdagen',
  calendar_feeds: 'Agendalinks',
  settings: 'Instellingen',
  staffing_norms: 'Normen',
  groups: 'Invalvolgorde',
  substitutions: 'Invallen',
  shift_overrides: 'Roosterwijzigingen',
  gap_dismissals: 'Genegeerde gaten',
  vehicle_loans: 'Mobiliteit',
  // Fase 6.
  workshops: 'Werkplaatsen',
  walk_ins: 'Binnenvallers',
  incident_reports: 'Werkplaatsmeldingen',
  day_closures: 'Dag afgesloten',
  // Fase 8.
  parking_spots: 'Plekken',
  vehicle_locations: 'Locatie',
  export: 'Exports',
};

const FIELD_LABELS: Record<string, string> = {
  name: 'naam',
  group_id: 'groep',
  default_role: 'rol',
  role: 'rol',
  is_admin: 'beheerder',
  is_active: 'actief',
  email: 'e-mailadres',
  user_id: 'inlogaccount',
  start_date: 'van',
  end_date: 'tot',
  day_part: 'dagdeel',
  status: 'status',
  weekday: 'dag',
  start_time: 'begintijd',
  end_time: 'eindtijd',
  valid_from: 'geldig vanaf',
  valid_to: 'geldig tot',
  date: 'datum',
  is_closed: 'dicht',
  label: 'omschrijving',
  revoked_at: 'ingetrokken',
  min_staff: 'norm',
  substitution_rank: 'invalvolgorde',
  standard_shift_start: 'begin standaarddienst',
  standard_shift_end: 'einde standaarddienst',
  saturday_shift_start: 'begin zaterdag',
  saturday_shift_end: 'einde zaterdag',
  day_part_boundary: 'dagdeelgrens',
  lookahead_weeks: 'vooruitkijken (weken)',
  kind: 'soort',
  employee_id: 'medewerker',
  sort_order: 'volgorde',
  has_counter: 'balie',
  handled_at: 'afgehandeld',
  shortage: 'tekort',
  mail_enabled: 'mails versturen',
  // Fase 5.
  is_team_lead: 'teamleider',
  mobility_loans_per_day: 'auto’s voor Mobiliteit per werkdag',
  license_plate: 'kenteken',
  destination: 'bestemming',
  handed_out_at: 'meegegeven',
  returned_at: 'retour',
  was_used: 'ingezet',
  // Fase 6.
  workshop_id: 'werkplaats',
  count: 'aantal',
  occurred_at: 'moment',
  missing: 'wat ontbrak',
  cancelled_at: 'tijdstip annulering',
  charge: 'doorbelasten',
  charged_at: 'doorbelast',
  contract_number: 'contractnummer',
  rentlink_checked: 'RentLink gecontroleerd',
  charge_cancellation_from: 'doorbelasten vanaf',
  day_close_reminder_at: 'herinnering dag afsluiten',
  // Fase 8.
  spot_id: 'plek',
  model: 'model',
  // Fase 7.
  signal_incident_factor: 'signaal meldingen (keer het gemiddelde)',
  signal_incident_min: 'signaal meldingen (minstens)',
  signal_unclosed_days: 'signaal dagen niet afgesloten',
  signal_charge_days: 'signaal dagen op de doorbelastlijst',
  signal_short_days: 'signaal dagen te weinig auto’s',
  signal_unused_percent: 'signaal niet ingezet (%)',
};

const KINDS: Record<string, string> = {
  // Agendalinks
  personal: 'mijn rooster',
  location: 'vestiging',
  absences: 'verlof team',
  // Roosterwijzigingen voor één dag (fase 2)
  off: 'geen dienst',
  shift: 'andere dienst',
};

const SUBSTITUTION_STATUS_LABELS: Record<string, string> = {
  active: 'gaat door',
  not_needed: 'niet meer nodig',
  reschedule: 'opnieuw regelen',
};

interface Lookups {
  employeeName: (id: string | null | undefined) => string;
  groupName: (id: string | null | undefined) => string;
  /** Vestiging, datum en dagdeel van een inval: bij een wijziging staan die niet in het logboek zelf. */
  substitution?: (id: string | null | undefined) => Record<string, unknown> | null;
  /** Fase 6: de naam van een werkplaats. */
  workshopName?: (id: string | null | undefined) => string;
  /**
   * Fase 6: bij een wijziging staan alleen de gewijzigde velden in het logboek. Vestiging,
   * werkplaats en dag halen we bij de regel zelf (binnenvallers, meldingen, afgesloten dagen).
   */
  context?: (entity: string, id: string | null | undefined) => Record<string, unknown> | null;
  /** Fase 8: de naam van een plek. */
  spotName?: (id: string | null | undefined) => string;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function formatValue(field: string, value: unknown, lookups: Lookups): string {
  if (value === null || value === undefined) return field === 'valid_to' ? 'onbepaald' : '–';
  if (typeof value === 'boolean') return value ? 'ja' : 'nee';
  if (field === 'group_id') return lookups.groupName(String(value));
  if (field === 'role' || field === 'default_role') return ROLE_LABELS[value as Role] ?? String(value);
  if (field === 'day_part') {
    return ABSENCE_PART_LABELS[value as AbsencePart] ?? DAY_PART_LABELS[value as DayPart] ?? String(value);
  }
  if (field === 'status') {
    return ABSENCE_STATUS_LABELS[value as AbsenceStatus] ?? SUBSTITUTION_STATUS_LABELS[String(value)] ?? String(value);
  }
  if (field === 'weekday') return weekdayShort(Number(value) as Weekday);
  if (field === 'kind') return isIncidentKind(value) ? INCIDENT_KIND_LABELS[value] : (KINDS[String(value)] ?? String(value));
  if (field === 'workshop_id') return lookups.workshopName?.(String(value)) ?? 'werkplaats';
  if (field === 'spot_id') return lookups.spotName?.(String(value)) ?? 'plek';
  if (field === 'missing') return isMissing(value) ? MISSING_LABELS[value] : String(value);
  if (field === 'charged_at' && typeof value === 'string') return 'ja';
  if (field === 'handled_at' && typeof value === 'string') return 'ja';
  if (field === 'license_plate') return formatPlate(String(value));
  if (field === 'destination') return isDestination(value) ? DESTINATION_LABELS[value] : String(value);
  if ((field === 'handed_out_at' || field === 'returned_at' || field === 'occurred_at') && typeof value === 'string') {
    const moment = amsterdamDateTime(new Date(value));
    return `${formatDate(moment.date)} ${moment.time}`;
  }
  if (typeof value === 'string' && isIsoDate(value)) return formatDate(value);
  if (typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) return parseTime(value) ?? value;
  if (field === 'revoked_at' && typeof value === 'string') return 'ja';
  return String(value);
}

/** Velden die alleen bijhouden wie het laatst iets deed: dat staat al bij "wie" in het logboek. */
const BOOKKEEPING_FIELDS = new Set(['updated_by', 'closed_by', 'closed_at', 'charged_by', 'moved_by', 'moved_at']);

function changesText(row: AuditRow, lookups: Lookups): string | null {
  const details = record(row.details);
  const changed = (row.changed_fields ?? []).filter((field) => !BOOKKEEPING_FIELDS.has(field));
  if (changed.length === 0) return null;
  return changed
    .map((field) => {
      const label = FIELD_LABELS[field] ?? field;
      const change = record(details[field]);
      if ('old' in change || 'new' in change) {
        return `${label}: ${formatValue(field, change.old, lookups)} → ${formatValue(field, change.new, lookups)}`;
      }
      return label;
    })
    .join('; ');
}

function absenceText(details: Record<string, unknown>): string | null {
  const start = details.start_date;
  const end = details.end_date;
  if (typeof start !== 'string' || typeof end !== 'string') return null;
  const parts = [formatDateRange(start, end)];
  const dayPart = details.day_part as AbsencePart | undefined;
  if (dayPart) parts.push(ABSENCE_PART_LABELS[dayPart] ?? dayPart);
  const status = details.status as AbsenceStatus | undefined;
  if (status) parts.push(ABSENCE_STATUS_LABELS[status] ?? status);
  return parts.join(', ');
}

function shiftText(details: Record<string, unknown>, lookups: Lookups): string | null {
  if (details.weekday === undefined) return null;
  const parts = [
    `${formatValue('weekday', details.weekday, lookups)} vanaf ${formatValue('valid_from', details.valid_from, lookups)}`,
  ];
  if (details.valid_to) parts.push(`t/m ${formatValue('valid_to', details.valid_to, lookups)}`);
  parts.push(formatValue('group_id', details.group_id, lookups), formatValue('role', details.role, lookups));
  const start = details.start_time ? formatValue('start_time', details.start_time, lookups) : null;
  const end = details.end_time ? formatValue('end_time', details.end_time, lookups) : null;
  parts.push(start || end ? `${start ?? 'standaard'}–${end ?? 'standaard'}` : 'standaardtijden');
  return parts.join(', ');
}

const VERBS: Record<string, [string, string, string]> = {
  absences: ['Afwezigheid ingevoerd', 'Afwezigheid gewijzigd', 'Afwezigheid verwijderd'],
  employees: ['Medewerker toegevoegd', 'Medewerker gewijzigd', 'Medewerker verwijderd'],
  employee_accounts: ['E-mailadres toegevoegd', 'Account gewijzigd', 'E-mailadres verwijderd'],
  counter_eligibility: ['Inzetbaar aan de balie', 'Inzetbaarheid gewijzigd', 'Niet meer inzetbaar aan de balie'],
  recurring_shifts: ['Vaste dienst toegevoegd', 'Vaste dienst gewijzigd', 'Vaste dienst verwijderd'],
  closure_days: ['Sluitingsdag-afwijking toegevoegd', 'Sluitingsdag-afwijking gewijzigd', 'Sluitingsdag-afwijking verwijderd'],
  calendar_feeds: ['Agendalink gemaakt', 'Agendalink gewijzigd', 'Agendalink verwijderd'],
  settings: ['Instellingen aangemaakt', 'Instellingen gewijzigd', 'Instellingen verwijderd'],
  staffing_norms: ['Norm aangemaakt', 'Norm gewijzigd', 'Norm verwijderd'],
  groups: ['Groep aangemaakt', 'Groep gewijzigd', 'Groep verwijderd'],
  substitutions: ['Inval toegewezen', 'Inval gewijzigd', 'Inval verwijderd'],
  shift_overrides: ['Roosterwijziging voor één dag', 'Roosterwijziging aangepast', 'Terug naar de vaste dienst'],
  gap_dismissals: ['Gat genegeerd', 'Genegeerd gat bijgewerkt', 'Gat teruggezet'],
  vehicle_loans: ['Auto aangemeld', 'Registratie gecorrigeerd', 'Registratie verwijderd'],
  workshops: ['Werkplaats toegevoegd', 'Werkplaats gewijzigd', 'Werkplaats verwijderd'],
  walk_ins: ['Binnenvallers geteld', 'Binnenvallers bijgewerkt', 'Binnenvallers verwijderd'],
  incident_reports: ['Melding gemaakt', 'Melding gewijzigd', 'Melding verwijderd'],
  day_closures: ['Dag afgesloten', 'Dag afsluiten gewijzigd', 'Dag heropend'],
  parking_spots: ['Plek toegevoegd', 'Plek gewijzigd', 'Plek verwijderd'],
  vehicle_locations: ['Auto op een plek gezet', 'Auto verzet', 'Auto weg van het terrein'],
};

const EXPORT_LABELS: Record<string, string> = {
  loans: 'Mobiliteit geëxporteerd',
  walk_ins: 'Binnenvallers geëxporteerd',
  incidents: 'Meldingen geëxporteerd',
  reports: 'Rapport geëxporteerd',
  locations: 'Locatie geëxporteerd',
};

/** Wat er bij volledig verwijderen (fase 3, V21) met de medewerker verdween, als aantallen. */
const DELETED_COUNTS: [key: string, one: string, many: string][] = [
  ['recurring_shifts', 'vaste dienst', 'vaste diensten'],
  ['absences', 'afwezigheid', 'afwezigheden'],
  ['substitutions', 'inval', 'invallen'],
  ['shift_overrides', 'roosterwijziging', 'roosterwijzigingen'],
  ['calendar_feeds', 'agendalink', 'agendalinks'],
  ['push_subscriptions', 'toestel met meldingen', 'toestellen met meldingen'],
];

function deletedText(details: Record<string, unknown>): string | null {
  const parts = DELETED_COUNTS.flatMap(([key, one, many]) => {
    const count = Number(details[key] ?? 0);
    return count > 0 ? [`${count} ${count === 1 ? one : many}`] : [];
  });
  if (details.account === true) parts.push('het inlogaccount');
  const last = parts.pop();
  if (last === undefined) return null;
  return parts.length === 0 ? last : `${parts.join(', ')} en ${last}`;
}

/** "Eindhoven, 12 okt 2026, hele dag" voor een inval of genegeerd gat. */
function slotText(details: Record<string, unknown>, lookups: Lookups): string {
  return [
    formatValue('group_id', details.group_id, lookups),
    formatValue('date', details.date, lookups),
    formatValue('day_part', details.day_part, lookups),
  ].join(', ');
}

/** "12 okt 2026, geen dienst" of "12 okt 2026, andere dienst, Breda, balie, 09:00–standaard". */
function overrideText(details: Record<string, unknown>, lookups: Lookups): string {
  const parts = [formatValue('date', details.date, lookups), formatValue('kind', details.kind, lookups)];
  if (details.kind === 'shift') {
    parts.push(formatValue('group_id', details.group_id, lookups), formatValue('role', details.role, lookups));
    const start = details.start_time ? formatValue('start_time', details.start_time, lookups) : null;
    const end = details.end_time ? formatValue('end_time', details.end_time, lookups) : null;
    parts.push(start || end ? `${start ?? 'standaard'}–${end ?? 'standaard'}` : 'standaardtijden');
  }
  return parts.join(', ');
}

export function describeAudit(row: AuditRow, lookups: Lookups): AuditView {
  const details = record(row.details);
  const index = row.action === 'insert' ? 0 : row.action === 'update' ? 1 : 2;
  let what = VERBS[row.entity]?.[index] ?? `${row.entity}: ${row.action}`;
  let detail: string | null = null;

  if (row.employee_id) what += ` – ${lookups.employeeName(row.employee_id)}`;

  switch (row.entity) {
    case 'absences':
      detail = row.action === 'update' ? changesText(row, lookups) : absenceText(details);
      break;
    case 'recurring_shifts':
      detail = row.action === 'update' ? changesText(row, lookups) : shiftText(details, lookups);
      break;
    case 'employee_accounts':
      if (row.action === 'update') {
        const fields = row.changed_fields ?? [];
        if (fields.includes('user_id')) what = `Inlogaccount gekoppeld – ${lookups.employeeName(row.employee_id)}`;
        if (fields.includes('email')) what = `E-mailadres gewijzigd – ${lookups.employeeName(row.employee_id)}`;
      }
      break;
    case 'counter_eligibility':
      detail = formatValue('group_id', details.group_id, lookups);
      break;
    case 'closure_days':
      detail =
        row.action === 'update'
          ? changesText(row, lookups)
          : [
              formatValue('date', details.date, lookups),
              details.group_id ? formatValue('group_id', details.group_id, lookups) : 'alle groepen',
              details.is_closed ? 'dicht' : 'open',
              typeof details.label === 'string' ? details.label : null,
            ]
              .filter(Boolean)
              .join(', ');
      break;
    case 'calendar_feeds':
      if (row.action === 'update' && (row.changed_fields ?? []).includes('revoked_at')) {
        what = `Agendalink ingetrokken${row.employee_id ? ` – ${lookups.employeeName(row.employee_id)}` : ''}`;
      }
      detail = [formatValue('kind', details.kind, lookups), details.group_id ? formatValue('group_id', details.group_id, lookups) : null]
        .filter((value) => value && value !== '–')
        .join(', ') || null;
      break;
    case 'staffing_norms':
      detail = [
        formatValue('group_id', details.group_id, lookups),
        formatValue('weekday', details.weekday, lookups),
        formatValue('day_part', details.day_part, lookups),
        row.action === 'update' ? changesText(row, lookups) : `norm ${String(details.min_staff ?? '')}`,
      ].join(' · ');
      break;
    case 'substitutions': {
      const changed = row.changed_fields ?? [];
      const status = record(details.status).new;
      const who = row.employee_id ? ` – ${lookups.employeeName(row.employee_id)}` : '';
      if (row.action === 'update' && changed.includes('status') && typeof status === 'string') {
        // Intrekken zet de status en "afgehandeld" in één keer; de controle zet alleen de status.
        what =
          status === 'not_needed' && changed.includes('handled_at')
            ? `Inval ingetrokken${who}`
            : `Inval ${SUBSTITUTION_STATUS_LABELS[status] ?? status}${who}`;
      } else if (row.action === 'update' && changed.length === 1 && changed[0] === 'handled_at') {
        what = `Vervallen inval afgehandeld${who}`;
      }
      const slot = row.action === 'update' ? (lookups.substitution?.(row.entity_id) ?? null) : details;
      detail = slot ? slotText(slot, lookups) : null;
      break;
    }
    case 'shift_overrides':
      detail = row.action === 'update' ? changesText(row, lookups) : overrideText(details, lookups);
      break;
    case 'employees':
      if (row.action === 'delete' && row.source === 'verwijderen') {
        what = `Medewerker volledig verwijderd – ${lookups.employeeName(row.employee_id)}`;
        detail = deletedText(details);
      } else {
        detail = row.action === 'update' ? changesText(row, lookups) : null;
      }
      break;
    case 'export':
      what =
        details.kind === 'employee'
          ? `Gegevens gedownload – ${lookups.employeeName(row.employee_id)}`
          : (EXPORT_LABELS[String(details.kind)] ?? 'Planning geëxporteerd');
      break;
    case 'workshops':
      detail =
        row.action === 'update'
          ? changesText(row, lookups)
          : [formatValue('group_id', details.group_id, lookups), typeof details.name === 'string' ? details.name : null].filter(Boolean).join(', ');
      break;
    case 'walk_ins': {
      // "Breda, Volkswagen, 12 okt 2026: 3", of bij bijwerken "Breda, Volkswagen, 12 okt 2026: aantal: 2 → 3".
      const place = row.action === 'update' ? (lookups.context?.(row.entity, row.entity_id) ?? null) : details;
      const where = place
        ? [
            formatValue('group_id', place.group_id, lookups),
            formatValue('workshop_id', place.workshop_id, lookups),
            formatValue('date', place.date, lookups),
          ].join(', ')
        : null;
      const change = row.action === 'update' ? changesText(row, lookups) : String(details.count ?? '?');
      detail = [where, change].filter(Boolean).join(': ') || null;
      break;
    }
    case 'incident_reports': {
      // Zonder bijzonderheden (vrije tekst). Wel soort, werkplaats, kenteken en contractnummer.
      const changed = (row.changed_fields ?? []).filter((field) => !BOOKKEEPING_FIELDS.has(field));
      const charged = record(details.charged_at);
      const melding = row.action === 'update' ? (lookups.context?.(row.entity, row.entity_id) ?? null) : null;
      const which = melding
        ? [
            formatValue('kind', melding.kind, lookups),
            formatValue('group_id', melding.group_id, lookups),
            formatValue('workshop_id', melding.workshop_id, lookups),
            formatValue('occurred_at', melding.occurred_at, lookups),
          ].join(', ')
        : null;
      if (row.action === 'update' && changed.length === 1 && changed[0] === 'charged_at') {
        what = charged.new ? 'Melding doorbelast' : 'Doorbelast teruggezet';
        detail = which;
      } else if (row.action === 'update') {
        detail = [which, changesText(row, lookups)].filter(Boolean).join(': ') || null;
      } else {
        if (row.action === 'delete' && row.source === 'opruimen') what = 'Melding opgeruimd (ouder dan 24 maanden)';
        if (row.action === 'insert' && row.source === 'import') what = 'Melding ingelezen uit Excel';
        detail = [
          formatValue('kind', details.kind, lookups),
          formatValue('group_id', details.group_id, lookups),
          formatValue('workshop_id', details.workshop_id, lookups),
          formatValue('occurred_at', details.occurred_at, lookups),
          details.license_plate ? formatValue('license_plate', details.license_plate, lookups) : null,
          details.contract_number ? `contract ${String(details.contract_number)}` : null,
        ]
          .filter(Boolean)
          .join(', ');
      }
      break;
    }
    case 'day_closures': {
      const day = row.action === 'update' ? (lookups.context?.(row.entity, row.entity_id) ?? null) : null;
      detail =
        row.action === 'update'
          ? [day ? `${formatValue('group_id', day.group_id, lookups)}, ${formatValue('date', day.date, lookups)}` : null, changesText(row, lookups)]
              .filter(Boolean)
              .join(': ') || null
          : [
              formatValue('group_id', details.group_id, lookups),
              formatValue('date', details.date, lookups),
              row.action === 'insert' ? `RentLink gecontroleerd: ${formatValue('rentlink_checked', details.rentlink_checked, lookups)}` : null,
            ]
              .filter(Boolean)
              .join(', ');
      break;
    }
    case 'parking_spots':
      detail =
        row.action === 'update'
          ? changesText(row, lookups)
          : [formatValue('group_id', details.group_id, lookups), typeof details.name === 'string' ? details.name : null].filter(Boolean).join(', ');
      break;
    case 'vehicle_locations': {
      // Fase 8: kenteken, vestiging en plek. Bij verzetten: van welke plek naar welke.
      const which = row.action === 'update' ? (lookups.context?.(row.entity, row.entity_id) ?? null) : details;
      const plate = which?.license_plate ? formatValue('license_plate', which.license_plate, lookups) : null;
      if (row.action === 'update') {
        detail = [plate, changesText(row, lookups)].filter(Boolean).join(': ') || null;
      } else {
        if (row.action === 'insert' && row.source === 'import') what = 'Auto ingelezen op een plek';
        detail = [plate, formatValue('group_id', details.group_id, lookups), formatValue('spot_id', details.spot_id, lookups)].filter(Boolean).join(', ');
      }
      break;
    }
    case 'vehicle_loans': {
      // Fase 5: zonder vrije tekst (aan wie, opmerkingen); wel kenteken, vestiging en tijdstippen.
      const changed = row.changed_fields ?? [];
      const returned = record(details.returned_at);
      const used = record(details.was_used).new;
      if (row.action === 'update' && changed.includes('returned_at') && returned.new && !returned.old) {
        what = used === false ? 'Auto retour gemeld, niet ingezet' : 'Auto retour gemeld, ingezet';
        detail = formatValue('returned_at', returned.new, lookups);
      } else if (row.action === 'update' && changed.includes('returned_at') && !returned.new && returned.old) {
        what = 'Retour ongedaan gemaakt';
        detail = null;
      } else if (row.action === 'update') {
        detail = changesText(row, lookups);
      } else {
        if (row.action === 'delete' && row.source === 'opruimen') what = 'Registratie opgeruimd (langer dan 24 maanden retour)';
        detail = [
          formatValue('license_plate', details.license_plate, lookups),
          formatValue('group_id', details.group_id, lookups),
          formatValue('destination', details.destination, lookups),
          formatValue('handed_out_at', details.handed_out_at, lookups),
        ].join(', ');
      }
      break;
    }
    case 'gap_dismissals':
      detail =
        row.action === 'update'
          ? changesText(row, lookups)
          : `${slotText(details, lookups)}, tekort ${String(details.shortage ?? '?')}`;
      break;
    default:
      detail = row.action === 'update' ? changesText(row, lookups) : null;
  }

  const moment = amsterdamDateTime(new Date(row.occurred_at));
  const who = row.actor_employee_id
    ? lookups.employeeName(row.actor_employee_id)
    : row.source === 'setup'
      ? 'Setup'
      : 'Systeem';

  return {
    id: row.id,
    when: `${formatDayShortWithYear(moment.date)} ${moment.time}`,
    who,
    what,
    detail,
    source: row.source,
  };
}
