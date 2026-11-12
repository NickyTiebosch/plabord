import readExcelFile from 'read-excel-file/node';
import { describe, expect, it } from 'vitest';
import { amsterdamInstant } from '../loans/time';
import type { VehicleLoan } from '../loans/types';
import { LOAN_EXPORT_HEADER, loansExport } from './loans';
import { buildLoansWorkbook } from './xlsx';

const at = (date: string, time: string) => amsterdamInstant(date, time).toISOString();

const loans: VehicleLoan[] = [
  {
    id: '1',
    groupId: 'den_bosch',
    plate: 'GHP39K',
    model: 'Audi A4',
    destination: 'mobility',
    handedTo: 'Mobiliteit',
    handedOutBy: 'sanne',
    handedOutAt: at('2026-11-12', '09:12'),
    odometerOut: 45210,
    returnedAt: null,
    returnedBy: null,
    odometerIn: null,
    wasUsed: null,
    note: null,
    returnNote: null,
  },
  {
    id: '2',
    groupId: 'breda',
    plate: 'KPK66J',
    model: 'Skoda Octavia',
    destination: 'workshop_weekend',
    handedTo: 'Werkplaats Breda',
    handedOutBy: 'eva',
    handedOutAt: at('2026-11-06', '17:30'),
    odometerOut: 60120,
    returnedAt: at('2026-11-09', '07:45'),
    returnedBy: null,
    odometerIn: 60188,
    wasUsed: true,
    note: 'Voor spoedjes',
    returnNote: 'Pech onderweg',
  },
];

const lookups = {
  now: new Date(at('2026-11-12', '14:05')),
  groupName: (id: string) => ({ den_bosch: 'Den Bosch', breda: 'Breda' })[id] ?? id,
  personName: (id: string | null) => ({ sanne: 'Sanne', eva: 'Eva' })[id ?? ''] ?? 'oud-collega',
};

describe('export van de uitleen (V50)', () => {
  const sheets = loansExport(loans, lookups);

  it('heeft Registratie (nu uit) en Archief (retour), met de kolommen van het oude bestand', () => {
    expect(sheets.map((sheet) => [sheet.sheet, sheet.rows.length])).toEqual([
      ['Registratie', 1],
      ['Archief', 1],
    ]);
    expect(sheets[0]?.title).toBe('Uitleen · nu uitgeleend · stand 12-11-2026 14:05');
    expect(LOAN_EXPORT_HEADER.slice(0, 10)).toEqual([
      'Kenteken',
      'Model auto',
      'Kilometerstand',
      'Datum',
      'Tijd',
      'Bestemming',
      'Meegegeven aan',
      'Meegegeven door',
      'Ingezet?',
      'Reden / opmerking',
    ]);
    expect(sheets[1]?.rows[0]?.map((cell) => cell.value)).toEqual([
      'KPK-66-J',
      'Skoda Octavia',
      60120,
      '2026-11-06',
      '17:30',
      'Werkplaats (weekend)',
      'Werkplaats Breda',
      'Eva',
      'Ja',
      'Voor spoedjes · Pech onderweg',
      '2026-11-09',
      '07:45',
      60188,
      'oud-collega',
      'Breda',
    ]);
  });

  it('maakt een bestand met echte datums en getallen', async () => {
    const file = await buildLoansWorkbook(sheets);
    const read = await readExcelFile(file);
    expect(read.map((sheet) => sheet.sheet)).toEqual(['Registratie', 'Archief']);
    const archive = read[1]?.data ?? [];
    expect(archive[0]?.[0]).toBe('Uitleen · archief (retour, ingezet en niet ingezet) · stand 12-11-2026 14:05');
    expect(archive[1]?.[0]).toBe('Kenteken');
    const row = archive[2] ?? [];
    expect(row[0]).toBe('KPK-66-J');
    expect(row[2]).toBe(60120);
    expect(row[3]).toBeInstanceOf(Date);
    expect((row[3] as unknown as Date).toISOString().slice(0, 10)).toBe('2026-11-06');
    expect(row[4]).toBe('17:30');
    expect(row[8]).toBe('Ja');
    // De open uitleen heeft lege retourkolommen.
    expect(read[0]?.data[2]?.slice(10, 14)).toEqual([null, null, null, null]);
  });
});
