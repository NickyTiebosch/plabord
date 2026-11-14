import readExcelFile from 'read-excel-file/node';
import { describe, expect, it } from 'vitest';
import { locationsExport } from '../export/locations';
import { buildTitledWorkbook } from '../export/xlsx';
import { planLocations } from '../import/locations';
import { amsterdamInstant } from '../loans/time';
import { cleanModel, isStale, parseSpotList, spotsWithVehicles } from './status';
import type { ParkingSpot, VehicleLocation } from './types';

const at = (date: string, time = '12:00') => amsterdamInstant(date, time as never).toISOString();
const spots: ParkingSpot[] = [
  { id: 's20', groupId: 'den_bosch', name: 'S 20', sortOrder: 10, isActive: true },
  { id: 's3', groupId: 'den_bosch', name: 'S 3', sortOrder: 10, isActive: true },
  { id: 'achter', groupId: 'den_bosch', name: 'Achter', sortOrder: 2, isActive: true },
  { id: 'oud', groupId: 'den_bosch', name: 'Oud', sortOrder: 1, isActive: false },
  { id: 'leeg-oud', groupId: 'den_bosch', name: 'Weg', sortOrder: 1, isActive: false },
  { id: 'e-voor', groupId: 'eindhoven', name: 'Voor', sortOrder: 1, isActive: true },
];
const location = (plate: string, spotId: string, movedAt = at('2026-11-12')): VehicleLocation => ({
  plate,
  groupId: spotId.startsWith('e-') ? 'eindhoven' : 'den_bosch',
  spotId,
  model: 'VW Polo',
  movedBy: 'sanne',
  movedAt,
});

describe('locatie (V73–V77)', () => {
  it('zet de plekken op volgorde met hun auto’s; een inactieve plek alleen met een auto erop', () => {
    const result = spotsWithVehicles(spots, [location('ZZ105X', 'achter'), location('ZZ104X', 'achter'), location('X221LB', 'oud')], 'den_bosch');
    expect(result.map((entry) => [entry.spot.name, entry.vehicles.map((vehicle) => vehicle.plate)])).toEqual([
      ['Oud', ['X221LB']],
      ['Achter', ['ZZ104X', 'ZZ105X']],
      ['S 3', []],
      ['S 20', []],
    ]);
  });

  it('noemt een auto die langer dan 14 dagen niet is verzet "lang niet gezien"', () => {
    expect(isStale({ movedAt: at('2026-10-30') }, '2026-11-13')).toBe(false);
    expect(isStale({ movedAt: at('2026-10-29') }, '2026-11-13')).toBe(true);
  });

  it('leest meerdere plekken in één keer, zonder lege regels en dubbelingen', () => {
    expect(parseSpotList('S 1\n\n  S   2 \nS 1\ns 2')).toEqual({ ok: true, names: ['S 1', 'S 2'] });
    expect(parseSpotList('\n')).toEqual({ ok: false, error: 'Vul minstens één plek in.' });
    expect(parseSpotList('a'.repeat(21))).toMatchObject({ ok: false });
    expect(cleanModel('  VW   Golf ')).toBe('VW Golf');
    expect(cleanModel('')).toBeNull();
  });
});

describe('startlijst inlezen', () => {
  it('leest kenteken en plek, ook als de kop van de plek iets anders heet', () => {
    const plan = planLocations(
      [
        {
          sheet: 'Locatie huurauto’s (2)',
          data: [[], [null, 'Kenteken', 'Zijkant'], [], [null, 'ZZ104X', 'S 18'], [null, 'zz-102-x', 'achter'], [null, 'ZZ104X', 'Achter'], [null, '??', 'Achter'], [null, 'ZZ103X', null]],
        },
        { sheet: 'Blad1', data: [] },
      ],
      ['Achter', 'Zijkant'],
    );
    expect(plan.rows).toEqual([
      { plate: 'ZZ104X', spot: 'S 18', model: null },
      { plate: 'ZZ102X', spot: 'Achter', model: null },
    ]);
    expect(plan.newSpots).toEqual(['S 18']);
    expect(plan.notices.map((notice) => notice.row)).toEqual([6, 7, 8]);
    expect(plan.errors).toEqual([]);
  });

  it('gebruikt de kolommen Plek en Model als ze er zijn, en geeft een fout zonder auto’s', () => {
    const plan = planLocations([{ sheet: 'Lijst', data: [['Model', 'Kenteken', 'Opmerking', 'Plek'], ['VW Golf', 'GHP39K', 'x', 'S 1']] }], []);
    expect(plan.rows).toEqual([{ plate: 'GHP39K', spot: 'S 1', model: 'VW Golf' }]);
    expect(planLocations([{ sheet: 'Leeg', data: [['Naam']] }], []).errors[0]?.message).toContain('Geen auto’s gevonden');
  });
});

describe('locatie als Excel (V78)', () => {
  it('maakt per vestiging met plekken een tabblad, op volgorde van de plekken', async () => {
    const sheets = locationsExport([location('ZZ104X', 's20'), location('ZZ105X', 'achter', at('2026-10-01')), location('GHP39K', 'e-voor')], {
      groups: [
        { id: 'den_bosch', name: 'Den Bosch' },
        { id: 'eindhoven', name: 'Eindhoven' },
        { id: 'breda', name: 'Breda' },
      ],
      spots,
      personName: (id) => (id === 'sanne' ? 'Sanne' : 'oud-collega'),
      now: new Date('2026-11-13T15:00:00Z'),
      today: '2026-11-13',
    });
    expect(sheets.map((sheet) => sheet.sheet)).toEqual(['Den Bosch', 'Eindhoven']);
    expect(sheets[0]?.rows.map((row) => row.map((cell) => cell.value))).toEqual([
      ['ZZ-105-X', 'Achter', 'VW Polo', 'Sanne', '2026-10-01', 'ja'],
      ['ZZ-104-X', 'S 20', 'VW Polo', 'Sanne', '2026-11-12', null],
    ]);
    const read = await readExcelFile(await buildTitledWorkbook(sheets));
    expect(read[0]?.data[1]).toEqual(['Kenteken', 'Plek', 'Model', 'Verzet door', 'Verzet op', 'Lang niet gezien']);
  });
});
