/**
 * Lezen en schrijven van .xlsx-bestanden. Alleen op de server gebruiken.
 * Lezen: read-excel-file. Het sjabloon: write-excel-file. Beide actief onderhouden.
 */
import readExcelFile from 'read-excel-file/node';
import writeExcelFile from 'write-excel-file/node';
import type { CellValue } from './cells';
import {
  ABSENCE_COLUMNS,
  EMPLOYEE_COLUMNS,
  MAX_FILE_BYTES,
  SHEET_NAMES,
  SHIFT_COLUMNS,
  type ColumnSpec,
} from './columns';
import type { RawSheet } from './workbook';

export class ImportFileError extends Error {}

/** Leest alle tabbladen van een .xlsx-bestand. Gooit ImportFileError met een Nederlandse uitleg. */
export async function readWorkbook(buffer: Buffer): Promise<RawSheet[]> {
  if (buffer.byteLength === 0) throw new ImportFileError('Het bestand is leeg.');
  if (buffer.byteLength > MAX_FILE_BYTES) throw new ImportFileError('Het bestand is groter dan 2 MB.');
  // Een .xlsx-bestand is een zip-bestand en begint met "PK".
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new ImportFileError('Dit is geen .xlsx-bestand. Sla het in Excel op als "Excel-werkmap (.xlsx)".');
  }
  try {
    const sheets = await readExcelFile(buffer);
    return sheets.map((sheet) => ({ sheet: sheet.sheet, data: sheet.data as unknown as CellValue[][] }));
  } catch {
    throw new ImportFileError('Het bestand kan niet worden gelezen. Is het een .xlsx-bestand uit Excel?');
  }
}

const bold = (value: string) => ({ value, fontWeight: 'bold' as const });

function dataSheet(sheet: string, columns: readonly ColumnSpec[]) {
  return {
    sheet,
    data: [columns.map((column) => bold(column.header))],
    columns: columns.map((column) => ({ width: Math.max(14, column.header.length + 4) })),
    stickyRowsCount: 1,
  };
}

/** Het lege sjabloon: dezelfde tabbladen en kopnamen als de import verwacht, plus een tabblad Uitleg. */
export async function buildTemplate(): Promise<Buffer> {
  const explanation = [
    [bold('Planbord – importbestand')],
    [{ value: '' }],
    [{ value: 'Vul de tabbladen Medewerkers, Vaste roosters en Afwezigheid. Laat de kopnamen staan.' }],
    [{ value: 'Andere tabbladen (zoals dit) en kolommen met "(info)" in de kop worden overgeslagen.' }],
    [{ value: 'Datums: d-m-jjjj of een Excel-datum. Tijden: uu:mm of een Excel-tijd.' }],
    [{ value: 'Opnieuw importeren maakt geen dubbelingen. De import verwijdert nooit iets.' }],
    [{ value: '' }],
    [bold('Tabblad'), bold('Kolom'), bold('Uitleg')],
    ...(
      [
        [SHEET_NAMES.employees, EMPLOYEE_COLUMNS],
        [SHEET_NAMES.shifts, SHIFT_COLUMNS],
        [SHEET_NAMES.absences, ABSENCE_COLUMNS],
      ] as const
    ).flatMap(([sheet, columns]) =>
      (columns as readonly ColumnSpec[]).map((column) => [{ value: sheet }, { value: column.header }, { value: column.hint }]),
    ),
  ];
  return writeExcelFile([
    { sheet: 'Uitleg', data: explanation, columns: [{ width: 18 }, { width: 26 }, { width: 70 }] },
    dataSheet(SHEET_NAMES.employees, EMPLOYEE_COLUMNS),
    dataSheet(SHEET_NAMES.shifts, SHIFT_COLUMNS),
    dataSheet(SHEET_NAMES.absences, ABSENCE_COLUMNS),
  ]).toBuffer();
}
