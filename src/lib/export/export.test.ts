import readExcelFile from 'read-excel-file/node';
import { describe, expect, it } from 'vitest';
import { absence, employees, groups, override, recurringShifts, shift, substitution } from '../engine/__fixtures__/team';
import { parseWorkbook } from '../import/workbook';
import { ABSENCE_COLUMNS, EMPLOYEE_COLUMNS, SHEET_NAMES, SHIFT_COLUMNS } from '../import/columns';
import type { CellValue } from '../import/cells';
import { employeeExport } from './employee';
import { formatExportDate, planningExport, type ExportEmployee, type PlanningData } from './planning';
import { buildExportWorkbook } from './xlsx';

const TODAY = '2026-10-14';

const withEmail: ExportEmployee[] = employees.map((employee) => ({
  ...employee,
  email: employee.id === 'gert' ? null : `${employee.id}@voorbeeld.nl`,
}));

function data(extra: Partial<PlanningData> = {}): PlanningData {
  return {
    employees: withEmail,
    groups,
    recurringShifts,
    absences: [],
    substitutions: [],
    shiftOverrides: [],
    ...extra,
  };
}

describe('export van de planning (V20)', () => {
  it('heeft de tabbladen en koppen van de import, plus invallen en roosterwijzigingen', () => {
    const sheets = planningExport(data(), TODAY);
    expect(sheets.map((sheet) => sheet.sheet)).toEqual([
      SHEET_NAMES.employees,
      SHEET_NAMES.shifts,
      SHEET_NAMES.absences,
      'Invallen',
      'Roosterwijzigingen',
    ]);
    expect(sheets[0]?.header).toEqual([...EMPLOYEE_COLUMNS.map((column) => column.header), 'Actief (info)']);
    expect(sheets[1]?.header).toEqual([...SHIFT_COLUMNS.map((column) => column.header), 'Geldig tot (info)']);
    expect(sheets[2]?.header).toEqual(ABSENCE_COLUMNS.map((column) => column.header));
  });

  it('zet medewerkers per groep en op naam, met werkmail, rol en inzetbaarheid', () => {
    const rows = planningExport(data(), TODAY)[0]?.rows ?? [];
    expect(rows[0]).toEqual(['Bram', 'bram@voorbeeld.nl', 'Den Bosch', 'balie', 'Den Bosch, Breda', 'nee', 'ja']);
    expect(rows.find((row) => row[0] === 'Ingrid')).toEqual(['Ingrid', 'ingrid@voorbeeld.nl', 'Den Bosch', 'hiker/buitendienst', '', 'nee', 'ja']);
    expect(rows.find((row) => row[0] === 'Gert')?.[1]).toBe('');
    expect(rows.find((row) => row[0] === 'Petra')?.[3]).toBe('');
  });

  it('neemt alleen vaste diensten mee die nu gelden of nog komen', () => {
    const sheets = planningExport(
      data({
        recurringShifts: [
          shift('sanne', 1, 'den_bosch', 'counter', { validFrom: '2025-01-01', validTo: '2026-06-30' }),
          shift('sanne', 1, 'breda', 'counter', { validFrom: '2026-07-01', startTime: '09:00', endTime: '17:00' }),
          shift('sanne', 2, 'den_bosch', 'counter', { validFrom: '2026-11-02' }),
        ],
      }),
      TODAY,
    );
    expect(sheets[1]?.rows).toEqual([
      ['Sanne', 'ma', 'Breda', 'balie', '09:00', '17:00', '1-7-2026', ''],
      ['Sanne', 'di', 'Den Bosch', 'balie', '', '', '2-11-2026', ''],
    ]);
  });

  it('zet afwezigheid, invallen en roosterwijzigingen op datum', () => {
    const sheets = planningExport(
      data({
        absences: [
          absence('a2', 'joris', '2026-10-20', '2026-10-21', { status: 'requested' }),
          absence('a1', 'sanne', '2026-10-14', '2026-10-14', { dayPart: 'morning' }),
        ],
        substitutions: [substitution('s1', 'danique', '2026-10-14', 'eindhoven', ['afternoon'], { status: 'not_needed' })],
        shiftOverrides: [
          override('o1', 'sanne', '2026-10-16', { kind: 'off' }),
          override('o2', 'joris', '2026-10-15', { kind: 'shift', groupId: 'breda', role: 'counter', startTime: '09:00' }),
        ],
      }),
      TODAY,
    );
    expect(sheets[2]?.rows).toEqual([
      ['Sanne', '14-10-2026', '14-10-2026', 'ochtend', 'goedgekeurd'],
      ['Joris', '20-10-2026', '21-10-2026', 'hele dag', 'aangevraagd'],
    ]);
    expect(sheets[3]?.rows).toEqual([['Danique', '14-10-2026', 'Eindhoven', 'middag', 'niet meer nodig']]);
    expect(sheets[4]?.rows).toEqual([
      ['Joris', '15-10-2026', 'andere dienst', 'Breda', 'balie', '09:00', ''],
      ['Sanne', '16-10-2026', 'geen dienst', '', '', '', ''],
    ]);
  });

  it('kan als bestand weer door de import worden gelezen', async () => {
    const sheets = planningExport(data({ absences: [absence('a1', 'sanne', '2026-10-14')] }), TODAY);
    const file = await buildExportWorkbook(sheets);
    const read = await readExcelFile(file);
    const parsed = parseWorkbook(
      read.map((sheet) => ({ sheet: sheet.sheet, data: sheet.data as unknown as CellValue[][] })),
      groups,
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.employees).toHaveLength(employees.length);
    expect(parsed.absences).toHaveLength(1);
  });

  it('schrijft datums zoals de import ze leest', () => {
    expect(formatExportDate('2026-01-05')).toBe('5-1-2026');
  });
});

describe('gegevens van één medewerker (V20)', () => {
  const sanne = withEmail.find((employee) => employee.id === 'sanne') as ExportEmployee;
  const sheets = employeeExport({
    employee: sanne,
    hasAccount: true,
    lastSignInAt: '2026-10-06T12:05:00Z',
    groups,
    recurringShifts: [
      shift('sanne', 1, 'den_bosch', 'counter', { validFrom: '2025-01-01', validTo: '2026-06-30' }),
      shift('sanne', 1, 'breda', 'counter', { validFrom: '2026-07-01' }),
    ],
    absences: [absence('a1', 'sanne', '2026-10-14')],
    substitutions: [],
    shiftOverrides: [override('o1', 'sanne', '2026-10-16', { kind: 'off' })],
    feeds: [{ kind: 'location', groupId: 'den_bosch', createdAt: '2026-10-01T08:00:00Z', revokedAt: null }],
    mails: [
      { kind: 'day_changed', dates: ['2026-10-16'], status: 'sent', lastError: null, attempts: 1, createdAt: '2026-10-02T12:00:00Z' },
    ],
    devices: [{ createdAt: '2026-10-02T13:00:00Z', lastSuccessAt: '2026-10-03T14:00:00Z' }, { createdAt: '2026-10-05T08:00:00Z', lastSuccessAt: null }],
    log: [{ when: 'do 1 okt 2026 10:00', what: 'Afwezigheid ingevoerd – Sanne', detail: '14 okt, hele dag, goedgekeurd' }],
  });

  it('bevat alles wat Planbord over die persoon bewaart, ook eerdere vaste diensten', () => {
    expect(sheets.map((sheet) => sheet.sheet)).toEqual([
      'Gegevens',
      'Vaste diensten',
      'Afwezigheid',
      'Invallen',
      'Roosterwijzigingen',
      'Agendalinks',
      'Mails',
      'Meldingen',
      'Logboek',
    ]);
    expect(sheets[0]?.rows).toEqual([
      ['Naam', 'Sanne'],
      ['Werkmail', 'sanne@voorbeeld.nl'],
      ['Groep', 'Den Bosch'],
      ['Standaardrol', 'balie'],
      ['Inzetbaar aan de balie in', 'Den Bosch, Eindhoven'],
      ['Beheerder', 'nee'],
      ['Actief', 'ja'],
      ['Inlogaccount', 'ja'],
      ['Laatst ingelogd', '6-10-2026 14:05'],
    ]);
    expect(sheets[1]?.rows).toHaveLength(2);
    expect(sheets[5]?.rows).toEqual([['Vestiging Den Bosch', '1-10-2026 10:00', '']]);
    expect(sheets[6]?.rows).toEqual([['2-10-2026 14:00', 'Rooster gewijzigd', 'vr 16 okt', 'verstuurd']]);
    // Fase 4: de toestellen met meldingen, zonder het adres of de sleutels.
    expect(sheets[7]?.rows).toEqual([
      ['Toestel 1', '2-10-2026 15:00', '3-10-2026 16:00'],
      ['Toestel 2', '5-10-2026 10:00', ''],
    ]);
    expect(sheets[8]?.rows).toEqual([['do 1 okt 2026 10:00', 'Afwezigheid ingevoerd – Sanne', '14 okt, hele dag, goedgekeurd']]);
  });

  it('noemt geen collega’s', () => {
    const text = JSON.stringify(sheets);
    for (const other of employees.filter((employee) => employee.id !== 'sanne')) expect(text).not.toContain(`"${other.name}"`);
  });
});
