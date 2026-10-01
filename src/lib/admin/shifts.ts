/**
 * Vaste diensten wijzigen zonder het verleden te veranderen. Pure functies: ze bepalen welke
 * wijzigingen nodig zijn; de server action voert ze in deze volgorde uit.
 */
import { addDays, isWithin } from '../engine/dates';
import type { IsoDate, RecurringShift, Role, ShiftWeekday, TimeOfDay } from '../engine/types';

export interface ShiftValues {
  weekday: ShiftWeekday;
  groupId: string;
  role: Role;
  startTime: TimeOfDay | null;
  endTime: TimeOfDay | null;
  validFrom: IsoDate;
  validTo: IsoDate | null;
}

export type ShiftOp =
  | { type: 'close'; id: string; validTo: IsoDate }
  | { type: 'update'; id: string; values: Pick<ShiftValues, 'groupId' | 'role' | 'startTime' | 'endTime'> }
  | { type: 'insert'; values: ShiftValues };

export type ShiftPlan = { ok: true; ops: ShiftOp[] } | { ok: false; error: string };

function sameWeekday(existing: readonly RecurringShift[], weekday: ShiftWeekday): RecurringShift[] {
  return existing
    .filter((shift) => shift.weekday === weekday)
    .sort((a, b) => (a.validFrom < b.validFrom ? -1 : a.validFrom > b.validFrom ? 1 : 0));
}

/**
 * Een vaste dienst die geldt vanaf een datum. Een dienst die op die datum loopt, eindigt de dag
 * ervoor; begint er later al een andere dienst, dan eindigt de nieuwe de dag daarvoor.
 * Begint de lopende dienst precies op die datum, dan passen we die aan.
 */
export function planShiftFrom(
  existing: readonly RecurringShift[],
  input: Omit<ShiftValues, 'validTo'>,
): ShiftPlan {
  const shifts = sameWeekday(existing, input.weekday);
  const covering = shifts.find((shift) => isWithin(input.validFrom, shift.validFrom, shift.validTo));
  const values = { groupId: input.groupId, role: input.role, startTime: input.startTime, endTime: input.endTime };

  if (covering && covering.validFrom === input.validFrom) {
    return { ok: true, ops: [{ type: 'update', id: covering.id, values }] };
  }
  const next = shifts.find((shift) => shift.validFrom > input.validFrom);
  const ops: ShiftOp[] = [];
  if (covering) ops.push({ type: 'close', id: covering.id, validTo: addDays(input.validFrom, -1) });
  ops.push({ type: 'insert', values: { ...input, validTo: next ? addDays(next.validFrom, -1) : null } });
  return { ok: true, ops };
}

/** Een vaste dienst stopt na `lastDay` (die dag werkt iemand nog). */
export function planShiftEnd(existing: readonly RecurringShift[], weekday: ShiftWeekday, lastDay: IsoDate): ShiftPlan {
  const shifts = sameWeekday(existing, weekday);
  const covering = shifts.find((shift) => isWithin(lastDay, shift.validFrom, shift.validTo));
  if (!covering) return { ok: false, error: 'Op die datum is er geen vaste dienst op deze dag.' };
  if (shifts.some((shift) => shift.validFrom > lastDay)) {
    return { ok: false, error: 'Er staat al een latere vaste dienst op deze dag. Verwijder of wijzig die eerst.' };
  }
  if (covering.validTo !== null && covering.validTo <= lastDay) {
    return { ok: false, error: 'Deze dienst stopt al eerder.' };
  }
  return { ok: true, ops: [{ type: 'close', id: covering.id, validTo: lastDay }] };
}

export interface WeekdayShifts {
  weekday: ShiftWeekday;
  current: RecurringShift | null;
  upcoming: RecurringShift[];
  past: RecurringShift[];
}

/** Per weekdag: wat nu geldt, wat nog komt en wat voorbij is. */
export function shiftsByWeekday(existing: readonly RecurringShift[], today: IsoDate): WeekdayShifts[] {
  return ([1, 2, 3, 4, 5, 6] as const).map((weekday) => {
    const shifts = sameWeekday(existing, weekday);
    return {
      weekday,
      current: shifts.find((shift) => isWithin(today, shift.validFrom, shift.validTo)) ?? null,
      upcoming: shifts.filter((shift) => shift.validFrom > today),
      past: shifts.filter((shift) => shift.validTo !== null && shift.validTo < today).reverse(),
    };
  });
}
