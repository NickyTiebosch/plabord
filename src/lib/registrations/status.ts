/**
 * De stand van de registraties (fase 6): doorbelasten, welke dagen meetellen en de invulcontrole.
 * Puur: gegevens en "nu" komen binnen als parameter.
 */
import type { ClosureResolver } from '../engine/closures';
import { addDays, weekdayOf } from '../engine/dates';
import { formatDayShort } from '../engine/format';
import { toMinutes } from '../engine/time';
import type { IsoDate, TimeOfDay } from '../engine/types';
import { localMoment } from '../loans/time';
import type { CounterGroup, DayClosure, Incident, WalkIn, Workshop } from './types';

/** Een annulering vanaf dit tijdstip (standaard 11:00) wordt doorbelast (V58). */
export function shouldCharge(cancelledAt: TimeOfDay, from: TimeOfDay): boolean {
  return toMinutes(cancelledAt) >= toMinutes(from);
}

/** De dag van een melding, in Nederlandse tijd. */
export function incidentDate(incident: Pick<Incident, 'occurredAt'>): IsoDate {
  return localMoment(incident.occurredAt).date;
}

/** Mag deze kijker de melding of registratie wijzigen (V59)? De maker op dezelfde dag, of beheerder of teamleider. */
export function canEditOwn(
  item: { ownerId: string | null; createdAt: string },
  viewer: { employeeId: string; isLead: boolean },
  today: IsoDate,
): boolean {
  if (viewer.isLead) return true;
  return item.ownerId === viewer.employeeId && localMoment(item.createdAt).date === today;
}

export interface WalkInRow {
  workshop: Workshop;
  count: number;
}

/**
 * De tellers van één vestiging op één dag: de actieve werkplaatsen in volgorde, plus een inactieve
 * als die op die dag nog een aantal heeft (dan blijft het totaal kloppen).
 */
export function walkInRows(workshops: readonly Workshop[], walkIns: readonly WalkIn[], groupId: string, date: IsoDate): WalkInRow[] {
  const counts = new Map(walkIns.filter((row) => row.date === date).map((row) => [row.workshopId, row.count]));
  return workshops
    .filter((workshop) => workshop.groupId === groupId && (workshop.isActive || (counts.get(workshop.id) ?? 0) > 0))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'nl'))
    .map((workshop) => ({ workshop, count: counts.get(workshop.id) ?? 0 }));
}

export type DayState = 'closed' | 'pending' | 'open' | 'shut' | 'before' | 'weekend';

export interface CompletionCell {
  date: IsoDate;
  label: string;
  state: DayState;
  walkIns: number;
  incidents: number;
  rentlinkChecked: boolean;
}

export interface CompletionRow {
  groupId: string;
  groupName: string;
  cells: CompletionCell[];
  /** Aantal eerdere dagen dat niet is afgesloten. */
  open: number;
}

/** De laatste `count` dagen van maandag tot en met zaterdag, tot en met vandaag, nieuwste eerst. */
export function recentDays(today: IsoDate, count: number): IsoDate[] {
  const days: IsoDate[] = [];
  for (let date = today; days.length < count; date = addDays(date, -1)) {
    if (weekdayOf(date) <= 6) days.push(date);
  }
  return days;
}

/**
 * De invulcontrole (V61): per vestiging per dag of de dag is afgesloten.
 * - `closed`: afgesloten. `pending`: vandaag, nog niet. `open`: een eerdere dag die niet is afgesloten.
 * - `shut`: een sluitingsdag. `weekend`: een zaterdag waarop niets is geregistreerd of afgesloten;
 *   die hoeft niet te worden afgesloten.
 * - `before`: vóór de eerste dag die de vestiging in Planbord afsloot (`firstDates`). Zo staat bij de
 *   start, en na het inlezen van de historie, niet alles rood.
 */
export function completionGrid(
  groups: readonly CounterGroup[],
  days: readonly IsoDate[],
  today: IsoDate,
  data: { closures: readonly DayClosure[]; walkIns: readonly WalkIn[]; incidents: readonly Incident[] },
  dayOff: ClosureResolver,
  firstDates: ReadonlyMap<string, IsoDate>,
): CompletionRow[] {
  const key = (groupId: string, date: IsoDate) => `${groupId}|${date}`;
  const closed = new Map(data.closures.map((closure) => [key(closure.groupId, closure.date), closure]));
  const walkIns = new Map<string, number>();
  for (const row of data.walkIns) walkIns.set(key(row.groupId, row.date), (walkIns.get(key(row.groupId, row.date)) ?? 0) + row.count);
  const incidents = new Map<string, number>();
  for (const incident of data.incidents) {
    const k = key(incident.groupId, incidentDate(incident));
    incidents.set(k, (incidents.get(k) ?? 0) + 1);
  }
  return groups.map((group) => {
    const first = firstDates.get(group.id);
    const cells = days.map((date): CompletionCell => {
      const k = key(group.id, date);
      const closure = closed.get(k);
      const counted = { walkIns: walkIns.get(k) ?? 0, incidents: incidents.get(k) ?? 0 };
      const state: DayState = closure
        ? 'closed'
        : dayOff(date, group.id).closed
          ? 'shut'
          : weekdayOf(date) === 6 && counted.walkIns === 0 && counted.incidents === 0
            ? 'weekend'
            : !first || date < first
              ? 'before'
              : date === today
                ? 'pending'
                : 'open';
      return { date, label: formatDayShort(date), state, ...counted, rentlinkChecked: closure?.rentlinkChecked ?? false };
    });
    return { groupId: group.id, groupName: group.name, cells, open: cells.filter((cell) => cell.state === 'open').length };
  });
}

/** Moet deze vestiging nu een herinnering krijgen (V61)? Vandaag telt mee, is nog niet afgesloten, en het is tijd. */
export function needsReminder(row: CompletionRow | undefined, today: IsoDate, nowTime: TimeOfDay, reminderAt: TimeOfDay | null): boolean {
  if (!row || !reminderAt) return false;
  const cell = row.cells.find((candidate) => candidate.date === today);
  return cell?.state === 'pending' && toMinutes(nowTime) >= toMinutes(reminderAt);
}

export interface ChargeList {
  open: Incident[];
  done: Incident[];
}

/** De doorbelastlijst (V62): annuleringen die doorbelast moeten worden; de openstaande oudste eerst. */
export function chargeList(incidents: readonly Incident[]): ChargeList {
  const toCharge = incidents.filter((incident) => incident.kind === 'cancellation' && incident.charge === true);
  const byTime = (a: Incident, b: Incident) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : 0);
  return {
    open: toCharge.filter((incident) => !incident.chargedAt).sort(byTime),
    done: toCharge.filter((incident) => incident.chargedAt).sort((a, b) => byTime(b, a)),
  };
}

/** De vestiging die het scherm toont: de gevraagde als die bestaat, anders je eigen, anders de eerste. */
export function pickGroup(groups: readonly CounterGroup[], wanted: string | undefined, ownGroupId: string): CounterGroup | null {
  return groups.find((group) => group.id === wanted) ?? groups.find((group) => group.id === ownGroupId) ?? groups[0] ?? null;
}
