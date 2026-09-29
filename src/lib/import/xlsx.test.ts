import writeExcelFile from 'write-excel-file/node';
import { describe, expect, it } from 'vitest';
import { groups } from '../engine/__fixtures__/team';
import { parseWorkbook } from './workbook';
import { buildTemplate, ImportFileError, readWorkbook } from './xlsx';

describe('sjabloon', () => {
  it('heeft de drie tabbladen met precies de kopnamen, plus Uitleg', async () => {
    const sheets = await readWorkbook(await buildTemplate());
    expect(sheets.map((sheet) => sheet.sheet)).toEqual(['Uitleg', 'Medewerkers', 'Vaste roosters', 'Afwezigheid']);
    expect(sheets[1]?.data[0]).toEqual(['Naam', 'E-mail', 'Groep', 'Rol', 'Inzetbaar aan de balie in', 'Beheerder']);
    expect(sheets[2]?.data[0]).toEqual(['Naam', 'Dag', 'Groep', 'Rol', 'Begintijd', 'Eindtijd', 'Geldig vanaf']);
    expect(sheets[3]?.data[0]).toEqual(['Naam', 'Van', 'Tot', 'Dagdeel', 'Status']);
    const parsed = parseWorkbook(sheets, groups);
    expect(parsed.errors).toEqual([]);
    expect(parsed.employees).toEqual([]);
  });
});

describe('een echt .xlsx-bestand lezen', () => {
  it('leest Excel-datums, -tijden en tekst, met de juiste regelnummers', async () => {
    const file = await writeExcelFile([
      { sheet: 'Uitleg', data: [[{ value: 'Wordt overgeslagen' }]] },
      {
        sheet: 'Medewerkers',
        data: [
          [{ value: 'Naam' }, { value: 'E-mail' }, { value: 'Groep' }, { value: 'Notitie (info)' }],
          [{ value: 'Sanne' }, { value: 'Sanne@Voorbeeld.nl' }, { value: 'Den Bosch' }, { value: 'niet lezen' }],
        ],
      },
      {
        sheet: 'Vaste roosters',
        data: [
          [{ value: 'Naam' }, { value: 'Dag' }, { value: 'Begintijd' }, { value: 'Eindtijd' }, { value: 'Geldig vanaf' }],
          [
            { value: 'Sanne' },
            { value: 'di' },
            { value: 0.3125, format: 'hh:mm' },
            { value: '17:30' },
            { value: new Date(Date.UTC(2026, 0, 5)), format: 'd-m-yyyy' },
          ],
        ],
      },
      {
        sheet: 'Afwezigheid',
        data: [
          [{ value: 'Naam' }, { value: 'Van' }, { value: 'Tot' }],
          [{ value: 'Sanne' }, { value: new Date(Date.UTC(2026, 9, 14)), format: 'd-m-yyyy' }, { value: '16-10-2026' }],
        ],
      },
    ]).toBuffer();

    const parsed = parseWorkbook(await readWorkbook(file), groups);
    expect(parsed.errors).toEqual([]);
    expect(parsed.employees).toMatchObject([{ row: 2, name: 'Sanne', email: 'sanne@voorbeeld.nl', groupId: 'den_bosch' }]);
    expect(parsed.shifts).toMatchObject([{ row: 2, weekday: 2, startTime: '07:30', endTime: '17:30', validFrom: '2026-01-05' }]);
    expect(parsed.absences).toMatchObject([{ row: 2, startDate: '2026-10-14', endDate: '2026-10-16' }]);
  });

  it('weigert bestanden die geen .xlsx zijn of te groot zijn', async () => {
    await expect(readWorkbook(Buffer.from('Naam;Groep\nSanne;Breda'))).rejects.toBeInstanceOf(ImportFileError);
    await expect(readWorkbook(Buffer.alloc(0))).rejects.toThrow('Het bestand is leeg.');
    await expect(readWorkbook(Buffer.alloc(2 * 1024 * 1024 + 1, 0x50))).rejects.toThrow('groter dan 2 MB');
  });
});
