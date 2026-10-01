/**
 * Afwijkingen op een feestdag opslaan: welke groepen zijn toch open?
 */
import type { ClosureOverride, IsoDate } from '../engine/types';

export interface HolidayOverrideRow {
  date: IsoDate;
  groupId: string | null;
  isClosed: boolean;
  label: string | null;
}

/**
 * Van "welke groepen zijn dicht" naar de afwijkingen die we opslaan. Een feestdag is standaard
 * voor iedereen dicht. Zijn alle groepen open, dan volstaat één afwijking voor alle groepen.
 */
export function holidayOverrides(date: IsoDate, allGroupIds: readonly string[], closedGroupIds: readonly string[]): HolidayOverrideRow[] {
  const closed = new Set(closedGroupIds);
  const open = allGroupIds.filter((groupId) => !closed.has(groupId));
  if (open.length === 0) return [];
  if (open.length === allGroupIds.length) return [{ date, groupId: null, isClosed: false, label: null }];
  return open.map((groupId) => ({ date, groupId, isClosed: false, label: null }));
}

/** Korte samenvatting voor het scherm: "Dicht voor iedereen" of "Open: Logistiek". */
export function holidaySummary(closedByGroup: Record<string, boolean>, groupNames: ReadonlyMap<string, string>): string {
  const open = Object.entries(closedByGroup)
    .filter(([, closed]) => !closed)
    .map(([groupId]) => groupNames.get(groupId) ?? groupId);
  if (open.length === 0) return 'Dicht voor iedereen';
  if (open.length === Object.keys(closedByGroup).length) return 'Open voor iedereen';
  return `Open: ${open.join(', ')}`;
}

/** Voor wie geldt een extra sluitingsdag? */
export function closureScope(override: ClosureOverride, groupNames: ReadonlyMap<string, string>): string {
  return override.groupId ? (groupNames.get(override.groupId) ?? override.groupId) : 'Alle groepen';
}
