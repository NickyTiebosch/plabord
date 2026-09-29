import { describe, expect, it } from 'vitest';
import { groups, settings } from '../engine/__fixtures__/team';
import type { Absence, RecurringShift } from '../engine/types';
import { planImport, type ApplyImportPayload, type CurrentData, type CurrentEmployee } from './plan';
import { parseWorkbook, type RawSheet } from './workbook';

const TS = '2026-01-01T00:00:00.000Z';

function employee(partial: Partial<CurrentEmployee> & Pick<CurrentEmployee, 'id' | 'name'>): CurrentEmployee {
  return {
    groupId: 'den_bosch',
    defaultRole: 'counter',
    isAdmin: false,
    isActive: true,
    email: null,
    hasAccount: false,
    counterGroupIds: [],
    ...partial,
  };
}

function shift(partial: Partial<RecurringShift> & Pick<RecurringShift, 'id' | 'employeeId' | 'weekday' | 'validFrom'>): RecurringShift {
  return { groupId: 'den_bosch', role: 'counter', startTime: null, endTime: null, validTo: null, updatedAt: TS, ...partial };
}

function baseCurrent(): CurrentData {
  return {
    settings,
    groups,
    employees: [
      employee({ id: 'e-anna', name: 'Anna', groupId: 'other', defaultRole: 'none', isAdmin: true, email: 'anna@voorbeeld.nl', hasAccount: true }),
      employee({ id: 'e-sanne', name: 'Sanne', email: 'sanne@voorbeeld.nl', hasAccount: true, counterGroupIds: ['den_bosch'] }),
      employee({ id: 'e-joris', name: 'Joris' }),
    ],
    recurringShifts: [shift({ id: 's-sanne-ma', employeeId: 'e-sanne', weekday: 1, validFrom: '2025-01-01' })],
    absences: [],
  };
}

function sheets(rows: { employees?: unknown[][]; shifts?: unknown[][]; absences?: unknown[][] }): RawSheet[] {
  const result: RawSheet[] = [];
  if (rows.employees) {
    result.push({
      sheet: 'Medewerkers',
      data: [['Naam', 'E-mail', 'Groep', 'Rol', 'Inzetbaar aan de balie in', 'Beheerder'], ...rows.employees] as RawSheet['data'],
    });
  }
  if (rows.shifts) {
    result.push({
      sheet: 'Vaste roosters',
      data: [['Naam', 'Dag', 'Groep', 'Rol', 'Begintijd', 'Eindtijd', 'Geldig vanaf'], ...rows.shifts] as RawSheet['data'],
    });
  }
  if (rows.absences) {
    result.push({ sheet: 'Afwezigheid', data: [['Naam', 'Van', 'Tot', 'Dagdeel', 'Status'], ...rows.absences] as RawSheet['data'] });
  }
  return result;
}

function plan(current: CurrentData, raw: RawSheet[], importingEmployeeId: string | null = 'e-anna') {
  return planImport(parseWorkbook(raw, current.groups), current, { importingEmployeeId });
}

/** Doet in het geheugen wat apply_import in de database doet, zodat we idempotentie kunnen testen. */
function applyInMemory(current: CurrentData, payload: ApplyImportPayload): CurrentData {
  let counter = 0;
  const nextId = (prefix: string) => `${prefix}-${++counter}`;
  const employees: CurrentEmployee[] = current.employees.map((e) => ({ ...e, counterGroupIds: [...e.counterGroupIds] }));
  let shifts = current.recurringShifts.map((s) => ({ ...s }));
  const absences: Absence[] = current.absences.map((a) => ({ ...a }));
  const ids = new Map<string, string>();

  for (const op of payload.employees) {
    const existing = op.id ? employees.find((e) => e.id === op.id) : undefined;
    const target =
      existing ??
      employee({ id: nextId('e'), name: op.name, groupId: op.group_id, defaultRole: op.default_role, isAdmin: op.is_admin });
    if (!existing) employees.push(target);
    else if (op.update) {
      Object.assign(target, { name: op.name, groupId: op.group_id, defaultRole: op.default_role, isAdmin: op.is_admin });
    }
    if (op.email && !target.email) target.email = op.email;
    if (op.counter_group_ids) target.counterGroupIds = [...op.counter_group_ids];
    ids.set(op.key, target.id);
  }
  for (const op of payload.shifts) {
    const employeeId = ids.get(op.employee_key) ?? '';
    if (op.close_shift_id) shifts = shifts.map((s) => (s.id === op.close_shift_id ? { ...s, validTo: op.close_valid_to } : s));
    if (op.id) {
      shifts = shifts.map((s) =>
        s.id === op.id
          ? { ...s, groupId: op.group_id, role: op.role, startTime: op.start_time, endTime: op.end_time, validTo: op.valid_to }
          : s,
      );
    } else {
      shifts.push(
        shift({
          id: nextId('s'),
          employeeId,
          weekday: op.weekday,
          groupId: op.group_id,
          role: op.role,
          startTime: op.start_time,
          endTime: op.end_time,
          validFrom: op.valid_from,
          validTo: op.valid_to,
        }),
      );
    }
  }
  for (const op of payload.absences) {
    const employeeId = ids.get(op.employee_key) ?? '';
    const same = absences.find(
      (a) => a.employeeId === employeeId && a.startDate === op.start_date && a.endDate === op.end_date && a.dayPart === op.day_part,
    );
    if (same) same.status = op.status;
    else {
      absences.push({
        id: nextId('a'),
        employeeId,
        startDate: op.start_date,
        endDate: op.end_date,
        dayPart: op.day_part,
        status: op.status,
        updatedAt: TS,
      });
    }
  }
  return { ...current, employees, recurringShifts: shifts, absences };
}

describe('planImport: medewerkers', () => {
  it('maakt nieuwe medewerkers aan, werkt bij en laat gelijke ongemoeid', () => {
    const result = plan(
      baseCurrent(),
      sheets({
        employees: [
          ['Sanne', 'sanne@voorbeeld.nl', 'Den Bosch', 'balie', 'Den Bosch', 'nee'],
          ['Joris', 'joris@voorbeeld.nl', 'Den Bosch', 'balie', 'Den Bosch, Breda', 'nee'],
          ['Fleur', 'fleur@voorbeeld.nl', 'Eindhoven', 'balie', 'Eindhoven', 'nee'],
          ['Gert', null, 'Logistiek', 'transport', null, null],
        ],
      }),
    );
    expect(result.errors).toEqual([]);
    expect(result.employees.map((e) => [e.name, e.action])).toEqual([
      ['Sanne', 'unchanged'],
      ['Joris', 'update'],
      ['Fleur', 'create'],
      ['Gert', 'create'],
    ]);
    expect(result.employees[1]?.changes).toEqual(['e-mailadres toegevoegd', 'inzetbaar aan de balie gewijzigd']);
    expect(result.accountsToCreate).toEqual(['Joris', 'Fleur']);
    expect(result.summary.employees).toEqual({ create: 2, update: 1, unchanged: 1 });
  });

  it('herkent een medewerker op e-mail, ook als de naam anders is geschreven', () => {
    const result = plan(baseCurrent(), sheets({ employees: [['Sanne de Vries', 'SANNE@voorbeeld.nl', 'Den Bosch', 'balie', 'Den Bosch', 'nee']] }));
    expect(result.employees[0]).toMatchObject({ id: 'e-sanne', action: 'update', changes: ['naam: Sanne → Sanne de Vries'] });
  });

  it('herkent een medewerker zonder e-mail op naam, zonder op hoofdletters en spaties te letten', () => {
    const result = plan(baseCurrent(), sheets({ employees: [['  jORIS ', null, 'Den Bosch', 'balie', null, 'nee']] }));
    expect(result.employees[0]).toMatchObject({ id: 'e-joris', action: 'update', changes: ['naam: Joris → jORIS'] });
  });

  it('weigert een ander e-mailadres bij een bestaande naam', () => {
    const result = plan(baseCurrent(), sheets({ employees: [['Sanne', 'ander@voorbeeld.nl', 'Den Bosch', null, null, null]] }));
    expect(result.errors).toEqual([
      { sheet: 'Medewerkers', row: 2, message: 'Sanne heeft al een ander e-mailadres. Wijzig het e-mailadres in de app.' },
    ]);
    expect(result.payload).toBeNull();
  });

  it('neemt de beheerder die importeert nooit de eigen rechten af', () => {
    const result = plan(baseCurrent(), sheets({ employees: [['Anna', 'anna@voorbeeld.nl', 'Overig', null, null, 'nee']] }));
    expect(result.employees[0]).toMatchObject({ isAdmin: true, action: 'unchanged' });
    expect(result.notices.map((n) => n.message)).toContain('Je eigen beheerdersrechten blijven staan.');
  });
});

describe('planImport: vaste roosters', () => {
  it('maakt nieuwe diensten aan en laat gelijke ongemoeid', () => {
    const result = plan(
      baseCurrent(),
      sheets({
        shifts: [
          ['Sanne', 'ma', null, null, null, null, '1-1-2025'],
          ['Sanne', 'di', null, null, null, null, '1-1-2025'],
        ],
      }),
    );
    expect(result.errors).toEqual([]);
    expect(result.shifts.map((s) => [s.weekday, s.action])).toEqual([
      [1, 'unchanged'],
      [2, 'create'],
    ]);
    expect(result.payload?.shifts).toHaveLength(1);
    // Sanne staat niet in het tabblad Medewerkers, maar wordt wel gekoppeld.
    expect(result.payload?.employees).toEqual([
      expect.objectContaining({ key: 'db:e-sanne', id: 'e-sanne', update: false }),
    ]);
  });

  it('beëindigt de vorige vaste dienst als er een nieuwe begint en laat het verleden staan', () => {
    const result = plan(baseCurrent(), sheets({ shifts: [['Sanne', 'ma', 'Breda', 'balie', null, null, '2-11-2026']] }));
    expect(result.shifts[0]).toMatchObject({
      action: 'create',
      groupId: 'breda',
      validFrom: '2026-11-02',
      close: { shiftId: 's-sanne-ma', validTo: '2026-11-01' },
    });
  });

  it('geeft bij meerdere regels voor dezelfde dag elke regel een einddatum tot de volgende', () => {
    const result = plan(
      baseCurrent(),
      sheets({
        shifts: [
          ['Joris', 'wo', null, null, null, null, '1-6-2026'],
          ['Joris', 'wo', null, 'transport', null, null, '1-1-2026'],
        ],
      }),
    );
    expect(result.errors).toEqual([]);
    expect(result.shifts.map((s) => [s.validFrom, s.validTo, s.role])).toEqual([
      ['2026-06-01', null, 'counter'],
      ['2026-01-01', '2026-05-31', 'transport'],
    ]);
  });

  it('weigert een dienst die zou overlappen met een latere bestaande dienst', () => {
    const current = baseCurrent();
    current.recurringShifts = [shift({ id: 's-joris-wo', employeeId: 'e-joris', weekday: 3, validFrom: '2026-09-01' })];
    const result = plan(current, sheets({ shifts: [['Joris', 'wo', null, null, null, null, '1-1-2026']] }));
    expect(result.errors.map((e) => e.message)).toEqual([
      'Joris heeft op wo al een vaste dienst vanaf 1 sep 2026. Pas die eerst aan in de app.',
    ]);
  });

  it('gebruikt de groep en standaardrol van de medewerker bij lege cellen', () => {
    const result = plan(
      baseCurrent(),
      sheets({
        employees: [['Gert', null, 'Logistiek', 'transport', null, null]],
        shifts: [['Gert', 'vr', null, null, null, null, '1-1-2026']],
      }),
    );
    expect(result.shifts[0]).toMatchObject({ groupId: 'logistics', role: 'transport', employeeKey: 'new:2' });
  });

  it('meldt onbekende namen en eindtijden vóór de standaardbegintijd', () => {
    const result = plan(
      baseCurrent(),
      sheets({
        shifts: [
          ['Sane', 'ma', null, null, null, null, '1-1-2026'],
          ['Joris', 'ma', null, null, null, '07:00', '1-1-2026'],
        ],
      }),
    );
    expect(result.errors.map((e) => `${e.row}: ${e.message}`)).toEqual([
      '2: Onbekende naam "Sane". Staat die in het tabblad Medewerkers?',
      '3: Eindtijd moet na de begintijd liggen (let op de standaardtijden bij een lege cel).',
    ]);
  });
});

describe('planImport: afwezigheid', () => {
  it('maakt nieuwe afwezigheid aan en past alleen de status aan als die verandert', () => {
    const current = baseCurrent();
    current.absences = [
      { id: 'a1', employeeId: 'e-sanne', startDate: '2026-10-14', endDate: '2026-10-16', dayPart: 'full_day', status: 'requested', updatedAt: TS },
    ];
    const result = plan(
      current,
      sheets({
        absences: [
          ['Sanne', '14-10-2026', '16-10-2026', 'hele dag', 'goedgekeurd'],
          ['Joris', '20-10-2026', null, 'ochtend', 'aangevraagd'],
        ],
      }),
    );
    expect(result.absences.map((a) => [a.employeeName, a.action, a.changes])).toEqual([
      ['Sanne', 'update', ['status: aangevraagd → goedgekeurd']],
      ['Joris', 'create', []],
    ]);
  });
});

describe('opnieuw importeren', () => {
  it('maakt geen dubbelingen: de tweede keer is alles ongewijzigd', () => {
    const raw = sheets({
      employees: [
        ['Sanne', 'sanne@voorbeeld.nl', 'Den Bosch', 'balie', 'Den Bosch', 'nee'],
        ['Fleur', 'fleur@voorbeeld.nl', 'Eindhoven', 'balie', 'Eindhoven, Den Bosch', 'nee'],
        ['Gert', null, 'Logistiek', 'transport', null, null],
      ],
      shifts: [
        ['Fleur', 'ma', null, null, null, null, '1-1-2026'],
        ['Fleur', 'ma', 'Den Bosch', null, '09:00', null, '1-6-2026'],
        ['Sanne', 'ma', 'Breda', null, null, null, '2-11-2026'],
        ['Gert', 'za', null, null, '08:00', '12:00', '1-1-2026'],
      ],
      absences: [
        ['Fleur', '14-10-2026', '16-10-2026', null, 'aangevraagd'],
        ['Gert', '20-10-2026', null, 'middag', null],
      ],
    });
    const first = plan(baseCurrent(), raw);
    expect(first.errors).toEqual([]);
    expect(first.hasChanges).toBe(true);
    const afterFirst = applyInMemory(baseCurrent(), first.payload as ApplyImportPayload);

    const second = plan(afterFirst, raw);
    expect(second.errors).toEqual([]);
    expect(second.summary).toEqual({
      employees: { create: 0, update: 0, unchanged: 3 },
      shifts: { create: 0, update: 0, unchanged: 4 },
      absences: { create: 0, update: 0, unchanged: 2 },
    });
    expect(second.payload).toEqual({ employees: [], shifts: [], absences: [] });
    expect(afterFirst.employees).toHaveLength(5);
    expect(afterFirst.absences).toHaveLength(2);
  });
});
