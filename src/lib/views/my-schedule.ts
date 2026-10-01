/**
 * Mijn rooster: de komende weken per dag (ma–za), met afwijkingen die opvallen.
 */
import { isoWeekOf, weekdayOf } from '../engine/dates';
import { formatDateRange, formatDayShort } from '../engine/format';
import { ROLE_LABELS } from '../engine/labels';
import { entryState, type PersonalDay, type ShiftEntry } from '../engine/schedule';
import { formatTimeRange } from '../engine/time';
import type { Group, IsoDate } from '../engine/types';
import { absenceLabel, isRequested, partialAbsenceNote } from './labels';

export type LineTone = 'normal' | 'deviation' | 'absent' | 'closed';

export interface ScheduleLine {
  title: string;
  detail: string;
  tone: LineTone;
  note: string | null;
}

export interface MyScheduleDay {
  date: IsoDate;
  label: string;
  isToday: boolean;
  lines: ScheduleLine[];
  absence: { label: string; requested: boolean } | null;
}

export interface MyScheduleWeek {
  key: string;
  label: string;
  days: MyScheduleDay[];
}

function lineFor(entry: ShiftEntry, groupName: (id: string) => string): ScheduleLine {
  const place = groupName(entry.groupId);
  const planned = formatTimeRange(entry.start, entry.end);
  // "geen rol" zeggen we niet: dan tonen we alleen de tijden.
  const withRole = (times: string) => (entry.role === 'none' ? times : `${ROLE_LABELS[entry.role]} · ${times}`);
  if (entry.kind === 'substitution') {
    const times = entry.working ? formatTimeRange(entry.working.start, entry.working.end) : planned;
    return {
      title: `Invallen in ${place}`,
      detail: withRole(times),
      tone: entry.working ? 'deviation' : 'absent',
      // Afwezig staat al als label bij de dag; niet nog een keer bij de regel.
      note: null,
    };
  }
  const state = entryState(entry);
  switch (state) {
    case 'closed':
      return {
        title: place,
        detail: entry.role === 'none' ? '' : ROLE_LABELS[entry.role],
        tone: 'closed',
        note: `Gesloten: ${entry.closure?.name ?? 'sluitingsdag'}`,
      };
    case 'absent':
      return { title: place, detail: withRole(planned), tone: 'absent', note: null };
    case 'elsewhere':
      return { title: place, detail: withRole(planned), tone: 'deviation', note: 'je valt elders in' };
    case 'partly_absent':
      return {
        title: place,
        detail: withRole(entry.working ? formatTimeRange(entry.working.start, entry.working.end) : planned),
        tone: 'deviation',
        note: partialAbsenceNote(entry.absentParts),
      };
    case 'working': {
      const lentOut = entry.lentOutParts.length > 0;
      return {
        title: place,
        detail: withRole(entry.working ? formatTimeRange(entry.working.start, entry.working.end) : planned),
        tone: lentOut || entry.changed ? 'deviation' : 'normal',
        note: lentOut ? 'deels elders invallen' : entry.changed ? 'gewijzigd' : null,
      };
    }
  }
}

export function buildMySchedule(days: readonly PersonalDay[], groups: readonly Group[], today: IsoDate): MyScheduleWeek[] {
  const names = new Map(groups.map((group) => [group.id, group.name]));
  const groupName = (id: string) => names.get(id) ?? id;
  const weeks = new Map<string, MyScheduleWeek>();

  for (const day of days) {
    if (weekdayOf(day.date) === 7) continue;
    const { year, week } = isoWeekOf(day.date);
    const key = `${year}-W${String(week).padStart(2, '0')}`;
    let bucket = weeks.get(key);
    if (!bucket) {
      bucket = { key, label: `Week ${week}`, days: [] };
      weeks.set(key, bucket);
    }
    const label = absenceLabel(day.absences);
    bucket.days.push({
      date: day.date,
      label: formatDayShort(day.date),
      isToday: day.date === today,
      lines: [
        ...day.entries.map((entry) => lineFor(entry, groupName)),
        // Door een roosterwijziging vrij: dat moet opvallen.
        ...(day.dayOff && day.entries.every((entry) => entry.kind !== 'regular')
          ? [{ title: 'Geen dienst', detail: '', tone: 'deviation' as const, note: 'gewijzigd' }]
          : []),
      ],
      absence: label ? { label, requested: isRequested(day.absences) } : null,
    });
  }

  return [...weeks.values()].map((week) => {
    const first = week.days[0]?.date;
    const last = week.days.at(-1)?.date;
    return { ...week, label: first && last ? `${week.label} · ${formatDateRange(first, last)}` : week.label };
  });
}
