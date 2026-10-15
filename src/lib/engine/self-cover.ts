/**
 * Zelf inspringen (besluit V40): de beheerder zet zichzelf op een dag aan de balie van een
 * vestiging met een gat, voor de dagdelen van dat gat. Dat wordt een roosterwijziging voor één dag
 * voor hemzelf, geen inval. Puur: wat er zou gebeuren, of waarom het niet kan.
 *
 * - Geen dienst die dag, of "geen dienst": een nieuwe dienst met de standaardtijden (`new`).
 * - Al aan de balie van dezelfde vestiging, in een ander dagdeel: de dienst wordt langer (`extend`).
 * - Een andere dienst: die vervalt voor die dag (`replace`). Telde hij daar aan een balie, dan staat
 *   erbij of die vestiging daardoor onder de norm zakt (`source`).
 */
import { weekdayOf } from './dates';
import { dayPartsOfAbsence, shiftTimesForDayParts, standardShiftFor, type ScheduleContext, type ShiftEntry } from './schedule';
import { countersAt, shortfallWithout, staffingOf, type NormLookup, type PartStaffing } from './staffing';
import { fromMinutes, toMinutes } from './time';
import { DAY_PARTS, type DayPart, type IsoDate, type Role, type ShiftTimes, type TimeOfDay } from './types';

export interface SelfCoverRequest {
  employeeId: string;
  date: IsoDate;
  /** De vestiging van het gat. */
  groupId: string;
  /** De dagdelen van het gat waarvoor je inspringt. */
  dayParts: readonly DayPart[];
  today: IsoDate;
}

export type SelfCoverMode = 'new' | 'extend' | 'replace';

/** Je rooster van die dag, vóór het inspringen. */
export type SelfCoverCurrent =
  | { kind: 'none' }
  | { kind: 'off' }
  | { kind: 'shift'; groupId: string; role: Role; times: ShiftTimes };

export interface SelfCoverPlan {
  ok: true;
  mode: SelfCoverMode;
  groupId: string;
  dayParts: DayPart[];
  /** De nieuwe dienst van die dag. */
  times: ShiftTimes;
  /** Wat er wordt opgeslagen: leeg = de standaardtijd van die weekdag. */
  stored: { startTime: TimeOfDay | null; endTime: TimeOfDay | null };
  current: SelfCoverCurrent;
  /** Stond je aan een andere balie: die vestiging, en de dagdelen waarin ze zonder jou onder de norm zakt. */
  source: { groupId: string; shortfall: PartStaffing[] } | null;
  /** Alles wat je in de vraag vooraf ziet. Het formulier stuurt hem mee, zodat je akkoord daarbij hoort. */
  key: string;
}

export type SelfCoverCode =
  | 'past'
  | 'no_counter'
  | 'no_gap'
  | 'inactive'
  | 'absent'
  | 'substituting'
  | 'already_there'
  | 'no_times';

export interface SelfCoverRefusal {
  ok: false;
  code: SelfCoverCode;
  /** De dagdelen waar het om gaat: waarin je afwezig bent, al daar staat, of die geen tijden hebben. */
  dayParts: DayPart[];
  /** Bij `substituting`: waar je die dag al invalt. Bij `already_there`: de vestiging van het gat. */
  groupId: string | null;
}

function refuse(code: SelfCoverCode, dayParts: DayPart[] = [], groupId: string | null = null): SelfCoverRefusal {
  return { ok: false, code, dayParts, groupId };
}

function timesKey(times: ShiftTimes): string {
  return `${times.start}-${times.end}`;
}

function currentKey(current: SelfCoverCurrent): string {
  return current.kind === 'shift' ? `${current.groupId}:${current.role}:${timesKey(current.times)}` : current.kind;
}

export function planSelfCover(
  context: ScheduleContext,
  normOf: NormLookup,
  request: SelfCoverRequest,
  entries: readonly ShiftEntry[] = context.entriesOn(request.date),
): SelfCoverPlan | SelfCoverRefusal {
  const { employeeId, date, groupId } = request;
  const dayParts = DAY_PARTS.filter((part) => request.dayParts.includes(part));

  if (date < request.today) return refuse('past');
  if (context.groupsById.get(groupId)?.hasCounter !== true) return refuse('no_counter');
  const staffing = staffingOf(context, normOf, date, groupId, entries);
  const short = (part: DayPart) => staffing.parts.some((item) => item.dayPart === part && item.shortage > 0);
  if (dayParts.length === 0 || !dayParts.every(short)) return refuse('no_gap');
  if (!context.employeesById.has(employeeId)) return refuse('inactive');

  const absentParts = context.absencesOn(employeeId, date).flatMap((absence) => dayPartsOfAbsence(absence.dayPart));
  const absentInGap = dayParts.filter((part) => absentParts.includes(part));
  if (absentInGap.length > 0) return refuse('absent', absentInGap);

  const own = entries.filter((entry) => entry.employeeId === employeeId);
  const lent = own.find((entry) => entry.kind === 'substitution');
  if (lent) return refuse('substituting', [], lent.groupId);

  const alreadyThere = dayParts.filter((part) => countersAt(entries, groupId, part).includes(employeeId));
  if (alreadyThere.length > 0) return refuse('already_there', alreadyThere, groupId);

  const weekday = weekdayOf(date);
  const gapTimes = shiftTimesForDayParts(context.settings, weekday, dayParts);
  if (!gapTimes) return refuse('no_times', dayParts);

  const regular = own.find((entry) => entry.kind === 'regular');
  const current: SelfCoverCurrent = regular
    ? { kind: 'shift', groupId: regular.groupId, role: regular.role, times: { start: regular.start, end: regular.end } }
    : context.overrideOn(employeeId, date)?.kind === 'off'
      ? { kind: 'off' }
      : { kind: 'none' };

  let mode: SelfCoverMode = 'new';
  let times = gapTimes;
  let source: SelfCoverPlan['source'] = null;
  if (regular && regular.groupId === groupId && regular.role === 'counter' && !regular.closure) {
    mode = 'extend';
    times = {
      start: fromMinutes(Math.min(toMinutes(regular.start), toMinutes(gapTimes.start))),
      end: fromMinutes(Math.max(toMinutes(regular.end), toMinutes(gapTimes.end))),
    };
  } else if (regular) {
    mode = 'replace';
    if (regular.countsForCounter) {
      source = {
        groupId: regular.groupId,
        shortfall: shortfallWithout(entries, normOf, date, regular.groupId, employeeId, regular.workingParts),
      };
    }
  }

  const standard = standardShiftFor(context.settings, weekday);
  const isStandard = times.start === standard.start && times.end === standard.end;
  const sourceKey = source
    ? `${source.groupId}:${source.shortfall.map((part) => `${part.dayPart}:${part.count}/${part.norm}`).join(',')}`
    : '-';
  return {
    ok: true,
    mode,
    groupId,
    dayParts,
    times,
    stored: isStandard ? { startTime: null, endTime: null } : { startTime: times.start, endTime: times.end },
    current,
    source,
    key: [mode, currentKey(current), groupId, dayParts.join('+'), timesKey(times), sourceKey].join('|'),
  };
}
