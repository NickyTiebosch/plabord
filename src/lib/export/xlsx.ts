/**
 * Een export als .xlsx-bestand, met write-excel-file (zoals het sjabloon van de import).
 * Alleen op de server gebruiken.
 */
import writeExcelFile from 'write-excel-file/node';
import type { ExportSheet } from './planning';
import type { RosterCell, RosterSheet, RosterTone } from './roster';

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

/** Kleuren van de kopjes, zoals op het Rooster-scherm: balie, hiker/buitendienst, de rest. */
const TONES: Record<RosterTone, { backgroundColor: string; textColor: string }> = {
  counter: { backgroundColor: '#DDF2EE', textColor: '#115E59' },
  cleaning: { backgroundColor: '#EDE9FE', textColor: '#5B21B6' },
  other: { backgroundColor: '#F1F5F9', textColor: '#475569' },
};

function rosterCellStyle(cell: RosterCell) {
  switch (cell.kind) {
    case 'title':
      return { fontWeight: 'bold' as const, fontSize: 13 };
    case 'day':
      return { fontWeight: 'bold' as const, bottomBorderStyle: 'thin' as const, bottomBorderColor: '#94A3B8' };
    case 'section':
      return { fontWeight: 'bold' as const, ...TONES[cell.tone ?? 'other'] };
    case 'closed':
      return { fontStyle: 'italic' as const, textColor: '#64748B', wrap: true };
    case 'shortage':
      return { fontWeight: 'bold' as const, textColor: '#B91C1C', wrap: true };
    case 'empty':
      return { fontStyle: 'italic' as const, textColor: '#94A3B8' };
    case 'name':
      return {};
    case 'shift':
      return { wrap: true };
  }
}

/** Het rooster als .xlsx: liggend afdrukken, de namen blijven in beeld bij het scrollen. */
export async function buildRosterWorkbook(sheets: readonly RosterSheet[]): Promise<Buffer> {
  return writeExcelFile(
    sheets.map((sheet) => ({
      sheet: sheet.sheet,
      data: sheet.rows.map((row) => row.map((cell) => ({ value: cell.value, ...rosterCellStyle(cell) }))),
      columns: [{ width: 26 }, ...Array.from({ length: 6 }, () => ({ width: 22 }))],
      stickyColumnsCount: 1,
      orientation: 'landscape' as const,
    })),
  ).toBuffer();
}
