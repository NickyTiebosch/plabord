/**
 * Achterhaalde invallen (fase 2, besluit V10). Na een wijziging kijkt de engine per dag:
 * 1. Is de invaller zelf afwezig in een dagdeel van de inval, of werkt hij die dag niet meer?
 *    Dan "opnieuw regelen": het gat komt terug in Nog te regelen.
 * 2. Zit de vestiging zónder de inval op de norm? Dan "niet meer nodig". Zijn er meer van zulke
 *    invallen op één dag, dan vervalt de laatst ingeplande eerst, en daarna wordt opnieuw gekeken.
 * Invallen in het verleden blijven altijd ongemoeid. Er wordt nooit iets verwijderd.
 */
import { dayPartsOfAbsence, createScheduleContext } from './schedule';
import { createNormLookup, staffingOf } from './staffing';
import type { IsoDate, PlanningSnapshot, Substitution } from './types';

export type ReviewStatus = 'not_needed' | 'reschedule';

export interface ReviewChange {
  substitutionId: string;
  employeeId: string;
  date: IsoDate;
  groupId: string;
  status: ReviewStatus;
  /** Uitleg, bijvoorbeeld "is zelf afwezig". */
  reason: string;
}

/** Laatst ingepland eerst; bij gelijke tijd op id. */
function newestFirst(a: Substitution, b: Substitution): number {
  return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

export function reviewSubstitutions(snapshot: PlanningSnapshot, dates: Iterable<IsoDate>, today: IsoDate): ReviewChange[] {
  const days = [...new Set(dates)].filter((date) => date >= today).sort();
  const base = createScheduleContext(snapshot);
  const normOf = createNormLookup(snapshot.staffingNorms);
  const changes: ReviewChange[] = [];
  let remaining = snapshot.substitutions.filter((sub) => sub.status === 'active');

  for (const date of days) {
    const active = remaining.filter((sub) => sub.date === date && base.employeesById.has(sub.employeeId));
    if (active.length === 0) continue;
    const entries = base.entriesOn(date);
    const withdrawn = new Set<string>();

    // 1. Kan de invaller nog?
    for (const sub of [...active].sort(newestFirst)) {
      const absentParts = base.absencesOn(sub.employeeId, date).flatMap((absence) => dayPartsOfAbsence(absence.dayPart));
      const regular = entries.find((entry) => entry.employeeId === sub.employeeId && entry.kind === 'regular');
      let reason: string | null = null;
      if (sub.dayParts.some((part) => absentParts.includes(part))) reason = 'is zelf afwezig';
      else if (!regular || regular.closure) reason = 'werkt die dag niet meer';
      if (reason) {
        changes.push({ substitutionId: sub.id, employeeId: sub.employeeId, date, groupId: sub.groupId, status: 'reschedule', reason });
        withdrawn.add(sub.id);
      }
    }
    remaining = remaining.filter((sub) => !withdrawn.has(sub.id));

    // 2. Is de inval nog nodig? Laatst ingepland eerst.
    for (const sub of active.filter((item) => !withdrawn.has(item.id)).sort(newestFirst)) {
      const without = remaining.filter((item) => item.id !== sub.id);
      const context = createScheduleContext({ ...snapshot, substitutions: without });
      const staffing = staffingOf(context, normOf, date, sub.groupId);
      const enough = sub.dayParts.every((part) => {
        const partStaffing = staffing.parts.find((item) => item.dayPart === part);
        return !partStaffing || partStaffing.shortage === 0;
      });
      if (!enough) continue;
      const groupName = context.groupsById.get(sub.groupId)?.name ?? sub.groupId;
      changes.push({
        substitutionId: sub.id,
        employeeId: sub.employeeId,
        date,
        groupId: sub.groupId,
        status: 'not_needed',
        reason: staffing.closed ? `${groupName} is die dag gesloten` : `${groupName} zit zonder deze inval op de norm`,
      });
      remaining = without;
    }
  }
  return changes;
}
