/**
 * Het logboek leesbaar maken: van databaserij naar een Nederlandse zin.
 * Het logboek bevat geen namen of e-mailadressen; namen zoeken we hier op bij de id's.
 */
import { amsterdamDateTime, isIsoDate } from '../engine/dates';
import { formatDate, formatDateRange, formatDayShortWithYear, weekdayShort } from '../engine/format';
import { ABSENCE_PART_LABELS, ABSENCE_STATUS_LABELS, DAY_PART_LABELS, ROLE_LABELS } from '../engine/labels';
import { parseTime } from '../engine/time';
import type { AbsencePart, AbsenceStatus, DayPart, Role, Weekday } from '../engine/types';

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
  if (field === 'kind') return KINDS[String(value)] ?? String(value);
  if (field === 'handled_at' && typeof value === 'string') return 'ja';
  if (typeof value === 'string' && isIsoDate(value)) return formatDate(value);
  if (typeof value === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(value)) return parseTime(value) ?? value;
  if (field === 'revoked_at' && typeof value === 'string') return 'ja';
  return String(value);
}

function changesText(row: AuditRow, lookups: Lookups): string | null {
  const details = record(row.details);
  const changed = row.changed_fields ?? [];
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
};

/** Wat er bij volledig verwijderen (fase 3, V21) met de medewerker verdween, als aantallen. */
const DELETED_COUNTS: [key: string, one: string, many: string][] = [
  ['recurring_shifts', 'vaste dienst', 'vaste diensten'],
  ['absences', 'afwezigheid', 'afwezigheden'],
  ['substitutions', 'inval', 'invallen'],
  ['shift_overrides', 'roosterwijziging', 'roosterwijzigingen'],
  ['calendar_feeds', 'agendalink', 'agendalinks'],
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
      what = details.kind === 'employee' ? `Gegevens gedownload – ${lookups.employeeName(row.employee_id)}` : 'Planning geëxporteerd';
      break;
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
