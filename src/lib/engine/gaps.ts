/**
 * Gaten (fase 2): een vestiging zit in een dagdeel onder de norm. Geen gat betekent geen actie.
 * De dagdelen met een tekort van één vestiging op één dag staan samen in één gat.
 */
import { eachDay } from './dates';
import type { ScheduleContext } from './schedule';
import { counterLocations, staffingOf, type NormLookup, type PartStaffing } from './staffing';
import type { GapDismissal, IsoDate } from './types';

export interface Gap {
  date: IsoDate;
  groupId: string;
  /** Alleen de dagdelen met een tekort, ochtend vóór middag. */
  parts: PartStaffing[];
}

export interface GapScan {
  /** Te regelen. */
  gaps: Gap[];
  /** Genegeerd, en het tekort is niet groter geworden (besluit V8). */
  ignored: Gap[];
}

/** Alle gaten van `from` t/m `to`, op datum en daarna in de vaste volgorde van de vestigingen. */
export function findGaps(
  context: ScheduleContext,
  normOf: NormLookup,
  from: IsoDate,
  to: IsoDate,
  dismissals: readonly GapDismissal[] = [],
): GapScan {
  const dismissed = new Map(dismissals.map((item) => [`${item.groupId}|${item.date}|${item.dayPart}`, item.shortage]));
  const locations = counterLocations(context);
  const gaps: Gap[] = [];
  const ignored: Gap[] = [];
  for (const date of eachDay(from, to)) {
    const entries = context.entriesOn(date);
    for (const group of locations) {
      const short = staffingOf(context, normOf, date, group.id, entries).parts.filter((part) => part.shortage > 0);
      if (short.length === 0) continue;
      const open: PartStaffing[] = [];
      const hidden: PartStaffing[] = [];
      for (const part of short) {
        const ignoredAt = dismissed.get(`${group.id}|${date}|${part.dayPart}`);
        if (ignoredAt !== undefined && part.shortage <= ignoredAt) hidden.push(part);
        else open.push(part);
      }
      if (open.length > 0) gaps.push({ date, groupId: group.id, parts: open });
      if (hidden.length > 0) ignored.push({ date, groupId: group.id, parts: hidden });
    }
  }
  return { gaps, ignored };
}
