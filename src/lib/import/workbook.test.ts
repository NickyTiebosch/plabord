import { describe, expect, it } from 'vitest';
import { groups } from '../engine/__fixtures__/team';
import { parseWorkbook, type RawSheet } from './workbook';

const employeesSheet: RawSheet = {
  sheet: 'Medewerkers',
  data: [
    ['Naam', 'E-mail', 'Groep', 'Rol', 'Inzetbaar aan de balie in', 'Beheerder (ja/nee)', 'Opmerking (info)'],
    ['Sanne', 'sanne@voorbeeld.nl', 'Den Bosch', 'balie', 'Den Bosch, Eindhoven', 'nee', 'mag niet worden gelezen'],
    [' Joris ', null, 'den bosch', 'Balie', null, null, null],
    [null, null, null, null, null, null, 'alleen info: regel wordt overgeslagen'],
    ['Petra', 'petra@voorbeeld.nl', 'Overig', null, 'Den Bosch', 'ja', null],
  ],
};

const shiftsSheet: RawSheet = {
  sheet: 'Vaste roosters',
  data: [
    ['Naam', 'Dag', 'Groep', 'Rol', 'Begintijd', 'Eindtijd', 'Geldig vanaf'],
    ['Sanne', 'di', null, null, null, null, new Date(Date.UTC(2026, 0, 5))],
    ['Sanne', 'wo', 'Eindhoven', 'balie', '09:00', '17:00', '5-1-2026'],
  ],
};

const absencesSheet: RawSheet = {
  sheet: 'Afwezigheid',
  data: [
    ['Naam', 'Van', 'Tot', 'Dagdeel', 'Status'],
    ['Sanne', '14-10-2026', null, null, null],
    ['Joris', '20-10-2026', '24-10-2026', 'hele dag', 'aangevraagd'],
  ],
};

describe('parseWorkbook', () => {
  it('leest de drie tabbladen en slaat andere tabbladen en (info)-kolommen over', () => {
    const result = parseWorkbook(
      [{ sheet: 'Uitleg', data: [['Lees mij']] }, employeesSheet, shiftsSheet, absencesSheet, { sheet: 'Controle', data: [] }],
      groups,
    );
    expect(result.errors).toEqual([]);
    expect(result.notices.map((notice) => notice.sheet)).toEqual(['Uitleg', 'Controle']);
    expect(result.employees).toEqual([
      {
        row: 2,
        name: 'Sanne',
        email: 'sanne@voorbeeld.nl',
        groupId: 'den_bosch',
        role: 'counter',
        counterGroupIds: ['den_bosch', 'eindhoven'],
        isAdmin: false,
      },
      { row: 3, name: 'Joris', email: null, groupId: 'den_bosch', role: 'counter', counterGroupIds: [], isAdmin: false },
      {
        row: 5,
        name: 'Petra',
        email: 'petra@voorbeeld.nl',
        groupId: 'other',
        role: 'none',
        counterGroupIds: ['den_bosch'],
        isAdmin: true,
      },
    ]);
    expect(result.shifts).toEqual([
      { row: 2, name: 'Sanne', weekday: 2, groupId: null, role: null, startTime: null, endTime: null, validFrom: '2026-01-05' },
      {
        row: 3,
        name: 'Sanne',
        weekday: 3,
        groupId: 'eindhoven',
        role: 'counter',
        startTime: '09:00',
        endTime: '17:00',
        validFrom: '2026-01-05',
      },
    ]);
    expect(result.absences).toEqual([
      { row: 2, name: 'Sanne', startDate: '2026-10-14', endDate: '2026-10-14', dayPart: 'full_day', status: 'approved' },
      { row: 3, name: 'Joris', startDate: '2026-10-20', endDate: '2026-10-24', dayPart: 'full_day', status: 'requested' },
    ]);
  });

  it('geeft fouten per regel, met regelnummer en kolom', () => {
    const result = parseWorkbook(
      [
        {
          sheet: 'afwezigheid',
          data: [
            ['Naam', 'Van', 'Tot', 'Dagdeel', 'Status'],
            ['Sanne', '31-2-2026', null, null, null],
            ['Joris', '20-10-2026', '21-10-2026', 'ochtend', null],
            ['Eva', '22-10-2026', '21-10-2026', null, 'misschien'],
            [null, '22-10-2026', null, null, null],
          ],
        },
      ],
      groups,
    );
    expect(result.absences).toEqual([]);
    expect(result.errors).toEqual([
      { sheet: 'Afwezigheid', row: 2, message: 'Van: "31-2-2026" bestaat niet als datum.' },
      {
        sheet: 'Afwezigheid',
        row: 3,
        message: 'Dagdeel: een halve dag kan alleen bij één dag (Van en Tot gelijk).',
      },
      {
        sheet: 'Afwezigheid',
        row: 4,
        message: 'Status: Onbekende status "misschien". Kies goedgekeurd of aangevraagd.',
      },
      { sheet: 'Afwezigheid', row: 4, message: 'Tot: ligt vóór Van.' },
      { sheet: 'Afwezigheid', row: 5, message: 'Naam: vul een naam in.' },
    ]);
  });

  it('meldt een ontbrekende verplichte kolom', () => {
    const result = parseWorkbook([{ sheet: 'Medewerkers', data: [['Naam', 'E-mail'], ['Sanne', null]] }], groups);
    expect(result.errors).toEqual([{ sheet: 'Medewerkers', row: 1, message: 'Kolom ontbreekt: "Groep".' }]);
  });

  it('meldt dubbele regels in het bestand', () => {
    const result = parseWorkbook(
      [
        {
          sheet: 'Medewerkers',
          data: [
            ['Naam', 'E-mail', 'Groep'],
            ['Sanne', 'sanne@voorbeeld.nl', 'Breda'],
            ['SANNE', 'sanne2@voorbeeld.nl', 'Breda'],
            ['Eva', 'sanne@voorbeeld.nl', 'Breda'],
          ],
        },
      ],
      groups,
    );
    expect(result.errors.map((error) => `${error.row}: ${error.message}`)).toEqual([
      '3: Naam: staat ook op regel 2.',
      '4: E-mail: staat ook op regel 2.',
    ]);
  });

  it('vindt de kopregel ook als er een titelregel boven staat', () => {
    const result = parseWorkbook(
      [{ sheet: 'Medewerkers', data: [['Medewerkerslijst'], [], ['Naam', 'Groep'], ['Eva', 'Breda']] }],
      groups,
    );
    expect(result.employees).toMatchObject([{ row: 4, name: 'Eva', groupId: 'breda' }]);
    expect(result.employees[0]?.role).toBeUndefined();
  });
});
