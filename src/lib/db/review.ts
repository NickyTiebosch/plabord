import { reviewSubstitutions, type ReviewChange } from '../engine/review';
import type { IsoDate } from '../engine/types';
import type { Json } from './database.types';
import { loadPlanningSnapshot, type DbClient } from './queries';

/**
 * Na een wijziging die het rooster raakt: de invallen op die dagen controleren (besluit V10)
 * en de uitkomst in één transactie opslaan. Geeft de wijzigingen terug voor de melding.
 */
export async function reviewAfterChange(
  client: DbClient,
  dates: readonly IsoDate[],
  today: IsoDate,
): Promise<{ changes: ReviewChange[]; error: string | null }> {
  const days = [...new Set(dates)].filter((date) => date >= today).sort();
  const first = days[0];
  const last = days.at(-1);
  if (!first || !last) return { changes: [], error: null };
  const snapshot = await loadPlanningSnapshot(client, { from: first, to: last });
  const changes = reviewSubstitutions(snapshot, days, today);
  if (changes.length === 0) return { changes, error: null };
  const result = await client.rpc('apply_substitution_review', {
    changes: changes.map((change) => ({ id: change.substitutionId, status: change.status })) as unknown as Json,
  });
  return { changes, error: result.error ? 'De controle op invallen kon niet worden opgeslagen. Kijk op het overzicht.' : null };
}
