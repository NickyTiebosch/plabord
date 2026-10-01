import { describe, expect, it } from 'vitest';
import { shift } from '../engine/__fixtures__/team';
import { describeAudit, type AuditRow } from './audit';
import { closureScope, holidayOverrides, holidaySummary } from './closures';
import { dbErrorMessage } from './errors';
import { isUuid, parseAbsenceForm, parseEmployeeForm, parseNumberFields, parseSettingsForm, parseShiftForm } from './forms';
import { planShiftEnd, planShiftFrom, shiftsByWeekday } from './shifts';

function form(values: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

const EMPLOYEE_ID = '10000000-0000-4000-8000-000000000002';

describe('formulier afwezigheid', () => {
  it('neemt "tot" gelijk aan "van" als die leeg is en vult standaardwaarden in', () => {
    const result = parseAbsenceForm(form({ employeeId: EMPLOYEE_ID, startDate: '2026-10-14' }));
    expect(result).toEqual({
      ok: true,
      data: { employeeId: EMPLOYEE_ID, startDate: '2026-10-14', endDate: '2026-10-14', dayPart: 'full_day', status: 'approved' },
    });
  });

  it('weigert een halve dag over meerdere dagen en "tot" vóór "van"', () => {
    const halfDay = parseAbsenceForm(
      form({ employeeId: EMPLOYEE_ID, startDate: '2026-10-14', endDate: '2026-10-15', dayPart: 'morning' }),
    );
    expect(halfDay).toMatchObject({ ok: false, state: { fieldErrors: { dayPart: 'Een halve dag kan alleen bij één dag.' } } });
    const reversed = parseAbsenceForm(form({ employeeId: EMPLOYEE_ID, startDate: '2026-10-14', endDate: '2026-10-13' }));
    expect(reversed).toMatchObject({ ok: false, state: { fieldErrors: { endDate: '"Tot" mag niet vóór "van" liggen.' } } });
    const noEmployee = parseAbsenceForm(form({ employeeId: '', startDate: '2026-02-30' }));
    expect(noEmployee).toMatchObject({ ok: false, state: { fieldErrors: { employeeId: 'Kies een medewerker.' } } });
  });

  it('accepteert een medewerker-id zonder uuid-versienummer, zoals Postgres', () => {
    const result = parseAbsenceForm(form({ employeeId: '10000000-0000-0000-0000-000000000004', startDate: '2026-10-14' }));
    expect(result.ok).toBe(true);
  });
});

describe('id uit een formulier of URL', () => {
  it('accepteert elke uuid die Postgres accepteert', () => {
    expect(isUuid('10000000-0000-0000-0000-000000000004')).toBe(true);
    expect(isUuid('0DFAB63A-C266-48A9-A2B2-56F24E6B471C')).toBe(true);
  });

  it('weigert al het andere, ook 36 streepjes', () => {
    expect(isUuid('onzin')).toBe(false);
    expect(isUuid('-'.repeat(36))).toBe(false);
    expect(isUuid('10000000-0000-0000-0000-00000000000g')).toBe(false);
    expect(isUuid(' 10000000-0000-0000-0000-000000000004')).toBe(false);
    expect(isUuid(undefined)).toBe(false);
  });
});

describe('formulier medewerker', () => {
  it('schoont naam en e-mail op', () => {
    const result = parseEmployeeForm(
      form({
        name: '  Sanne   de Vries ',
        email: ' Sanne@Voorbeeld.NL ',
        groupId: 'den_bosch',
        defaultRole: 'counter',
        counterGroupIds: ['den_bosch', 'breda'],
        isAdmin: 'on',
      }),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        name: 'Sanne de Vries',
        email: 'sanne@voorbeeld.nl',
        groupId: 'den_bosch',
        defaultRole: 'counter',
        counterGroupIds: ['den_bosch', 'breda'],
        isAdmin: true,
        isActive: true,
      },
    });
  });

  it('staat een lege e-mail toe en weigert een ongeldige', () => {
    expect(parseEmployeeForm(form({ name: 'Gert', email: '', groupId: 'logistics' }))).toMatchObject({
      ok: true,
      data: { email: null, defaultRole: 'none' },
    });
    expect(parseEmployeeForm(form({ name: 'Gert', email: 'gert@', groupId: 'logistics' }))).toMatchObject({
      ok: false,
      state: { fieldErrors: { email: 'Vul een geldig e-mailadres in.' } },
    });
  });

  it('leest "actief" alleen als het veld op het formulier staat', () => {
    const inactive = parseEmployeeForm(form({ name: 'Gert', groupId: 'logistics', isActivePresent: '1' }));
    expect(inactive).toMatchObject({ ok: true, data: { isActive: false } });
  });
});

describe('formulier vaste dienst en instellingen', () => {
  it('leest tijden en weigert een eindtijd vóór de begintijd', () => {
    expect(
      parseShiftForm(form({ weekday: '2', groupId: 'breda', role: 'counter', startTime: '9:00', endTime: '', validFrom: '2026-11-02' })),
    ).toEqual({
      ok: true,
      data: { weekday: 2, groupId: 'breda', role: 'counter', startTime: '09:00', endTime: null, validFrom: '2026-11-02' },
    });
    expect(
      parseShiftForm(form({ weekday: '2', groupId: 'breda', role: 'counter', startTime: '18:00', endTime: '07:30', validFrom: '2026-11-02' })),
    ).toMatchObject({ ok: false, state: { fieldErrors: { endTime: 'De eindtijd moet na de begintijd liggen.' } } });
    expect(parseShiftForm(form({ weekday: '7', groupId: 'breda', role: 'counter', validFrom: '2026-11-02' }))).toMatchObject({
      ok: false,
    });
  });

  it('controleert de instellingen', () => {
    const good = parseSettingsForm(
      form({
        standardStart: '07:30',
        standardEnd: '18:00',
        saturdayStart: '08:00',
        saturdayEnd: '12:00',
        dayPartBoundary: '13:00',
        lookaheadWeeks: '8',
      }),
    );
    expect(good).toMatchObject({ ok: true, data: { lookaheadWeeks: 8, saturdayStart: '08:00' } });
    const bad = parseSettingsForm(
      form({
        standardStart: '18:00',
        standardEnd: '07:30',
        saturdayStart: '08:00',
        saturdayEnd: '12:00',
        dayPartBoundary: '13:00',
        lookaheadWeeks: '0',
      }),
    );
    expect(bad).toMatchObject({
      ok: false,
      state: { fieldErrors: { standardEnd: 'Het einde moet na het begin liggen.', lookaheadWeeks: 'Minimaal 1 week.' } },
    });
  });

  it('leest normen als hele getallen', () => {
    expect(parseNumberFields(form({ 'norm:breda:1:morning': '2', other: 'x' }), 'norm', 0, 50)).toEqual({
      ok: true,
      values: new Map([['breda:1:morning', 2]]),
    });
    expect(parseNumberFields(form({ 'norm:breda:1:morning': '1.5' }), 'norm', 0, 50).ok).toBe(false);
  });
});

describe('foutmeldingen', () => {
  it('vertaalt bekende databasefouten', () => {
    expect(dbErrorMessage({ code: '23505', message: 'duplicate key value violates unique constraint "employees_name_key"' })).toBe(
      'Er is al een medewerker met deze naam. Namen moeten uniek zijn.',
    );
    expect(dbErrorMessage({ code: 'P0001', message: 'Er moet minstens één actieve beheerder blijven.' })).toBe(
      'Er moet minstens één actieve beheerder blijven.',
    );
    expect(dbErrorMessage({ code: 'XX000', message: 'boom' })).toBe('Opslaan is mislukt. Probeer het opnieuw.');
  });
});

describe('vaste diensten wijzigen', () => {
  const current = [
    shift('sanne', 1, 'den_bosch', 'counter', { validFrom: '2025-01-01' }),
    shift('sanne', 2, 'den_bosch', 'counter', { validFrom: '2025-01-01', validTo: '2026-06-30' }),
    shift('sanne', 2, 'breda', 'counter', { validFrom: '2026-07-01' }),
  ];
  const input = { weekday: 1 as const, groupId: 'breda', role: 'counter' as const, startTime: null, endTime: null };

  it('beëindigt de lopende dienst de dag ervoor en voegt de nieuwe toe', () => {
    expect(planShiftFrom(current, { ...input, validFrom: '2026-11-02' })).toEqual({
      ok: true,
      ops: [
        { type: 'close', id: 'sanne-1-2025-01-01', validTo: '2026-11-01' },
        { type: 'insert', values: { ...input, validFrom: '2026-11-02', validTo: null } },
      ],
    });
  });

  it('past de dienst aan als die op precies die datum begint', () => {
    expect(planShiftFrom(current, { ...input, validFrom: '2025-01-01' })).toEqual({
      ok: true,
      ops: [{ type: 'update', id: 'sanne-1-2025-01-01', values: { groupId: 'breda', role: 'counter', startTime: null, endTime: null } }],
    });
  });

  it('laat een nieuwe dienst stoppen vóór een latere dienst', () => {
    expect(planShiftFrom(current, { ...input, weekday: 2, validFrom: '2026-03-02' })).toEqual({
      ok: true,
      ops: [
        { type: 'close', id: 'sanne-2-2025-01-01', validTo: '2026-03-01' },
        { type: 'insert', values: { ...input, weekday: 2, validFrom: '2026-03-02', validTo: '2026-06-30' } },
      ],
    });
  });

  it('beëindigt een dienst, maar niet als er al een latere is', () => {
    expect(planShiftEnd(current, 1, '2026-12-31')).toEqual({
      ok: true,
      ops: [{ type: 'close', id: 'sanne-1-2025-01-01', validTo: '2026-12-31' }],
    });
    expect(planShiftEnd(current, 2, '2026-03-31')).toMatchObject({ ok: false });
    expect(planShiftEnd(current, 3, '2026-03-31')).toEqual({
      ok: false,
      error: 'Op die datum is er geen vaste dienst op deze dag.',
    });
  });

  it('toont per weekdag wat nu geldt, wat komt en wat voorbij is', () => {
    const overview = shiftsByWeekday(current, '2026-03-02');
    expect(overview[1]?.current?.id).toBe('sanne-2-2025-01-01');
    expect(overview[1]?.upcoming.map((s) => s.id)).toEqual(['sanne-2-2026-07-01']);
    expect(overview[2]?.current).toBeNull();
  });
});

describe('feestdagen aanpassen', () => {
  const all = ['den_bosch', 'breda', 'logistics'];
  it('slaat alleen de open groepen op', () => {
    expect(holidayOverrides('2026-05-25', all, all)).toEqual([]);
    expect(holidayOverrides('2026-05-25', all, ['den_bosch', 'breda'])).toEqual([
      { date: '2026-05-25', groupId: 'logistics', isClosed: false, label: null },
    ]);
    expect(holidayOverrides('2026-05-25', all, [])).toEqual([{ date: '2026-05-25', groupId: null, isClosed: false, label: null }]);
  });

  it('vat samen voor wie het geldt', () => {
    const names = new Map([['logistics', 'Logistiek'], ['breda', 'Breda']]);
    expect(holidaySummary({ breda: true, logistics: false }, names)).toBe('Open: Logistiek');
    expect(holidaySummary({ breda: true, logistics: true }, names)).toBe('Dicht voor iedereen');
    expect(closureScope({ id: 'x', date: '2026-06-12', groupId: null, isClosed: true, label: null }, names)).toBe('Alle groepen');
  });
});

describe('logboek', () => {
  const lookups = {
    employeeName: (id: string | null | undefined) => (id === 'e1' ? 'Sanne' : id === 'e0' ? 'Anna' : 'onbekend'),
    groupName: (id: string | null | undefined) => (id === 'breda' ? 'Breda' : String(id)),
  };
  const base: AuditRow = {
    id: 1,
    occurred_at: '2026-10-14T11:05:00.000Z',
    actor_user_id: 'u0',
    actor_employee_id: 'e0',
    action: 'insert',
    entity: 'absences',
    entity_id: 'a1',
    employee_id: 'e1',
    changed_fields: null,
    details: { start_date: '2026-10-14', end_date: '2026-10-16', day_part: 'full_day', status: 'requested' },
    source: null,
  };

  it('beschrijft een nieuwe afwezigheid in gewone taal, in Nederlandse tijd', () => {
    expect(describeAudit(base, lookups)).toEqual({
      id: 1,
      when: 'wo 14 okt 2026 13:05',
      who: 'Anna',
      what: 'Afwezigheid ingevoerd – Sanne',
      detail: '14–16 okt, hele dag, aangevraagd',
      source: null,
    });
  });

  it('beschrijft een wijziging met oude en nieuwe waarde', () => {
    const view = describeAudit(
      {
        ...base,
        action: 'update',
        changed_fields: ['group_id', 'valid_to'],
        entity: 'recurring_shifts',
        details: { group_id: { old: 'den_bosch', new: 'breda' }, valid_to: { old: null, new: '2026-11-01' } },
      },
      lookups,
    );
    expect(view.detail).toBe('groep: den_bosch → Breda; geldig tot: onbepaald → 1 nov 2026');
  });

  it('toont het e-mailadres nooit, alleen dat het veranderde', () => {
    const view = describeAudit(
      { ...base, entity: 'employee_accounts', action: 'update', changed_fields: ['email'], details: null, actor_employee_id: null },
      lookups,
    );
    expect(view).toMatchObject({ what: 'E-mailadres gewijzigd – Sanne', who: 'Systeem' });
  });
});
