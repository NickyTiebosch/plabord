/**
 * Vaste diensten wijzigen zonder het verleden te veranderen. Pure functies: ze bepalen welke
 * wijzigingen nodig zijn; de server action voert ze in deze volgorde uit.
 */
import { addDays, isWithin } from '../engine/dates';
import { weekdayLong } from '../engine/format';
import { SHIFT_WEEKDAYS, type IsoDate, type RecurringShift, type Role, type ShiftWeekday, type TimeOfDay } from '../engine/types';

export interface ShiftValues {
  weekday: ShiftWeekday;
  groupId: string;
  role: Role;
  startTime: TimeOfDay | null;
  endTime: TimeOfDay | null;
  validFrom: IsoDate;
  validTo: IsoDate | null;
}

type ShiftUpdateValues = Pick<ShiftValues, 'groupId' | 'role' | 'startTime' | 'endTime'>;

export type ShiftOp =
  | { type: 'close'; id: string; validTo: IsoDate }
  | { type: 'update'; id: string; values: ShiftUpdateValues }
  | { type: 'insert'; values: ShiftValues };

export type ShiftPlan = { ok: true; ops: ShiftOp[] } | { ok: false; error: string };

/** Dezelfde vaste dienst op een of meer weekdagen. */
export type ShiftDaysInput = Omit<ShiftValues, 'weekday' | 'validTo'> & { weekdays: readonly ShiftWeekday[] };

/** "maandag, woensdag en vrijdag" */
export function weekdayList(weekdays: readonly ShiftWeekday[]): string {
  const names = weekdays.map((weekday) => weekdayLong(weekday));
  const last = names.pop();
  if (last === undefined) return '';
  return names.length === 0 ? last : `${names.join(', ')} en ${last}`;
}

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

/**
 * Dezelfde vaste dienst op meerdere weekdagen, vanaf één datum. Dagen die niet zijn gekozen,
 * blijven zoals ze zijn: een vaste vrije dag is gewoon een dag zonder vaste dienst.
 */
export function planShiftsFrom(existing: readonly RecurringShift[], { weekdays, ...values }: ShiftDaysInput): ShiftPlan {
  const ops: ShiftOp[] = [];
  for (const weekday of weekdays) {
    const plan = planShiftFrom(existing, { ...values, weekday });
    if (!plan.ok) return plan;
    ops.push(...plan.ops);
  }
  return { ok: true, ops };
}

/** Een vaste dienst stopt na `lastDay` (die dag werkt iemand nog). */
export function planShiftEnd(existing: readonly RecurringShift[], weekday: ShiftWeekday, lastDay: IsoDate): ShiftPlan {
  const day = weekdayLong(weekday);
  const shifts = sameWeekday(existing, weekday);
  const covering = shifts.find((shift) => isWithin(lastDay, shift.validFrom, shift.validTo));
  if (!covering) return { ok: false, error: `Op ${day} is er op die datum geen vaste dienst.` };
  if (shifts.some((shift) => shift.validFrom > lastDay)) {
    return { ok: false, error: `Op ${day} staat al een latere vaste dienst. Verwijder of wijzig die eerst.` };
  }
  if (covering.validTo !== null && covering.validTo <= lastDay) {
    return { ok: false, error: `De dienst op ${day} stopt al eerder.` };
  }
  return { ok: true, ops: [{ type: 'close', id: covering.id, validTo: lastDay }] };
}

/** Vaste diensten op meerdere weekdagen laten stoppen. Kan het op één dag niet, dan verandert er niets. */
export function planShiftsEnd(existing: readonly RecurringShift[], weekdays: readonly ShiftWeekday[], lastDay: IsoDate): ShiftPlan {
  const ops: ShiftOp[] = [];
  for (const weekday of weekdays) {
    const plan = planShiftEnd(existing, weekday, lastDay);
    if (!plan.ok) return { ok: false, error: `${plan.error} Er is niets gewijzigd.` };
    ops.push(...plan.ops);
  }
  return { ok: true, ops };
}

export type ShiftBatch =
  | { type: 'close'; ids: string[]; validTo: IsoDate }
  | { type: 'update'; ids: string[]; values: ShiftUpdateValues }
  | { type: 'insert'; rows: ShiftValues[] };

/**
 * Bundelt de stappen tot zo weinig mogelijk databasebewerkingen, in een vaste volgorde: eerst
 * diensten laten stoppen, dan aanpassen, dan toevoegen. Zo overlapt een nieuwe dienst nooit met
 * een dienst die nog moet stoppen.
 */
export function batchShiftOps(ops: readonly ShiftOp[]): ShiftBatch[] {
  const closes = new Map<IsoDate, string[]>();
  const updates = new Map<string, { ids: string[]; values: ShiftUpdateValues }>();
  const rows: ShiftValues[] = [];
  for (const op of ops) {
    if (op.type === 'close') {
      closes.set(op.validTo, [...(closes.get(op.validTo) ?? []), op.id]);
    } else if (op.type === 'update') {
      const { groupId, role, startTime, endTime } = op.values;
      const key = JSON.stringify([groupId, role, startTime, endTime]);
      const batch = updates.get(key);
      if (batch) batch.ids.push(op.id);
      else updates.set(key, { ids: [op.id], values: op.values });
    } else {
      rows.push(op.values);
    }
  }
  return [
    ...[...closes].map(([validTo, ids]): ShiftBatch => ({ type: 'close', ids, validTo })),
    ...[...updates.values()].map(({ ids, values }): ShiftBatch => ({ type: 'update', ids, values })),
    ...(rows.length > 0 ? [{ type: 'insert', rows } satisfies ShiftBatch] : []),
  ];
}

export interface WeekdayShifts {
  weekday: ShiftWeekday;
  current: RecurringShift | null;
  upcoming: RecurringShift[];
  past: RecurringShift[];
}

/** Per weekdag: wat nu geldt, wat nog komt en wat voorbij is. */
export function shiftsByWeekday(existing: readonly RecurringShift[], today: IsoDate): WeekdayShifts[] {
  return SHIFT_WEEKDAYS.map((weekday) => {
    const shifts = sameWeekday(existing, weekday);
    return {
      weekday,
      current: shifts.find((shift) => isWithin(today, shift.validFrom, shift.validTo)) ?? null,
      upcoming: shifts.filter((shift) => shift.validFrom > today),
      past: shifts.filter((shift) => shift.validTo !== null && shift.validTo < today).reverse(),
    };
  });
}
