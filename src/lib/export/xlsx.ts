/**
 * Een export als .xlsx-bestand, met write-excel-file (zoals het sjabloon van de import).
 * Alleen op de server gebruiken.
 */
import writeExcelFile from 'write-excel-file/node';
import type { ExportSheet } from './planning';

export async function buildExportWorkbook(sheets: readonly ExportSheet[]): Promise<Buffer> {
  return writeExcelFile(
    sheets.map((sheet) => ({
      sheet: sheet.sheet,
      data: [
        sheet.header.map((value) => ({ value, fontWeight: 'bold' as const })),
        ...sheet.rows.map((row) => row.map((value) => ({ value }))),
      ],
      columns: sheet.header.map((header, index) => ({
        width: Math.min(
          60,
          Math.max(12, header.length + 2, ...sheet.rows.map((row) => String(row[index] ?? '').length + 2)),
        ),
      })),
      stickyRowsCount: 1,
    })),
  ).toBuffer();
}
