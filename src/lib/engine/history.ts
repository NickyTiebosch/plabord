/** Hoe vaak iemand is ingevallen (fase 2, besluit V7). */
import { addDays } from './dates';
import type { IsoDate, Substitution } from './types';

export const HISTORY_DAYS = 90;

/**
 * Per medewerker het aantal invallen dat doorgaat, in de 90 dagen vóór `date`.
 * Invallen die niet meer nodig zijn of opnieuw geregeld moeten worden, tellen niet mee.
 */
export function recentSubstitutionCounts(substitutions: readonly Substitution[], date: IsoDate): Map<string, number> {
  const from = addDays(date, -HISTORY_DAYS);
  const counts = new Map<string, number>();
  for (const sub of substitutions) {
    if (sub.status !== 'active' || sub.date < from || sub.date >= date) continue;
    counts.set(sub.employeeId, (counts.get(sub.employeeId) ?? 0) + 1);
  }
  return counts;
}
