import readExcelFile from 'read-excel-file/node';
import { describe, expect, it } from 'vitest';
import { amsterdamInstant } from '../loans/time';
import type { Incident, WalkIn, Workshop } from '../registrations/types';
import { INCIDENT_EXPORT_HEADER, incidentsExport, walkInsExport } from './registrations';
import { buildTitledWorkbook } from './xlsx';

const at = (date: string, time: string) => amsterdamInstant(date, time as never).toISOString();
const now = new Date('2026-11-13T15:30:00Z');
const groups = [
  { id: 'den_bosch', name: 'Den Bosch' },
  { id: 'breda', name: 'Breda' },
];
const workshops: Workshop[] = [
  { id: 'db-audi', groupId: 'den_bosch', name: 'Audi', sortOrder: 2, isActive: true },
  { id: 'db-vw', groupId: 'den_bosch', name: 'Volkswagen', sortOrder: 1, isActive: true },
  { id: 'db-oud', groupId: 'den_bosch', name: 'Oud', sortOrder: 3, isActive: false },
  { id: 'db-weg', groupId: 'den_bosch', name: 'Weg', sortOrder: 4, isActive: false },
  { id: 'br-vw', groupId: 'breda', name: 'Volkswagen', sortOrder: 1, isActive: true },
];
const walkIn = (workshopId: string, date: string, count: number, groupId = 'den_bosch'): WalkIn => ({
  groupId,
  workshopId,
  date,
  count,
  updatedBy: null,
  updatedAt: at(date, '17:00'),
});

describe('walkInsExport', () => {
  const sheets = walkInsExport(
    [walkIn('db-vw', '2026-11-12', 3), walkIn('db-audi', '2026-11-12', 0), walkIn('db-oud', '2026-11-10', 2), walkIn('db-vw', '2026-11-10', 1)],
    { groups, workshops, now },
  );

  it('maakt per vestiging een tabblad met de werkplaatsen op volgorde, en een inactieve alleen met cijfers', () => {
    expect(sheets.map((sheet) => sheet.sheet)).toEqual(['Den Bosch', 'Breda']);
    expect(sheets[0]?.header).toEqual(['Datum', 'Dag', 'Wk', 'Volkswagen', 'Audi', 'Oud', 'Totaal']);
    expect(sheets[0]?.title).toBe('Binnenvallers · Den Bosch · stand 13-11-2026 16:30');
  });

  it('zet per dag een regel, met leeg voor niet ingevuld en een totaalregel', () => {
    const values = sheets[0]?.rows.map((row) => row.map((cell) => cell.value));
    expect(values).toEqual([
      ['2026-11-10', 'di', 46, 1, null, 2, 3],
      ['2026-11-12', 'do', 46, 3, 0, null, 3],
      [null, 'Totaal', null, 4, 0, 2, 6],
    ]);
  });

  it('een vestiging zonder cijfers heeft alleen de totaalregel', () => {
    expect(sheets[1]?.rows).toHaveLength(1);
  });
});

function incident(overrides: Partial<Incident> & { id: string }): Incident {
  return {
    groupId: 'den_bosch',
    workshopId: 'db-vw',
    occurredAt: at('2026-11-12', '09:00'),
    kind: 'cancellation',
    missing: null,
    cancelledAt: '12:00',
    charge: true,
    chargedAt: null,
    chargedBy: null,
    plate: 'GHP39K',
    contractNumber: '681613',
    note: 'Klant niet gekomen',
    reportedBy: 'sanne',
    createdAt: at('2026-11-12', '09:00'),
    ...overrides,
  };
}

describe('incidentsExport', () => {
  const sheets = incidentsExport(
    [
      incident({ id: 'a', chargedAt: at('2026-11-13', '10:00'), chargedBy: 'tess' }),
      incident({ id: 'b', occurredAt: at('2026-11-10', '14:00') }),
      incident({ id: 'c', kind: 'contract_license', missing: 'both', cancelledAt: null, charge: null, plate: null, reportedBy: null }),
      incident({ id: 'd', groupId: 'breda', workshopId: 'br-vw', charge: false, cancelledAt: '09:30' }),
    ],
    { groups, workshops, now, personName: (id) => ({ sanne: 'Sanne', tess: 'Tess' })[id ?? ''] ?? 'oud-collega' },
  );

  it('maakt per vestiging een tabblad en een tabblad Doorbelasten', () => {
    expect(sheets.map((sheet) => sheet.sheet)).toEqual(['Den Bosch', 'Breda', 'Doorbelasten']);
    expect(sheets[0]?.header).toEqual(INCIDENT_EXPORT_HEADER);
  });

  it('zet de kolommen van het oude bestand, met wanneer en door wie doorbelast', () => {
    const values = sheets[0]?.rows.map((row) => row.map((cell) => cell.value));
    expect(values?.[0]).toEqual(['2026-11-10', 'di', 46, 'Volkswagen', 'Annulering door werkplaats', null, '12:00', 'Ja', 'GHP-39-K', '681613', 'Klant niet gekomen', 'Sanne', null, null]);
    expect(values?.[1]).toEqual(['2026-11-12', 'do', 46, 'Volkswagen', 'Annulering door werkplaats', null, '12:00', 'Ja', 'GHP-39-K', '681613', 'Klant niet gekomen', 'Sanne', '2026-11-13', 'Tess']);
    expect(values?.[2]?.slice(4, 8)).toEqual(['Contract/rijbewijs niet in orde', 'Beide', null, null]);
  });

  it('Doorbelasten: alleen wat doorbelast moet worden, de open bovenaan, met de vestiging', () => {
    const rows = sheets[2]?.rows.map((row) => [row[3]?.value, row[13]?.value]);
    expect(rows).toEqual([
      ['Den Bosch', null],
      ['Den Bosch', '2026-11-13'],
    ]);
  });

  it('wordt een bestand met titelbalk en koppen dat Excel kan lezen', async () => {
    const file = await buildTitledWorkbook(sheets);
    const read = await readExcelFile(file);
    expect(read.map((sheet) => sheet.sheet)).toEqual(['Den Bosch', 'Breda', 'Doorbelasten']);
    expect(read[0]?.data[0]?.[0]).toContain('Werkplaatsmeldingen · Den Bosch');
    expect(read[0]?.data[1]).toEqual(INCIDENT_EXPORT_HEADER);
    expect(read[0]?.data).toHaveLength(5);
  });
});
