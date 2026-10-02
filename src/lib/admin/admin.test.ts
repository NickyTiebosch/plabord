import { describe, expect, it } from 'vitest';
import { shift } from '../engine/__fixtures__/team';
import { describeAudit, type AuditRow } from './audit';
import { closureScope, holidayOverrides, holidaySummary } from './closures';
import { dbErrorMessage } from './errors';
import {
  isUuid,
  parseAbsenceForm,
  parseDayRef,
  parseDayShiftForm,
  parseEmployeeForm,
  parseNumberFields,
  parseSettingsForm,
  parseShiftEndForm,
  parseShiftForm,
} from './forms';
import { batchShiftOps, planShiftEnd, planShiftFrom, planShiftsEnd, planShiftsFrom, shiftsByWeekday, weekdayList } from './shifts';

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
      data: { weekdays: [2], groupId: 'breda', role: 'counter', startTime: '09:00', endTime: null, validFrom: '2026-11-02' },
    });
    expect(
      parseShiftForm(form({ weekday: '2', groupId: 'breda', role: 'counter', startTime: '18:00', endTime: '07:30', validFrom: '2026-11-02' })),
    ).toMatchObject({ ok: false, state: { fieldErrors: { endTime: 'De eindtijd moet na de begintijd liggen.' } } });
  });

  it('leest meerdere dagen tegelijk, op volgorde en elke dag één keer', () => {
    // Werkt ma, di, wo en vr: donderdag is de vaste vrije dag en wordt dus niet aangevinkt.
    const result = parseShiftForm(
      form({ weekday: ['5', '1', '3', '2', '1'], groupId: 'den_bosch', role: 'counter', validFrom: '2026-01-01' }),
    );
    expect(result).toMatchObject({ ok: true, data: { weekdays: [1, 2, 3, 5] } });
  });

  it('wil minstens één dag van ma t/m za', () => {
    expect(parseShiftForm(form({ groupId: 'breda', role: 'counter', validFrom: '2026-11-02' }))).toMatchObject({
      ok: false,
      state: { fieldErrors: { weekdays: 'Kies minstens één dag.' } },
    });
    expect(parseShiftForm(form({ weekday: ['1', '7'], groupId: 'breda', role: 'counter', validFrom: '2026-11-02' }))).toMatchObject({
      ok: false,
      state: { fieldErrors: { weekdays: 'Kies dagen van maandag t/m zaterdag.' } },
    });
  });

  it('leest bij "dienst laten stoppen" de dagen en de laatste werkdag', () => {
    expect(parseShiftEndForm(form({ weekday: ['4', '2'], lastDay: '2026-12-31' }))).toEqual({
      ok: true,
      data: { weekdays: [2, 4], lastDay: '2026-12-31' },
    });
    expect(parseShiftEndForm(form({ lastDay: '31-12-2026' }))).toMatchObject({
      ok: false,
      state: {
        fieldErrors: { weekdays: 'Kies minstens één dag.', lastDay: 'Vul een geldige datum in bij laatste werkdag.' },
      },
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
    expect(planShiftEnd(current, 2, '2026-03-31')).toEqual({
      ok: false,
      error: 'Op dinsdag staat al een latere vaste dienst. Verwijder of wijzig die eerst.',
    });
    expect(planShiftEnd(current, 3, '2026-03-31')).toEqual({
      ok: false,
      error: 'Op woensdag is er op die datum geen vaste dienst.',
    });
    expect(planShiftEnd(current, 1, '2024-12-31')).toEqual({
      ok: false,
      error: 'Op maandag is er op die datum geen vaste dienst.',
    });
  });

  it('zet dezelfde dienst op meerdere dagen en laat de andere dagen met rust', () => {
    // Maandag en dinsdag lopen al (dinsdag wisselt in juli van vestiging), woensdag is nog leeg.
    expect(planShiftsFrom(current, { ...input, weekdays: [1, 2, 3], validFrom: '2026-03-02' })).toEqual({
      ok: true,
      ops: [
        { type: 'close', id: 'sanne-1-2025-01-01', validTo: '2026-03-01' },
        { type: 'insert', values: { ...input, weekday: 1, validFrom: '2026-03-02', validTo: null } },
        { type: 'close', id: 'sanne-2-2025-01-01', validTo: '2026-03-01' },
        { type: 'insert', values: { ...input, weekday: 2, validFrom: '2026-03-02', validTo: '2026-06-30' } },
        { type: 'insert', values: { ...input, weekday: 3, validFrom: '2026-03-02', validTo: null } },
      ],
    });
  });

  it('laat meerdere diensten stoppen, of geen enkele als één dag niet kan', () => {
    const withWednesday = [...current, shift('sanne', 3, 'den_bosch', 'counter', { validFrom: '2025-01-01' })];
    expect(planShiftsEnd(withWednesday, [1, 3], '2026-12-31')).toEqual({
      ok: true,
      ops: [
        { type: 'close', id: 'sanne-1-2025-01-01', validTo: '2026-12-31' },
        { type: 'close', id: 'sanne-3-2025-01-01', validTo: '2026-12-31' },
      ],
    });
    expect(planShiftsEnd(current, [1, 3], '2026-12-31')).toEqual({
      ok: false,
      error: 'Op woensdag is er op die datum geen vaste dienst. Er is niets gewijzigd.',
    });
  });

  it('voert de stappen uit in zo weinig mogelijk databasebewerkingen, eerst stoppen en dan toevoegen', () => {
    const plan = planShiftsFrom(
      [...current, shift('sanne', 4, 'den_bosch', 'counter', { validFrom: '2026-03-02' })],
      { ...input, weekdays: [1, 2, 4], validFrom: '2026-03-02' },
    );
    expect(plan.ok && batchShiftOps(plan.ops)).toEqual([
      { type: 'close', ids: ['sanne-1-2025-01-01', 'sanne-2-2025-01-01'], validTo: '2026-03-01' },
      { type: 'update', ids: ['sanne-4-2026-03-02'], values: { groupId: 'breda', role: 'counter', startTime: null, endTime: null } },
      {
        type: 'insert',
        rows: [
          { ...input, weekday: 1, validFrom: '2026-03-02', validTo: null },
          { ...input, weekday: 2, validFrom: '2026-03-02', validTo: '2026-06-30' },
        ],
      },
    ]);
  });

  it('noemt de dagen voluit, zoals in "maandag, woensdag en vrijdag"', () => {
    expect(weekdayList([2])).toBe('dinsdag');
    expect(weekdayList([1, 2])).toBe('maandag en dinsdag');
    expect(weekdayList([1, 3, 5])).toBe('maandag, woensdag en vrijdag');
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

  it('beschrijft exports, volledig verwijderen en de schakelaar voor mails (fase 3)', () => {
    expect(describeAudit({ ...base, entity: 'export', employee_id: null, details: { kind: 'planning' } }, lookups)).toMatchObject({
      what: 'Planning geëxporteerd',
      detail: null,
    });
    expect(describeAudit({ ...base, entity: 'export', details: { kind: 'employee' } }, lookups)).toMatchObject({
      what: 'Gegevens gedownload – Sanne',
    });
    const deleted = describeAudit(
      {
        ...base,
        action: 'delete',
        entity: 'employees',
        employee_id: 'gone',
        source: 'verwijderen',
        details: { recurring_shifts: 5, absences: 1, substitutions: 0, shift_overrides: 2, calendar_feeds: 1, account: true },
      },
      { ...lookups, employeeName: (id) => (id === 'e0' ? 'Anna' : 'verwijderde medewerker') },
    );
    expect(deleted).toMatchObject({
      what: 'Medewerker volledig verwijderd – verwijderde medewerker',
      detail: '5 vaste diensten, 1 afwezigheid, 2 roosterwijzigingen, 1 agendalink en het inlogaccount',
    });
    const mails = describeAudit(
      {
        ...base,
        action: 'update',
        entity: 'settings',
        employee_id: null,
        changed_fields: ['mail_enabled'],
        details: { mail_enabled: { old: false, new: true } },
      },
      lookups,
    );
    expect(mails.detail).toBe('mails versturen: nee → ja');
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

  it('beschrijft een inval, de status ervan en het afhandelen (fase 2)', () => {
    const insert = describeAudit(
      { ...base, entity: 'substitutions', details: { date: '2026-10-14', group_id: 'breda', day_part: 'morning', status: 'active' } },
      lookups,
    );
    expect(insert).toMatchObject({ what: 'Inval toegewezen – Sanne', detail: 'Breda, 14 okt 2026, ochtend' });
    const review = describeAudit(
      {
        ...base,
        entity: 'substitutions',
        action: 'update',
        changed_fields: ['status'],
        details: { status: { old: 'active', new: 'not_needed' } },
        actor_employee_id: 'e0',
        source: 'controle',
      },
      lookups,
    );
    expect(review).toMatchObject({ what: 'Inval niet meer nodig – Sanne', detail: null, source: 'controle' });
    const handled = describeAudit(
      {
        ...base,
        entity: 'substitutions',
        action: 'update',
        changed_fields: ['handled_at'],
        details: { handled_at: { old: null, new: '2026-10-15T08:00:00Z' } },
      },
      lookups,
    );
    expect(handled.what).toBe('Vervallen inval afgehandeld – Sanne');
  });

  it('noemt een ingetrokken inval zo, en zegt om welke inval het gaat (fase 2)', () => {
    const slot = (id: string | null | undefined) => (id === 's1' ? { date: '2026-10-14', group_id: 'breda', day_part: 'morning' } : null);
    const withdrawn = describeAudit(
      {
        ...base,
        entity: 'substitutions',
        entity_id: 's1',
        action: 'update',
        changed_fields: ['handled_at', 'status'],
        details: { handled_at: { old: null, new: '2026-10-15T08:00:00Z' }, status: { old: 'active', new: 'not_needed' } },
      },
      { ...lookups, substitution: slot },
    );
    expect(withdrawn).toMatchObject({ what: 'Inval ingetrokken – Sanne', detail: 'Breda, 14 okt 2026, ochtend' });
    const review = describeAudit(
      {
        ...base,
        entity: 'substitutions',
        entity_id: 's1',
        action: 'update',
        changed_fields: ['status'],
        details: { status: { old: 'active', new: 'reschedule' } },
        source: 'controle',
      },
      { ...lookups, substitution: slot },
    );
    expect(review).toMatchObject({ what: 'Inval opnieuw regelen – Sanne', detail: 'Breda, 14 okt 2026, ochtend' });
  });

  it('beschrijft roosterwijzigingen en genegeerde gaten (fase 2)', () => {
    const off = describeAudit({ ...base, entity: 'shift_overrides', details: { date: '2026-10-14', kind: 'off' } }, lookups);
    expect(off).toMatchObject({ what: 'Roosterwijziging voor één dag – Sanne', detail: '14 okt 2026, geen dienst' });
    const shift = describeAudit(
      {
        ...base,
        entity: 'shift_overrides',
        details: { date: '2026-10-14', kind: 'shift', group_id: 'breda', role: 'counter', start_time: '09:00:00', end_time: null },
      },
      lookups,
    );
    expect(shift.detail).toBe('14 okt 2026, andere dienst, Breda, balie, 09:00–standaard');
    const back = describeAudit({ ...base, entity: 'shift_overrides', action: 'delete', details: { date: '2026-10-14', kind: 'off' } }, lookups);
    expect(back.what).toBe('Terug naar de vaste dienst – Sanne');
    const gap = describeAudit(
      {
        ...base,
        entity: 'gap_dismissals',
        employee_id: null,
        details: { group_id: 'breda', date: '2026-10-14', day_part: 'afternoon', shortage: 1 },
      },
      lookups,
    );
    expect(gap).toMatchObject({ what: 'Gat genegeerd', detail: 'Breda, 14 okt 2026, middag, tekort 1' });
  });

  it('toont het e-mailadres nooit, alleen dat het veranderde', () => {
    const view = describeAudit(
      { ...base, entity: 'employee_accounts', action: 'update', changed_fields: ['email'], details: null, actor_employee_id: null },
      lookups,
    );
    expect(view).toMatchObject({ what: 'E-mailadres gewijzigd – Sanne', who: 'Systeem' });
  });
});

describe('formulier roosterwijziging voor één dag', () => {
  it('leest groep, rol en tijden; lege tijden zijn de standaard', () => {
    const result = parseDayShiftForm(
      form({ employeeId: EMPLOYEE_ID, date: '2026-10-14', groupId: 'breda', role: 'counter', startTime: '9:00', endTime: '' }),
    );
    expect(result).toEqual({
      ok: true,
      data: { employeeId: EMPLOYEE_ID, date: '2026-10-14', groupId: 'breda', role: 'counter', startTime: '09:00', endTime: null },
    });
  });

  it('weigert zondag, een eindtijd vóór de begintijd en een onbekende rol', () => {
    const sunday = parseDayShiftForm(form({ employeeId: EMPLOYEE_ID, date: '2026-10-18', groupId: 'breda', role: 'counter' }));
    expect(sunday).toMatchObject({ ok: false, state: { fieldErrors: { date: 'Kies bij datum een dag van maandag t/m zaterdag.' } } });
    const reversed = parseDayShiftForm(
      form({ employeeId: EMPLOYEE_ID, date: '2026-10-14', groupId: 'breda', role: 'counter', startTime: '13:00', endTime: '12:00' }),
    );
    expect(reversed).toMatchObject({ ok: false, state: { fieldErrors: { endTime: 'De eindtijd moet na de begintijd liggen.' } } });
    const role = parseDayShiftForm(form({ employeeId: EMPLOYEE_ID, date: '2026-10-14', groupId: 'breda', role: 'chef' }));
    expect(role).toMatchObject({ ok: false, state: { fieldErrors: { role: 'Kies een rol.' } } });
  });

  it('kan de datum uit een ander veld lezen, voor verplaatsen', () => {
    const result = parseDayShiftForm(form({ employeeId: EMPLOYEE_ID, to: '2026-10-17', groupId: 'eindhoven', role: 'counter' }), 'to');
    expect(result).toMatchObject({ ok: true, data: { date: '2026-10-17' } });
  });

  it('controleert medewerker en datum voor "geen dienst"', () => {
    expect(parseDayRef(form({ employeeId: EMPLOYEE_ID, date: '2026-10-17' }))).toMatchObject({ ok: true });
    expect(parseDayRef(form({ employeeId: 'onzin', date: '2026-10-17' }))).toMatchObject({ ok: false });
  });
});
