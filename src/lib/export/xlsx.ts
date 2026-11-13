/**
 * Een export als .xlsx-bestand, met write-excel-file (zoals het sjabloon van de import).
 * Alleen op de server gebruiken.
 */
import writeExcelFile from 'write-excel-file/node';
import type { LoanCell, LoanCellTone, LoanSheet } from './loans';
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

/** Kleuren zoals in het oude registratiebestand: donkerblauwe titel, blauwe koppen, en per waarde een tint. */
const LOAN_TONES: Record<LoanCellTone, string> = {
  used: '#E2F0D9',
  unused: '#FBE5E5',
  mobility: '#E2F0D9',
  workshop_weekend: '#FCE9D9',
};

const LOAN_BORDER = { borderStyle: 'thin' as const, borderColor: '#BFC9D9' };

function loanCell(cell: LoanCell) {
  const style = { ...LOAN_BORDER, ...(cell.tone ? { backgroundColor: LOAN_TONES[cell.tone] } : {}) };
  if (cell.value === null || cell.value === '') return { value: undefined, ...style };
  if (cell.kind === 'date' && typeof cell.value === 'string') {
    const [year = 2000, month = 1, day = 1] = cell.value.split('-').map(Number);
    return { value: new Date(Date.UTC(year, month - 1, day)), type: Date, format: 'dd-mm-yyyy', ...style };
  }
  if (cell.kind === 'number' && typeof cell.value === 'number') return { value: cell.value, type: Number, format: '0', ...style };
  return { value: String(cell.value), type: String, ...style };
}

/** De uitleen als .xlsx (fase 5, V50): titelbalk, kolomkoppen en vaste kolombreedtes. Geen keuzelijsten. */
export async function buildLoansWorkbook(sheets: readonly LoanSheet[]): Promise<Buffer> {
  const widths = [12, 22, 15, 12, 8, 20, 24, 18, 10, 36, 13, 11, 20, 18, 14];
  return writeExcelFile(
    sheets.map((sheet) => ({
      sheet: sheet.sheet,
      data: [
        [
          { value: sheet.title, fontWeight: 'bold' as const, fontSize: 13, textColor: '#FFFFFF', backgroundColor: '#1F3864' },
          ...sheet.header.slice(1).map(() => ({ value: undefined, backgroundColor: '#1F3864' })),
        ],
        sheet.header.map((value) => ({
          value,
          fontWeight: 'bold' as const,
          textColor: '#FFFFFF',
          backgroundColor: '#2F5597',
          ...LOAN_BORDER,
        })),
        ...sheet.rows.map((row) => row.map(loanCell)),
      ],
      columns: widths.map((width) => ({ width })),
      stickyRowsCount: 2,
    })),
  ).toBuffer();
}
