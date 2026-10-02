import { reviewSubstitutions, type ReviewChange } from '../engine/review';
import { createScheduleContext, dayPartsOfAbsence } from '../engine/schedule';
import type { IsoDate, PlanningSnapshot } from '../engine/types';
import { cancelledSubstitutionNotices } from '../mail/notices';
import type { MailNotice } from '../mail/types';
import type { Json } from './database.types';
import { loadPlanningSnapshot, type DbClient } from './queries';

export interface ReviewResult {
  changes: ReviewChange[];
  error: string | null;
  /** Mails aan invallers van wie de inval niet meer doorgaat (fase 3, V14). */
  notices: MailNotice[];
}

/**
 * Mails voor vervallen invallen (V14): niet aan wie zelf afwezig is in een dagdeel van die inval.
 * Die weet al dat hij niet komt.
 */
export function reviewNotices(snapshot: PlanningSnapshot, changes: readonly ReviewChange[]): MailNotice[] {
  const context = createScheduleContext(snapshot);
  const substitutions = new Map(snapshot.substitutions.map((sub) => [sub.id, sub]));
  const absent = new Set(
    changes
      .filter((change) => {
        const parts = new Set(context.absencesOn(change.employeeId, change.date).flatMap((mark) => dayPartsOfAbsence(mark.dayPart)));
        const own = substitutions.get(change.substitutionId)?.dayParts ?? ['morning', 'afternoon'];
        return own.some((part) => parts.has(part));
      })
      .map((change) => `${change.employeeId}|${change.date}`),
  );
  return cancelledSubstitutionNotices(changes, (employeeId, date) => absent.has(`${employeeId}|${date}`));
}

/**
 * Na een wijziging die het rooster raakt: de invallen op die dagen controleren (besluit V10)
 * en de uitkomst in één transactie opslaan. Geeft de wijzigingen terug voor de melding, en de
 * mails voor de invallers.
 */
export async function reviewAfterChange(client: DbClient, dates: readonly IsoDate[], today: IsoDate): Promise<ReviewResult> {
  const days = [...new Set(dates)].filter((date) => date >= today).sort();
  const first = days[0];
  const last = days.at(-1);
  if (!first || !last) return { changes: [], error: null, notices: [] };
  const snapshot = await loadPlanningSnapshot(client, { from: first, to: last });
  const changes = reviewSubstitutions(snapshot, days, today);
  if (changes.length === 0) return { changes, error: null, notices: [] };
  const result = await client.rpc('apply_substitution_review', {
    changes: changes.map((change) => ({ id: change.substitutionId, status: change.status })) as unknown as Json,
  });
  if (result.error) {
    return { changes, error: 'De controle op invallen kon niet worden opgeslagen. Kijk op het overzicht.', notices: [] };
  }
  return { changes, error: null, notices: reviewNotices(snapshot, changes) };
}
