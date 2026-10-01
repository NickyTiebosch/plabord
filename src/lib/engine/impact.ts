/**
 * Impactcheck (fase 2): wat gebeurt er met de bezetting als deze afwezigheid wordt opgeslagen?
 * De engine vergelijkt het rooster vóór en na, vanaf vandaag, en geeft per dagdeel dat onder de
 * norm zakt (of verder zakt) het eerste voorstel. Plus de invallen die daardoor vervallen.
 * Opslaan mag altijd; dit is alleen informatie voor de beheerder.
 */
import { findCandidates } from './candidates';
import { eachDay, addDays } from './dates';
import { reviewSubstitutions, type ReviewChange } from './review';
import { createScheduleContext } from './schedule';
import { counterLocations, createNormLookup, staffingOf } from './staffing';
import type { Absence, DayPart, IsoDate, PlanningSnapshot } from './types';

/** Langer dan dit kijkt de check niet vooruit (ruim een jaar). */
export const IMPACT_MAX_DAYS = 400;

export interface ImpactPart {
  date: IsoDate;
  groupId: string;
  dayPart: DayPart;
  before: number;
  after: number;
  norm: number;
  /** Naam van het eerste voorstel, of `null` als niemand kan invallen. */
  proposal: string | null;
}

export interface AbsenceImpact {
  parts: ImpactPart[];
  /** Invallen die "opnieuw regelen" of "niet meer nodig" worden. */
  changes: ReviewChange[];
}

export interface AbsenceChange {
  /** De afwezigheid zoals die nu is opgeslagen; `null` bij een nieuwe. */
  previous: Absence | null;
  /** De afwezigheid zoals die wordt; `null` bij verwijderen. */
  next: Absence | null;
}

/** Datums van een wijziging (oud en nieuw samen), vanaf vandaag en hooguit IMPACT_MAX_DAYS vooruit. */
export function changedDates(ranges: readonly (Pick<Absence, 'startDate' | 'endDate'> | null)[], today: IsoDate): IsoDate[] {
  const last = addDays(today, IMPACT_MAX_DAYS);
  const dates = new Set<IsoDate>();
  for (const range of ranges) {
    if (!range) continue;
    const from = range.startDate > today ? range.startDate : today;
    const to = range.endDate < last ? range.endDate : last;
    if (from > to) continue;
    for (const date of eachDay(from, to)) dates.add(date);
  }
  return [...dates].sort();
}

/** Het rooster na de wijziging: de oude afwezigheid eruit, de nieuwe erin. */
export function applyAbsenceChange(snapshot: PlanningSnapshot, change: AbsenceChange): PlanningSnapshot {
  const others = snapshot.absences.filter((absence) => absence.id !== change.previous?.id && absence.id !== change.next?.id);
  return { ...snapshot, absences: change.next ? [...others, change.next] : others };
}

export function absenceImpact(snapshot: PlanningSnapshot, change: AbsenceChange, today: IsoDate): AbsenceImpact {
  const dates = changedDates([change.previous, change.next], today);
  const before = createScheduleContext(snapshot);
  const afterSnapshot = applyAbsenceChange(snapshot, change);
  const after = createScheduleContext(afterSnapshot);
  const normOf = createNormLookup(snapshot.staffingNorms);
  const locations = counterLocations(before);
  const parts: ImpactPart[] = [];

  for (const date of dates) {
    const beforeEntries = before.entriesOn(date);
    const afterEntries = after.entriesOn(date);
    for (const group of locations) {
      const was = staffingOf(before, normOf, date, group.id, beforeEntries);
      const now = staffingOf(after, normOf, date, group.id, afterEntries);
      for (const part of now.parts) {
        const old = was.parts.find((item) => item.dayPart === part.dayPart);
        if (!old || part.count >= old.count || part.shortage === 0) continue;
        const [first] = findCandidates(after, normOf, afterSnapshot.substitutions, {
          date,
          groupId: group.id,
          dayParts: [part.dayPart],
        });
        parts.push({
          date,
          groupId: group.id,
          dayPart: part.dayPart,
          before: old.count,
          after: part.count,
          norm: part.norm,
          proposal: first?.name ?? null,
        });
      }
    }
  }
  return { parts, changes: reviewSubstitutions(afterSnapshot, dates, today) };
}
