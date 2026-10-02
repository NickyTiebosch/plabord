/**
 * Celwaarden uit Excel omzetten naar gewone waarden. read-excel-file levert tekst, getallen,
 * booleans en Date-objecten (voor datum- en tijdcellen, in UTC).
 */
import { isIsoDate, isoDateFromUtcDate, makeIsoDate } from '../engine/dates';
import { fromMinutes, parseTime } from '../engine/time';
import type { AbsencePart, AbsenceStatus, Group, IsoDate, Role, ShiftWeekday, TimeOfDay } from '../engine/types';

export type CellValue = string | number | boolean | Date | null | undefined;

export type CellResult<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): CellResult<T> => ({ ok: true, value });
const fail = <T>(error: string): CellResult<T> => ({ ok: false, error });

const DAY_MS = 86_400_000;
/** Dag 0 van de Excel-datums (1900-systeem, inclusief de schrikkeldagfout van Excel). */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

/** Tekst van een cel: zonder spaties aan begin en eind en met enkele spaties. */
export function cellText(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : isoDateFromUtcDate(value);
  return String(value).trim().replace(/\s+/g, ' ');
}

export function isEmptyCell(value: CellValue): boolean {
  return cellText(value) === '';
}

/** Vorm voor het vergelijken van keuzes: kleine letters, zonder punt aan het eind. */
function keyword(value: CellValue): string {
  return cellText(value).toLocaleLowerCase('nl').replace(/\.$/, '');
}

export function excelSerialToIsoDate(serial: number): IsoDate | null {
  if (!Number.isFinite(serial) || serial < 61 || serial > 2_958_465) return null;
  return isoDateFromUtcDate(new Date(EXCEL_EPOCH_MS + Math.floor(serial) * DAY_MS));
}

/** Een echte Excel-datum, een datumgetal, d-m-jjjj (ook met / of .) of jjjj-mm-dd. Leeg = null. */
export function parseDateCell(value: CellValue): CellResult<IsoDate | null> {
  if (value === null || value === undefined) return ok(null);
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return fail('Ongeldige datum.');
    // Een cel met alleen een tijd komt binnen als 30 december 1899.
    if (value.getUTCFullYear() < 1900) return fail('Dit is een tijd, geen datum.');
    return ok(isoDateFromUtcDate(value));
  }
  if (typeof value === 'number') {
    const date = excelSerialToIsoDate(value);
    return date ? ok(date) : fail(`"${value}" is geen datum.`);
  }
  if (typeof value === 'boolean') return fail('Verwacht een datum.');
  const text = cellText(value);
  if (text === '') return ok(null);
  const dutch = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(text);
  if (dutch) {
    const date = makeIsoDate(Number(dutch[3]), Number(dutch[2]), Number(dutch[1]));
    return date ? ok(date) : fail(`"${text}" bestaat niet als datum.`);
  }
  if (isIsoDate(text)) return ok(text);
  return fail(`"${text}" is geen datum. Gebruik d-m-jjjj, bijvoorbeeld 14-10-2026.`);
}

/** Een Excel-tijd, een fractie van een dag, of uu:mm. Leeg = null. */
export function parseTimeCell(value: CellValue): CellResult<TimeOfDay | null> {
  if (value === null || value === undefined) return ok(null);
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return fail('Ongeldige tijd.');
    const msOfDay = ((value.getTime() % DAY_MS) + DAY_MS) % DAY_MS;
    return minutesToTime(Math.round(msOfDay / 60_000));
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return fail(`"${value}" is geen tijd.`);
    return minutesToTime(Math.round((value % 1) * 24 * 60));
  }
  if (typeof value === 'boolean') return fail('Verwacht een tijd.');
  const text = cellText(value);
  if (text === '') return ok(null);
  const time = parseTime(text);
  return time ? ok(time) : fail(`"${text}" is geen tijd. Gebruik uu:mm, bijvoorbeeld 07:30.`);
}

function minutesToTime(minutes: number): CellResult<TimeOfDay> {
  if (minutes < 0 || minutes >= 24 * 60) return fail('Ongeldige tijd.');
  return ok(fromMinutes(minutes));
}

const YES = new Set(['ja', 'j', 'yes', 'y', 'true', 'waar', '1', 'x']);
const NO = new Set(['nee', 'n', 'no', 'false', 'onwaar', '0']);

/** ja/nee. Leeg = null. */
export function parseYesNo(value: CellValue): CellResult<boolean | null> {
  if (typeof value === 'boolean') return ok(value);
  const text = keyword(value);
  if (text === '') return ok(null);
  if (YES.has(text)) return ok(true);
  if (NO.has(text)) return ok(false);
  return fail(`"${cellText(value)}" is geen ja of nee.`);
}

const WEEKDAYS: Record<string, ShiftWeekday> = {
  ma: 1,
  maandag: 1,
  di: 2,
  dinsdag: 2,
  wo: 3,
  woensdag: 3,
  do: 4,
  donderdag: 4,
  vr: 5,
  vrijdag: 5,
  za: 6,
  zaterdag: 6,
};

export function parseWeekday(value: CellValue): CellResult<ShiftWeekday | null> {
  const text = keyword(value);
  if (text === '') return ok(null);
  const weekday = WEEKDAYS[text];
  if (weekday) return ok(weekday);
  if (text === 'zo' || text === 'zondag') return fail('Op zondag zijn er geen vaste diensten.');
  return fail(`"${cellText(value)}" is geen dag. Gebruik ma, di, wo, do, vr of za.`);
}

const ROLES: Record<string, Role> = {
  balie: 'counter',
  backoffice: 'backoffice',
  'back office': 'backoffice',
  'back-office': 'backoffice',
  transport: 'transport',
  'hiker/buitendienst': 'cleaning',
  'hiker / buitendienst': 'cleaning',
  hiker: 'cleaning',
  buitendienst: 'cleaning',
  // De oude namen van deze rol (besluit V11), zodat eerdere importbestanden blijven werken.
  poets: 'cleaning',
  schoonmaak: 'cleaning',
  geen: 'none',
  'geen rol': 'none',
  '-': 'none',
};

/** balie, backoffice, transport, hiker/buitendienst of geen. Leeg = null (de aanroeper bepaalt wat dat betekent). */
export function parseRole(value: CellValue): CellResult<Role | null> {
  const text = keyword(value);
  if (text === '') return ok(null);
  const role = ROLES[text];
  return role ? ok(role) : fail(`Onbekende rol "${cellText(value)}". Kies balie, backoffice, transport, hiker/buitendienst of geen.`);
}

const DAY_PARTS: Record<string, AbsencePart> = {
  'hele dag': 'full_day',
  heledag: 'full_day',
  dag: 'full_day',
  ochtend: 'morning',
  middag: 'afternoon',
};

export function parseAbsencePart(value: CellValue): CellResult<AbsencePart | null> {
  const text = keyword(value);
  if (text === '') return ok(null);
  const part = DAY_PARTS[text];
  return part ? ok(part) : fail(`Onbekend dagdeel "${cellText(value)}". Kies hele dag, ochtend of middag.`);
}

const STATUSES: Record<string, AbsenceStatus> = {
  goedgekeurd: 'approved',
  akkoord: 'approved',
  aangevraagd: 'requested',
  aanvraag: 'requested',
};

export function parseStatus(value: CellValue): CellResult<AbsenceStatus | null> {
  const text = keyword(value);
  if (text === '') return ok(null);
  const status = STATUSES[text];
  return status ? ok(status) : fail(`Onbekende status "${cellText(value)}". Kies goedgekeurd of aangevraagd.`);
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().replace(/^mailto:/i, '').toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

export function parseEmail(value: CellValue): CellResult<string | null> {
  const text = cellText(value);
  if (text === '') return ok(null);
  const email = normalizeEmail(text);
  return isValidEmail(email) ? ok(email) : fail(`"${text}" is geen geldig e-mailadres.`);
}

function groupKey(value: string): string {
  return value.toLocaleLowerCase('nl').replace(/[^a-z0-9]/g, '');
}

const GROUP_ALIASES: Record<string, string> = {
  shertogenbosch: 'den_bosch',
};

export function findGroup(value: string, groups: readonly Group[]): Group | null {
  const key = groupKey(value);
  if (key === '') return null;
  const aliased = GROUP_ALIASES[key];
  return (
    groups.find((group) => groupKey(group.name) === key || groupKey(group.id) === key || group.id === aliased) ?? null
  );
}

export function parseGroup(value: CellValue, groups: readonly Group[]): CellResult<string | null> {
  const text = cellText(value);
  if (text === '') return ok(null);
  const group = findGroup(text, groups);
  if (group) return ok(group.id);
  return fail(`Onbekende groep "${text}". Kies uit: ${groups.map((g) => g.name).join(', ')}.`);
}

/** Vestigingen, gescheiden door komma's (of puntkomma's). Leeg = geen. */
export function parseCounterGroups(value: CellValue, groups: readonly Group[]): CellResult<string[]> {
  const text = cellText(value);
  if (text === '') return ok([]);
  const ids: string[] = [];
  for (const part of text.split(/[,;]/)) {
    const name = part.trim();
    if (name === '') continue;
    const group = findGroup(name, groups);
    if (!group) return fail(`Onbekende vestiging "${name}".`);
    if (!group.hasCounter) return fail(`${group.name} heeft geen balie.`);
    if (!ids.includes(group.id)) ids.push(group.id);
  }
  return ok(ids.sort());
}
