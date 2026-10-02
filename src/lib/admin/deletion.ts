/**
 * Een medewerker volledig verwijderen (fase 3, besluit V21). Puur: wat er verdwijnt, of het mag,
 * en of de getypte naam klopt. Verwijderen zelf doen de server action en `delete_employee`.
 */
import { normalizeName } from '../engine/sort';

export interface DeletionCounts {
  recurringShifts: number;
  absences: number;
  substitutions: number;
  /** Invallen vanaf vandaag die nog doorgaan: die gaten komen terug in Nog te regelen. */
  upcomingSubstitutions: number;
  shiftOverrides: number;
  calendarFeeds: number;
  /** Toestellen met meldingen aan (fase 4). */
  pushDevices: number;
  account: boolean;
}

function counted(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Wat er verdwijnt, in gewone zinnen. */
export function deletionSummary(counts: DeletionCounts): string[] {
  const lines: string[] = [];
  if (counts.recurringShifts > 0) lines.push(counted(counts.recurringShifts, 'vaste dienst', 'vaste diensten'));
  if (counts.absences > 0) lines.push(counted(counts.absences, 'afwezigheid', 'afwezigheden'));
  if (counts.substitutions > 0) {
    const upcoming =
      counts.upcomingSubstitutions === 0
        ? ''
        : counts.upcomingSubstitutions === 1
          ? ', waarvan 1 nog komt: dat gat komt terug in Nog te regelen'
          : `, waarvan ${counts.upcomingSubstitutions} nog komen: die gaten komen terug in Nog te regelen`;
    lines.push(`${counted(counts.substitutions, 'inval', 'invallen')}${upcoming}`);
  }
  if (counts.shiftOverrides > 0) lines.push(counted(counts.shiftOverrides, 'roosterwijziging', 'roosterwijzigingen'));
  if (counts.calendarFeeds > 0) lines.push(counted(counts.calendarFeeds, 'agendalink', 'agendalinks'));
  if (counts.pushDevices > 0) lines.push(`meldingen op ${counted(counts.pushDevices, 'toestel', 'toestellen')}`);
  if (counts.account) lines.push('het inlogaccount en de werkmail');
  return lines;
}

/** Mag deze medewerker nu volledig verwijderd worden? Anders de reden. */
export function deletionBlocker(target: { id: string; isActive: boolean }, viewerEmployeeId: string): string | null {
  if (target.id === viewerEmployeeId) return 'Je kunt jezelf niet verwijderen.';
  if (target.isActive) return 'Zet de medewerker eerst op inactief. Pas dan kan volledig verwijderen.';
  return null;
}

/** Klopt de getypte naam? Hoofdletters en spaties aan begin en eind tellen niet mee. */
export function confirmsName(typed: unknown, name: string): boolean {
  return typeof typed === 'string' && typed.trim() !== '' && normalizeName(typed) === normalizeName(name);
}
