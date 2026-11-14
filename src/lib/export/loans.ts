/**
 * De uitleen als Excel (fase 5, V50): de gratis versie. Twee tabbladen, zoals het bestand waar het
 * team mee begon: Registratie (wat nu uit staat) en Archief (wat retour is, ingezet en niet ingezet).
 * De kolommen in de volgorde van dat bestand, met de retourgegevens erachter. Puur: van gegevens naar
 * rijen; het bestand zelf maakt `buildLoansWorkbook`.
 */
import { formatPlate } from '../loans/plates';
import { localMoment } from '../loans/time';
import { DESTINATION_LABELS, type Destination, type VehicleLoan } from '../loans/types';

export type LoanCellKind = 'text' | 'date' | 'time' | 'number';
/** Een kleur voor de cel, zoals in het oude bestand: ingezet groen, niet ingezet rood, enzovoort. */
export type LoanCellTone = 'used' | 'unused' | Destination;

export interface LoanCell {
  /** Een datum als ISO-datum (2026-11-12); het bestand maakt er een echte Excel-datum van. */
  value: string | number | null;
  kind: LoanCellKind;
  tone?: LoanCellTone;
  /** Vet, zoals een totaal. */
  strong?: boolean;
}

export interface LoanSheet {
  sheet: string;
  title: string;
  header: string[];
  rows: LoanCell[][];
}

export const LOAN_EXPORT_HEADER = [
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
  'Datum retour',
  'Tijd retour',
  'Kilometerstand retour',
  'Retour gemeld door',
  'Vestiging',
];

const text = (value: string | null): LoanCell => ({ value: value ?? null, kind: 'text' });

function loanRow(loan: VehicleLoan, lookups: { groupName: (id: string) => string; personName: (id: string | null) => string }): LoanCell[] {
  const out = localMoment(loan.handedOutAt);
  const back = loan.returnedAt ? localMoment(loan.returnedAt) : null;
  return [
    text(formatPlate(loan.plate)),
    text(loan.model),
    { value: loan.odometerOut, kind: 'number' },
    { value: out.date, kind: 'date' },
    { value: out.time, kind: 'time' },
    { value: DESTINATION_LABELS[loan.destination], kind: 'text', tone: loan.destination },
    text(loan.handedTo),
    text(lookups.personName(loan.handedOutBy)),
    loan.wasUsed === null
      ? text(null)
      : { value: loan.wasUsed ? 'Ja' : 'Nee', kind: 'text', tone: loan.wasUsed ? 'used' : 'unused' },
    text([loan.note, loan.returnNote].filter(Boolean).join(' · ') || null),
    { value: back?.date ?? null, kind: 'date' },
    { value: back?.time ?? null, kind: 'time' },
    { value: loan.odometerIn, kind: 'number' },
    text(loan.returnedAt ? lookups.personName(loan.returnedBy) : null),
    text(lookups.groupName(loan.groupId)),
  ];
}

/** "12-11-2026" */
function dutchDate(date: string): string {
  return date.split('-').reverse().join('-');
}

export function loansExport(
  loans: readonly VehicleLoan[],
  lookups: { groupName: (id: string) => string; personName: (id: string | null) => string; now: Date },
): LoanSheet[] {
  const stand = localMoment(lookups.now.toISOString());
  const byNewest = [...loans].sort((a, b) => (a.handedOutAt < b.handedOutAt ? 1 : a.handedOutAt > b.handedOutAt ? -1 : 0));
  const open = byNewest.filter((loan) => !loan.returnedAt);
  const returned = byNewest.filter((loan) => loan.returnedAt);
  return [
    {
      sheet: 'Registratie',
      title: `Mobiliteit · nu uitgeleend · stand ${dutchDate(stand.date)} ${stand.time}`,
      header: LOAN_EXPORT_HEADER,
      rows: open.map((loan) => loanRow(loan, lookups)),
    },
    {
      sheet: 'Archief',
      title: `Mobiliteit · archief (retour, ingezet en niet ingezet) · stand ${dutchDate(stand.date)} ${stand.time}`,
      header: LOAN_EXPORT_HEADER,
      rows: returned.map((loan) => loanRow(loan, lookups)),
    },
  ];
}
