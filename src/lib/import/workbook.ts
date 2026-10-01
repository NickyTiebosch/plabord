/**
 * Leest de drie tabbladen van het importbestand in en controleert elke regel.
 * Andere tabbladen en kolommen met "(info)" in de kop worden overgeslagen.
 */
import { normalizeName } from '../engine/sort';
import type { AbsencePart, AbsenceStatus, Group, IsoDate, Role, ShiftWeekday, TimeOfDay } from '../engine/types';
import {
  cellText,
  isEmptyCell,
  parseAbsencePart,
  parseCounterGroups,
  parseDateCell,
  parseEmail,
  parseGroup,
  parseRole,
  parseStatus,
  parseTimeCell,
  parseWeekday,
  parseYesNo,
  type CellResult,
  type CellValue,
} from './cells';
import {
  ABSENCE_COLUMNS,
  EMPLOYEE_COLUMNS,
  MAX_ROWS_PER_SHEET,
  SHEET_NAMES,
  SHIFT_COLUMNS,
  type ColumnSpec,
  type SheetKey,
} from './columns';

export interface RawSheet {
  sheet: string;
  data: readonly (readonly CellValue[])[];
}

export interface ImportIssue {
  /** Naam van het tabblad, of null voor het hele bestand. */
  sheet: string | null;
  /** Regelnummer zoals in Excel, of null. */
  row: number | null;
  message: string;
}

export interface EmployeeRow {
  row: number;
  name: string;
  email: string | null;
  groupId: string;
  /** Leeg = geen rol. `undefined` als de kolom ontbreekt (dan blijft de huidige waarde staan). */
  role: Role | undefined;
  counterGroupIds: string[] | undefined;
  isAdmin: boolean | undefined;
}

export interface ShiftRow {
  row: number;
  name: string;
  weekday: ShiftWeekday;
  /** Leeg = groep of standaardrol van de medewerker. */
  groupId: string | null;
  role: Role | null;
  startTime: TimeOfDay | null;
  endTime: TimeOfDay | null;
  validFrom: IsoDate;
}

export interface AbsenceRow {
  row: number;
  name: string;
  startDate: IsoDate;
  endDate: IsoDate;
  dayPart: AbsencePart;
  status: AbsenceStatus;
}

export interface ParsedWorkbook {
  employees: EmployeeRow[];
  shifts: ShiftRow[];
  absences: AbsenceRow[];
  errors: ImportIssue[];
  notices: ImportIssue[];
  sheetsFound: Record<SheetKey, boolean>;
}

const HEADER_SEARCH_ROWS = 10;

function headerKey(value: string): string {
  return value
    .toLocaleLowerCase('nl')
    .replace(/\(.*?\)/g, '')
    .replace(/[\s_–-]+/g, ' ')
    .trim();
}

function isInfoHeader(value: string): boolean {
  return /\(\s*info\s*\)/i.test(value);
}

interface SheetLayout<K extends string> {
  headerRowIndex: number;
  columns: Partial<Record<K, number>>;
}

function locateColumns<K extends string>(
  sheetName: string,
  data: RawSheet['data'],
  specs: readonly ColumnSpec<K>[],
  issues: { errors: ImportIssue[]; notices: ImportIssue[] },
): SheetLayout<K> | null {
  const nameKey = headerKey(specs[0]?.header ?? 'Naam');
  const headerRowIndex = data
    .slice(0, HEADER_SEARCH_ROWS)
    .findIndex((row) => row.some((cell) => headerKey(cellText(cell)) === nameKey));
  if (headerRowIndex === -1) {
    issues.errors.push({ sheet: sheetName, row: null, message: 'Geen kopregel met de kolom "Naam" gevonden.' });
    return null;
  }
  const headerRow = data[headerRowIndex] ?? [];
  const columns: Partial<Record<K, number>> = {};
  headerRow.forEach((cell, index) => {
    const text = cellText(cell);
    if (text === '' || isInfoHeader(text)) return;
    const key = headerKey(text);
    const spec = specs.find(
      (candidate) => headerKey(candidate.header) === key || candidate.aliases?.some((alias) => headerKey(alias) === key),
    );
    if (!spec) {
      issues.notices.push({ sheet: sheetName, row: headerRowIndex + 1, message: `Kolom "${text}" wordt overgeslagen.` });
      return;
    }
    if (columns[spec.key] === undefined) columns[spec.key] = index;
  });
  const missing = specs.filter((spec) => spec.required && columns[spec.key] === undefined);
  if (missing.length > 0) {
    issues.errors.push({
      sheet: sheetName,
      row: headerRowIndex + 1,
      message: `Kolom ontbreekt: ${missing.map((spec) => `"${spec.header}"`).join(', ')}.`,
    });
    return null;
  }
  return { headerRowIndex, columns };
}

interface RowReader<K extends string> {
  row: number;
  has(key: K): boolean;
  cell(key: K): CellValue;
  /** Leest een cel; een fout komt in `errors` met de kolomnaam erbij. */
  read<T>(key: K, parse: (value: CellValue) => CellResult<T>): T | undefined;
  errors: string[];
}

function* readRows<K extends string>(
  data: RawSheet['data'],
  layout: SheetLayout<K>,
  specs: readonly ColumnSpec<K>[],
): Generator<RowReader<K>> {
  for (let index = layout.headerRowIndex + 1; index < data.length; index++) {
    const cells = data[index] ?? [];
    const used = Object.values<number | undefined>(layout.columns).filter((i): i is number => i !== undefined);
    if (used.every((i) => isEmptyCell(cells[i]))) continue;
    const errors: string[] = [];
    const reader: RowReader<K> = {
      row: index + 1,
      errors,
      has: (key) => layout.columns[key] !== undefined,
      cell: (key) => {
        const column = layout.columns[key];
        return column === undefined ? undefined : cells[column];
      },
      read: (key, parse) => {
        const result = parse(reader.cell(key));
        if (result.ok) return result.value;
        const header = specs.find((spec) => spec.key === key)?.header ?? key;
        errors.push(`${header}: ${result.error}`);
        return undefined;
      },
    };
    yield reader;
  }
}

function findSheet(sheets: readonly RawSheet[], name: string): RawSheet | undefined {
  const wanted = headerKey(name);
  return sheets.find((sheet) => headerKey(sheet.sheet) === wanted);
}

function requireName(reader: RowReader<string>): string | null {
  const name = cellText(reader.cell('name'));
  if (name === '') {
    reader.errors.push('Naam: vul een naam in.');
    return null;
  }
  if (name.length > 80) {
    reader.errors.push('Naam: maximaal 80 tekens.');
    return null;
  }
  return name;
}

/** Leest alle drie de tabbladen in. Fouten per regel komen in `errors`. */
export function parseWorkbook(sheets: readonly RawSheet[], groups: readonly Group[]): ParsedWorkbook {
  const result: ParsedWorkbook = {
    employees: [],
    shifts: [],
    absences: [],
    errors: [],
    notices: [],
    sheetsFound: { employees: false, shifts: false, absences: false },
  };
  const issues = { errors: result.errors, notices: result.notices };
  const addRowErrors = (sheet: string, reader: RowReader<string>) => {
    for (const message of reader.errors) result.errors.push({ sheet, row: reader.row, message });
  };

  const known = new Set(Object.values(SHEET_NAMES).map(headerKey));
  for (const sheet of sheets) {
    if (!known.has(headerKey(sheet.sheet))) {
      result.notices.push({ sheet: sheet.sheet, row: null, message: 'Tabblad wordt overgeslagen.' });
    }
  }

  function prepare<K extends string>(key: SheetKey, specs: readonly ColumnSpec<K>[]) {
    const name = SHEET_NAMES[key];
    const sheet = findSheet(sheets, name);
    if (!sheet) {
      result.notices.push({ sheet: name, row: null, message: 'Tabblad ontbreekt; daaruit wordt niets geïmporteerd.' });
      return null;
    }
    result.sheetsFound[key] = true;
    if (sheet.data.length > MAX_ROWS_PER_SHEET + HEADER_SEARCH_ROWS) {
      result.errors.push({ sheet: name, row: null, message: `Te veel regels (maximaal ${MAX_ROWS_PER_SHEET}).` });
      return null;
    }
    const layout = locateColumns(name, sheet.data, specs, issues);
    return layout ? { name, sheet, layout } : null;
  }

  // Medewerkers
  const employeesSheet = prepare('employees', EMPLOYEE_COLUMNS);
  if (employeesSheet) {
    const seenEmail = new Map<string, number>();
    const seenName = new Map<string, number>();
    for (const reader of readRows(employeesSheet.sheet.data, employeesSheet.layout, EMPLOYEE_COLUMNS)) {
      const name = requireName(reader);
      const email = reader.read('email', parseEmail) ?? null;
      const groupId = reader.read('group', (value) => parseGroup(value, groups));
      if (groupId === null) reader.errors.push('Groep: vul een groep in.');
      const role = reader.has('role') ? (reader.read('role', parseRole) ?? 'none') : undefined;
      const counterGroupIds = reader.has('counterGroups')
        ? reader.read('counterGroups', (value) => parseCounterGroups(value, groups))
        : undefined;
      const isAdmin = reader.has('admin') ? (reader.read('admin', parseYesNo) ?? false) : undefined;

      if (name) {
        const key = normalizeName(name);
        const earlier = seenName.get(key);
        if (earlier) reader.errors.push(`Naam: staat ook op regel ${earlier}.`);
        else seenName.set(key, reader.row);
      }
      if (email) {
        const earlier = seenEmail.get(email);
        if (earlier) reader.errors.push(`E-mail: staat ook op regel ${earlier}.`);
        else seenEmail.set(email, reader.row);
      }

      if (reader.errors.length > 0 || !name || !groupId) {
        addRowErrors(employeesSheet.name, reader);
        continue;
      }
      result.employees.push({ row: reader.row, name, email, groupId, role, counterGroupIds, isAdmin });
    }
  }

  // Vaste roosters
  const shiftsSheet = prepare('shifts', SHIFT_COLUMNS);
  if (shiftsSheet) {
    const seen = new Map<string, number>();
    for (const reader of readRows(shiftsSheet.sheet.data, shiftsSheet.layout, SHIFT_COLUMNS)) {
      const name = requireName(reader);
      const weekday = reader.read('day', parseWeekday);
      if (weekday === null) reader.errors.push('Dag: vul een dag in.');
      const groupId = reader.read('group', (value) => parseGroup(value, groups)) ?? null;
      const role = reader.read('role', parseRole) ?? null;
      const startTime = reader.read('start', parseTimeCell) ?? null;
      const endTime = reader.read('end', parseTimeCell) ?? null;
      const validFrom = reader.read('validFrom', parseDateCell);
      if (validFrom === null) reader.errors.push('Geldig vanaf: vul een datum in.');
      if (startTime && endTime && endTime <= startTime) reader.errors.push('Eindtijd: moet na de begintijd liggen.');
      if (validFrom && (validFrom < '2000-01-01' || validFrom > '2100-12-31')) {
        reader.errors.push('Geldig vanaf: datum ligt buiten 2000–2100.');
      }

      if (name && weekday && validFrom) {
        const key = `${normalizeName(name)}|${weekday}|${validFrom}`;
        const earlier = seen.get(key);
        if (earlier) reader.errors.push(`Deze vaste dienst staat ook op regel ${earlier}.`);
        else seen.set(key, reader.row);
      }

      if (reader.errors.length > 0 || !name || !weekday || !validFrom) {
        addRowErrors(shiftsSheet.name, reader);
        continue;
      }
      result.shifts.push({ row: reader.row, name, weekday, groupId, role, startTime, endTime, validFrom });
    }
  }

  // Afwezigheid
  const absencesSheet = prepare('absences', ABSENCE_COLUMNS);
  if (absencesSheet) {
    const seen = new Map<string, number>();
    for (const reader of readRows(absencesSheet.sheet.data, absencesSheet.layout, ABSENCE_COLUMNS)) {
      const name = requireName(reader);
      const startDate = reader.read('from', parseDateCell);
      if (startDate === null) reader.errors.push('Van: vul een datum in.');
      const endDate = reader.read('to', parseDateCell) ?? startDate ?? null;
      const dayPart: AbsencePart = reader.read('dayPart', parseAbsencePart) ?? 'full_day';
      const status: AbsenceStatus = reader.read('status', parseStatus) ?? 'approved';
      if (startDate && endDate) {
        if (endDate < startDate) reader.errors.push('Tot: ligt vóór Van.');
        else if (dayPart !== 'full_day' && startDate !== endDate) {
          reader.errors.push('Dagdeel: een halve dag kan alleen bij één dag (Van en Tot gelijk).');
        }
        if (startDate < '2000-01-01' || endDate > '2100-12-31') reader.errors.push('Van/Tot: datum ligt buiten 2000–2100.');
      }

      if (name && startDate && endDate) {
        const key = `${normalizeName(name)}|${startDate}|${endDate}|${dayPart}`;
        const earlier = seen.get(key);
        if (earlier) reader.errors.push(`Deze afwezigheid staat ook op regel ${earlier}.`);
        else seen.set(key, reader.row);
      }

      if (reader.errors.length > 0 || !name || !startDate || !endDate) {
        addRowErrors(absencesSheet.name, reader);
        continue;
      }
      result.absences.push({ row: reader.row, name, startDate, endDate, dayPart, status });
    }
  }

  return result;
}
