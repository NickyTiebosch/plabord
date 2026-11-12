/**
 * De stand van de uitleen (fase 5): wanneer een auto te lang uit staat, de controle per werkdag en
 * de auto's die je opnieuw kunt uitgeven. Puur: gegevens en "nu" komen binnen als parameter.
 */
import type { ClosureResolver } from '../engine/closures';
import { addDays, weekdayOf } from '../engine/dates';
import { formatDayShort } from '../engine/format';
import { toMinutes } from '../engine/time';
import type { IsoDate, TimeOfDay } from '../engine/types';
import { localMoment } from './time';
import type { Destination, LoanGroup, VehicleLoan } from './types';

/** Werkdag voor de uitleen: maandag t/m vrijdag, en de vestiging is niet dicht. */
export function isLoanWorkday(date: IsoDate, groupId: string, closures: ClosureResolver): boolean {
  return weekdayOf(date) <= 5 && !closures(date, groupId).closed;
}

/** De eerste werkdag ná `date`. Na hooguit drie weken zonder werkdag: de dag erna (vangnet). */
export function nextLoanWorkday(date: IsoDate, groupId: string, closures: ClosureResolver): IsoDate {
  for (let offset = 1; offset <= 21; offset++) {
    const candidate = addDays(date, offset);
    if (isLoanWorkday(candidate, groupId, closures)) return candidate;
  }
  return addDays(date, 1);
}

/**
 * Wanneer een auto uiterlijk terug moet zijn gemeld (V48): aan het eind van de eerstvolgende werkdag
 * na het meegeven. Voor Mobiliteit is dat de volgende werkdag, voor de werkplaats in het weekend de
 * maandag erna. Sluitingsdagen tellen niet mee.
 */
export function loanDueDate(loan: Pick<VehicleLoan, 'handedOutAt' | 'groupId'>, closures: ClosureResolver): IsoDate {
  return nextLoanWorkday(localMoment(loan.handedOutAt).date, loan.groupId, closures);
}

/** Staat de auto te lang uit? Pas na het einde van de werkdag (`endOfDay`, de standaarddienst) van de uiterste dag. */
export function isOverdue(
  loan: Pick<VehicleLoan, 'handedOutAt' | 'groupId' | 'returnedAt'>,
  now: Date,
  closures: ClosureResolver,
  endOfDay: TimeOfDay,
): boolean {
  if (loan.returnedAt) return false;
  const due = loanDueDate(loan, closures);
  const current = localMoment(now.toISOString());
  if (current.date !== due) return current.date > due;
  return toMinutes(current.time as TimeOfDay) >= toMinutes(endOfDay);
}

/**
 * Volgorde van "Nu uitgeleend": eerst de eigen vestiging, dan wat al het langst uit staat. Bij
 * gelijke tijd op kenteken, zodat de volgorde altijd hetzelfde is.
 */
export function sortOpenLoans(loans: readonly VehicleLoan[], ownGroupId: string | null): VehicleLoan[] {
  return [...loans].sort((a, b) => {
    const ownA = a.groupId === ownGroupId ? 0 : 1;
    const ownB = b.groupId === ownGroupId ? 0 : 1;
    if (ownA !== ownB) return ownA - ownB;
    if (a.handedOutAt !== b.handedOutAt) return a.handedOutAt < b.handedOutAt ? -1 : 1;
    return a.plate < b.plate ? -1 : a.plate > b.plate ? 1 : 0;
  });
}

/** De open uitleen van een kenteken, als die er is. */
export function openLoanFor(loans: readonly VehicleLoan[], plate: string): VehicleLoan | null {
  return loans.find((loan) => loan.plate === plate && !loan.returnedAt) ?? null;
}

export interface ReissueOption {
  plate: string;
  model: string;
  destination: Destination;
  handedTo: string;
}

/** Zo ver kijkt Opnieuw uitgeven terug (V46). */
export const REISSUE_DAYS = 14;
const MAX_REISSUE_OPTIONS = 8;

/**
 * Opnieuw uitgeven (V46): de auto's die de vestiging de afgelopen 14 dagen uitleende, de laatste
 * eerst, elk kenteken één keer. Niet de auto's die nu (ergens) uit staan.
 */
export function reissueOptions(
  loans: readonly VehicleLoan[],
  groupId: string,
  today: IsoDate,
): ReissueOption[] {
  const from = addDays(today, -REISSUE_DAYS);
  const open = new Set(loans.filter((loan) => !loan.returnedAt).map((loan) => loan.plate));
  const seen = new Set<string>();
  const options: ReissueOption[] = [];
  const recent = loans
    .filter((loan) => loan.groupId === groupId && localMoment(loan.handedOutAt).date >= from)
    .sort((a, b) => (a.handedOutAt < b.handedOutAt ? 1 : a.handedOutAt > b.handedOutAt ? -1 : 0));
  for (const loan of recent) {
    if (seen.has(loan.plate) || open.has(loan.plate)) continue;
    seen.add(loan.plate);
    options.push({ plate: loan.plate, model: loan.model, destination: loan.destination, handedTo: loan.handedTo });
    if (options.length === MAX_REISSUE_OPTIONS) break;
  }
  return options;
}

/** `before`: de vestiging registreerde toen nog niet in Planbord (vóór de eerste uitleen). */
export type DayCheckState = 'ok' | 'short' | 'pending' | 'closed' | 'before';

export interface DayCheckCell {
  date: IsoDate;
  label: string;
  /** Aantal auto's dat die dag aan Mobiliteit is meegegeven. */
  count: number;
  state: DayCheckState;
}

export interface DayCheckRow {
  groupId: string;
  groupName: string;
  required: number;
  cells: DayCheckCell[];
}

/** De laatste `count` werkdagen (ma–vr) tot en met vandaag, oudste eerst. */
export function recentWeekdays(today: IsoDate, count: number): IsoDate[] {
  const days: IsoDate[] = [];
  for (let date = today; days.length < count; date = addDays(date, -1)) {
    if (weekdayOf(date) <= 5) days.unshift(date);
  }
  return days;
}

/**
 * De controle op Mobiliteit (V48): per vestiging met een ondergrens, per werkdag hoeveel auto's er
 * aan Mobiliteit zijn meegegeven. Genoeg = in orde; te weinig = rood; vandaag nog te weinig = nog
 * open; een sluitingsdag telt niet. Dagen vóór de eerste uitleen van een vestiging in Planbord
 * (`firstDates`) tellen ook niet: anders staat alles rood zodra een vestiging begint.
 */
export function mobilityDayCheck(
  loans: readonly VehicleLoan[],
  groups: readonly LoanGroup[],
  days: readonly IsoDate[],
  today: IsoDate,
  closures: ClosureResolver,
  firstDates: ReadonlyMap<string, IsoDate>,
): DayCheckRow[] {
  const counts = new Map<string, number>();
  for (const loan of loans) {
    if (loan.destination !== 'mobility') continue;
    const key = `${loan.groupId}|${localMoment(loan.handedOutAt).date}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return groups
    .filter((group) => group.mobilityPerDay > 0)
    .map((group) => ({
      groupId: group.id,
      groupName: group.name,
      required: group.mobilityPerDay,
      cells: days.map((date) => {
        const count = counts.get(`${group.id}|${date}`) ?? 0;
        const first = firstDates.get(group.id);
        const state: DayCheckState = !first || date < first
          ? 'before'
          : closures(date, group.id).closed
          ? 'closed'
          : count >= group.mobilityPerDay
            ? 'ok'
            : date === today
              ? 'pending'
              : 'short';
        return { date, label: formatDayShort(date), count, state };
      }),
    }));
}

/** "vandaag 16:30", "gisteren 09:05" of "di 10 nov 16:30". */
export function formatLoanMoment(timestamp: string, today: IsoDate): string {
  const moment = localMoment(timestamp);
  if (moment.date === today) return `vandaag ${moment.time}`;
  if (moment.date === addDays(today, -1)) return `gisteren ${moment.time}`;
  return `${formatDayShort(moment.date)} ${moment.time}`;
}

/** Kilometerstand met punten: 45210 → "45.210". */
export function formatOdometer(value: number | null): string {
  if (value === null) return '';
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Gereden kilometers, als beide standen bekend zijn. */
export function distance(loan: Pick<VehicleLoan, 'odometerOut' | 'odometerIn'>): number | null {
  return loan.odometerOut !== null && loan.odometerIn !== null ? loan.odometerIn - loan.odometerOut : null;
}
