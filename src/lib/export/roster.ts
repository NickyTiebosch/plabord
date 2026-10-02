/**
 * Het rooster als Excel (aanvulling op fase 3, besluit V22): een tabblad per tab van het
 * Rooster-scherm, met per week een blok onder elkaar. De rijen zijn medewerkers (in een vestiging
 * per rol, in Ondersteunend per groep), de kolommen de dagen ma–za. De cellen zeggen wat het
 * scherm zegt, want ze komen uit hetzelfde weekrooster (`buildGroupWeek`). Geen e-mailadressen en
 * geen redenen. Puur: van de planning naar rijen; het bestand zelf maakt `buildRosterWorkbook`.
 */
import { addDays, daysBetween, isIsoDate, isoWeekOf, startOfIsoWeek, weekdayOf } from '../engine/dates';
import { formatDateRange } from '../engine/format';
import { ROLE_LABELS } from '../engine/labels';
import { ROLES, type IsoDate, type PlanningSnapshot, type Role } from '../engine/types';
import { buildGroupWeek, type GroupSection, type PersonLine } from '../views/group-week';
import { rosterTabs, type RosterTab } from '../views/tabs';

/** Hooguit een kwartaal per bestand. */
export const MAX_ROSTER_WEEKS = 13;
/** Zonder keuze: deze week en de drie weken erna. */
export const DEFAULT_ROSTER_WEEKS = 4;

export type RosterCellKind = 'title' | 'day' | 'section' | 'name' | 'shift' | 'closed' | 'shortage' | 'empty';
/** De kleur van een kopje, zoals op het scherm: balie, hiker/buitendienst of de rest. */
export type RosterTone = 'counter' | 'cleaning' | 'other';

export interface RosterCell {
  value: string;
  kind: RosterCellKind;
  tone?: RosterTone;
}

export interface RosterSheet {
  sheet: string;
  rows: RosterCell[][];
}

export interface RosterPeriod {
  /** De maandag van de eerste week. */
  from: IsoDate;
  /** De zaterdag van de laatste week. */
  to: IsoDate;
  mondays: IsoDate[];
  /** De gekozen periode was langer dan 13 weken en is ingekort. */
  shortened: boolean;
}

/** De maandag van de week waarin een dag valt; een zondag hoort bij de week erna, zoals op het scherm. */
function mondayFor(date: IsoDate): IsoDate {
  return weekdayOf(date) === 7 ? addDays(date, 1) : startOfIsoWeek(date);
}

/**
 * De periode van de export: hele weken van maandag tot en met zaterdag. Zonder geldige datums
 * deze week en de drie weken erna. Staan de datums omgekeerd, dan worden ze omgedraaid; langer
 * dan 13 weken wordt ingekort.
 */
export function rosterPeriod(van: unknown, tot: unknown, today: IsoDate): RosterPeriod {
  const [begin, end] = isIsoDate(van) && isIsoDate(tot) && tot < van ? [tot, van] : [van, tot];
  const start = isIsoDate(begin) ? mondayFor(begin) : mondayFor(today);
  const chosenLast = isIsoDate(end) ? startOfIsoWeek(end) : addDays(start, (DEFAULT_ROSTER_WEEKS - 1) * 7);
  // Valt het einde vóór de eerste week (bijvoorbeeld alleen een zondag), dan is het één week.
  const last = chosenLast < start ? start : chosenLast;
  const weeks = daysBetween(start, last) / 7 + 1;
  const count = Math.min(weeks, MAX_ROSTER_WEEKS);
  const mondays = Array.from({ length: count }, (_, index) => addDays(start, index * 7));
  return { from: start, to: addDays(mondays.at(-1) ?? start, 5), mondays, shortened: weeks > MAX_ROSTER_WEEKS };
}

/** Bijvoorbeeld "planbord-rooster-2026-10-12-tot-2026-11-07.xlsx". */
export function rosterFileName(period: Pick<RosterPeriod, 'from' | 'to'>): string {
  return `planbord-rooster-${period.from}-tot-${period.to}.xlsx`;
}

const DAYS = 6;

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('nl') + text.slice(1);
}

function toneOf(role: Role | null): RosterTone {
  return role === 'counter' ? 'counter' : role === 'cleaning' ? 'cleaning' : 'other';
}

interface Row {
  employeeId: string;
  name: string;
  borrowed: boolean;
  /** Per dag de teksten; meestal één. */
  days: string[][];
}

interface Block {
  key: string;
  label: string;
  order: number;
  tone: RosterTone;
  rows: Map<string, Row>;
}

/** De tekst van een dienst: "07:30–18:00", met de rol en een toevoeging als het scherm die ook toont. */
function shiftText(line: PersonLine): string {
  const base = [line.roleLabel, line.times].filter(Boolean).join(' · ');
  return line.note ? `${base} (${line.note})` : base;
}

function compareRows(a: Row, b: Row): number {
  // Eerst de eigen mensen, dan wie is ingeleend; elk op naam, zoals op het scherm.
  if (a.borrowed !== b.borrowed) return a.borrowed ? 1 : -1;
  return a.name.localeCompare(b.name, 'nl') || (a.employeeId < b.employeeId ? -1 : a.employeeId > b.employeeId ? 1 : 0);
}

/** Eén week van één tab als rijen: kop, dagen, eventueel "Gesloten", de blokken en het tekort. */
function weekRows(snapshot: PlanningSnapshot, tab: RosterTab, monday: IsoDate, today: IsoDate): RosterCell[][] {
  const days = buildGroupWeek(snapshot, tab.groupIds, monday, today);
  const hasCounter = new Map(snapshot.groups.map((group) => [group.id, group.hasCounter]));
  const blocks = new Map<string, Block>();
  const pendingDaysOff: { day: number; section: GroupSection; employeeId: string; name: string }[] = [];

  function blockFor(section: GroupSection, sectionIndex: number, role: Role): Block {
    const byRole = hasCounter.get(section.groupId) ?? false;
    const key = byRole ? `role:${role}` : `group:${section.groupId}`;
    let block = blocks.get(key);
    if (!block) {
      block = byRole
        ? { key, label: capitalize(ROLE_LABELS[role]), order: ROLES.indexOf(role), tone: toneOf(role), rows: new Map() }
        : { key, label: section.groupName, order: sectionIndex, tone: 'other', rows: new Map() };
      blocks.set(key, block);
    }
    return block;
  }

  function add(block: Block, day: number, person: { employeeId: string; name: string; borrowed: boolean }, text: string) {
    let row = block.rows.get(person.employeeId);
    if (!row) {
      row = { employeeId: person.employeeId, name: person.name, borrowed: person.borrowed, days: Array.from({ length: DAYS }, () => []) };
      block.rows.set(person.employeeId, row);
    }
    row.days[day]?.push(text);
  }

  days.forEach((day, index) => {
    day.sections.forEach((section, sectionIndex) => {
      for (const working of section.working) {
        for (const line of working.people) add(blockFor(section, sectionIndex, line.role), index, line, shiftText(line));
      }
      for (const line of section.absent) {
        add(blockFor(section, sectionIndex, line.role), index, line, line.note ? `Afwezig (${line.note})` : 'Afwezig');
      }
      for (const line of section.elsewhere) add(blockFor(section, sectionIndex, line.role), index, line, 'Valt elders in');
      for (const off of section.daysOff) pendingDaysOff.push({ day: index, section, employeeId: off.employeeId, name: off.name });
    });
  });

  // Wie door een roosterwijziging vrij is, komt in de rij waar die persoon al staat; anders bij de eigen rol.
  const employees = new Map(snapshot.employees.map((employee) => [employee.id, employee]));
  for (const off of pendingDaysOff) {
    const sectionIndex = days[off.day]?.sections.indexOf(off.section) ?? 0;
    const existing = [...blocks.values()]
      .filter((block) => block.rows.has(off.employeeId))
      .sort((a, b) => a.order - b.order)[0];
    const block = existing ?? blockFor(off.section, sectionIndex, employees.get(off.employeeId)?.defaultRole ?? 'none');
    add(block, off.day, { employeeId: off.employeeId, name: off.name, borrowed: false }, 'Geen dienst (gewijzigd)');
  }

  const title: RosterCell[] = [
    { value: `${tab.label} · Week ${isoWeekOf(monday).week} · ${formatDateRange(monday, addDays(monday, 5))}`, kind: 'title' },
  ];
  const header: RosterCell[] = [{ value: '', kind: 'day' }, ...days.map((day) => ({ value: day.label, kind: 'day' as const }))];
  const rows: RosterCell[][] = [title, header];

  const closures = days.map((day) => {
    const closed = day.sections.filter((section) => section.closure);
    if (closed.length === 0) return '';
    return tab.groupIds.length === 1
      ? (closed[0]?.closure ?? '')
      : closed.map((section) => `${section.groupName}: ${section.closure}`).join('; ');
  });
  if (closures.some(Boolean)) {
    rows.push([{ value: 'Gesloten', kind: 'closed' }, ...closures.map((value) => ({ value, kind: 'closed' as const }))]);
  }

  const ordered = [...blocks.values()].sort((a, b) => a.order - b.order);
  for (const block of ordered) {
    rows.push(Array.from({ length: DAYS + 1 }, (_, column) => ({ value: column === 0 ? block.label : '', kind: 'section' as const, tone: block.tone })));
    for (const row of [...block.rows.values()].sort(compareRows)) {
      rows.push([
        { value: row.name, kind: 'name' },
        ...row.days.map((texts) => ({ value: texts.join('; '), kind: 'shift' as const })),
      ]);
    }
  }

  const shortages = days.map((day) => day.sections.map((section) => section.shortage).filter(Boolean).join('; '));
  if (shortages.some(Boolean)) {
    rows.push([{ value: 'Te weinig aan de balie', kind: 'shortage' }, ...shortages.map((value) => ({ value, kind: 'shortage' as const }))]);
  }
  if (ordered.length === 0 && !closures.some(Boolean)) rows.push([{ value: 'Niemand ingeroosterd', kind: 'empty' }]);
  return rows;
}

/** Het hele bestand: per tab van het Rooster-scherm een tabblad, met de weken onder elkaar. */
export function rosterExport(snapshot: PlanningSnapshot, period: Pick<RosterPeriod, 'mondays'>, today: IsoDate): RosterSheet[] {
  return rosterTabs(snapshot.groups).map((tab) => ({
    sheet: tab.label,
    rows: period.mondays.flatMap((monday, index) => [
      ...(index > 0 ? [[] as RosterCell[]] : []),
      ...weekRows(snapshot, tab, monday, today),
    ]),
  }));
}
