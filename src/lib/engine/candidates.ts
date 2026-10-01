/**
 * Kandidaten voor een inval (fase 2): wie mag er invallen, in welke volgorde, en waarom.
 *
 * Iemand is kandidaat als alles klopt:
 * - actief en inzetbaar aan de balie in de vestiging van het gat;
 * - die dag de hele dag ingeroosterd (ochtend én middag), en zijn groep is open;
 * - die dag niet afwezig, ook niet half (aangevraagd telt ook);
 * - die dag nog niet ingeleend;
 * - zijn rol die dag is niet poets;
 * - zijn groep die dag is een andere dan de vestiging van het gat (besluit V9);
 * - komt hij uit een andere vestiging waar hij aan de balie telt, dan zit die vestiging
 *   zonder hem nog op de norm in alle dagdelen van de inval.
 * Volgorde: invalvolgorde van de groep van die dag, dan het minst ingevallen in 90 dagen,
 * dan naam, dan id. Dezelfde gegevens geven dus altijd dezelfde volgorde.
 */
import { formatDayShort } from './format';
import { recentSubstitutionCounts } from './history';
import { DAY_PART_LABELS, ROLE_LABELS } from './labels';
import type { ScheduleContext, ShiftEntry } from './schedule';
import { compareNames } from './sort';
import { countersAt, type NormLookup } from './staffing';
import type { DayPart, Group, IsoDate, Role, Substitution } from './types';

/** Het aantal voorstellen per gat. */
export const PROPOSAL_COUNT = 3;

export interface CandidateRequest {
  date: IsoDate;
  /** De vestiging van het gat. */
  groupId: string;
  /** De dagdelen van de inval. */
  dayParts: readonly DayPart[];
}

export interface Candidate {
  employeeId: string;
  name: string;
  /** Groep en rol van die dag. */
  dayGroupId: string;
  dayRole: Role;
  /** Invalvolgorde van de groep van die dag: lager = eerder aan de beurt. */
  rank: number;
  /** Aantal invallen in de 90 dagen vóór de datum. */
  recentCount: number;
  /** Komt uit een andere vestiging en telt daar aan de balie. */
  fromLocation: boolean;
  /** Uitlegregel, bijvoorbeeld "Danique (backoffice): werkt die dag en mag in Eindhoven invallen; 1× ingevallen in 90 dagen." */
  explanation: string;
}

export interface Exclusion {
  employeeId: string;
  name: string;
  /** Waarom deze collega niet kan, bijvoorbeeld "is die dag afwezig". */
  reason: string;
}

export interface CandidateEvaluation {
  candidates: Candidate[];
  /** Wie wel inzetbaar is in die vestiging, maar nu afvalt. Op naam. */
  excluded: Exclusion[];
}

/** "backoffice", "overig", "logistiek", of bij een vestiging "balie Den Bosch". */
export function dayGroupLabel(group: Group | undefined, role: Role): string {
  if (!group) return ROLE_LABELS[role];
  return group.hasCounter ? `${ROLE_LABELS[role]} ${group.name}` : group.name.toLocaleLowerCase('nl');
}

function joinParts(parts: readonly DayPart[]): string {
  return parts.map((part) => DAY_PART_LABELS[part]).join(' en ');
}

export function evaluateCandidates(
  context: ScheduleContext,
  normOf: NormLookup,
  substitutions: readonly Substitution[],
  request: CandidateRequest,
  entries: readonly ShiftEntry[] = context.entriesOn(request.date),
): CandidateEvaluation {
  const { date, groupId, dayParts } = request;
  const target = context.groupsById.get(groupId);
  const counts = recentSubstitutionCounts(substitutions, date);
  const candidates: Candidate[] = [];
  const excluded: Exclusion[] = [];

  for (const employee of context.employeesById.values()) {
    if (!employee.counterGroupIds.includes(groupId)) continue;
    const exclude = (reason: string) => excluded.push({ employeeId: employee.id, name: employee.name, reason });

    const own = entries.filter((entry) => entry.employeeId === employee.id);
    const regular = own.find((entry) => entry.kind === 'regular');
    if (!regular) {
      exclude('werkt die dag niet');
      continue;
    }
    const dayGroup = context.groupsById.get(regular.groupId);
    if (regular.closure) {
      exclude(`${dayGroup?.name ?? 'de eigen groep'} is die dag gesloten`);
      continue;
    }
    if (!(regular.dayParts.includes('morning') && regular.dayParts.includes('afternoon'))) {
      exclude('werkt die dag niet de hele dag');
      continue;
    }
    if (context.absencesOn(employee.id, date).length > 0) {
      exclude('is die dag afwezig');
      continue;
    }
    if (own.some((entry) => entry.kind === 'substitution')) {
      exclude('valt die dag al ergens in');
      continue;
    }
    if (regular.role === 'cleaning') {
      exclude('heeft die dag de rol poets');
      continue;
    }
    if (regular.groupId === groupId) {
      exclude(`werkt die dag al in ${target?.name ?? 'deze vestiging'}`);
      continue;
    }

    const fromLocation = dayGroup?.hasCounter === true && regular.countsForCounter;
    if (fromLocation) {
      const shortParts = dayParts.filter(
        (part) =>
          regular.workingParts.includes(part) &&
          countersAt(entries, regular.groupId, part).length - 1 < normOf(regular.groupId, date, part),
      );
      if (shortParts.length > 0) {
        exclude(`${dayGroup.name} zakt dan onder de norm (${joinParts(shortParts)})`);
        continue;
      }
    }

    const recentCount = counts.get(employee.id) ?? 0;
    const label = dayGroupLabel(dayGroup, regular.role);
    const normNote = fromLocation ? `${dayGroup.name} blijft op de norm; ` : '';
    candidates.push({
      employeeId: employee.id,
      name: employee.name,
      dayGroupId: regular.groupId,
      dayRole: regular.role,
      rank: dayGroup?.substitutionRank ?? Number.MAX_SAFE_INTEGER,
      recentCount,
      fromLocation,
      explanation: `${employee.name} (${label}): werkt die dag en mag in ${target?.name ?? groupId} invallen; ${normNote}${recentCount}× ingevallen in 90 dagen.`,
    });
  }

  candidates.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.recentCount - b.recentCount ||
      compareNames(a.name, b.name) ||
      (a.employeeId < b.employeeId ? -1 : a.employeeId > b.employeeId ? 1 : 0),
  );
  excluded.sort(
    (a, b) => compareNames(a.name, b.name) || (a.employeeId < b.employeeId ? -1 : a.employeeId > b.employeeId ? 1 : 0),
  );
  return { candidates, excluded };
}

/** De geldige kandidaten, in de vaste volgorde. */
export function findCandidates(
  context: ScheduleContext,
  normOf: NormLookup,
  substitutions: readonly Substitution[],
  request: CandidateRequest,
): Candidate[] {
  return evaluateCandidates(context, normOf, substitutions, request).candidates;
}

/** Korte omschrijving van een gat of inval: "Eindhoven, wo 14 okt, ochtend en middag". */
export function describeSlot(context: ScheduleContext, request: CandidateRequest): string {
  const name = context.groupsById.get(request.groupId)?.name ?? request.groupId;
  return `${name}, ${formatDayShort(request.date)}, ${joinParts(request.dayParts)}`;
}
