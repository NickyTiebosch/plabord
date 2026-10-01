import { compareGroups } from '../engine/sort';
import type { Group } from '../engine/types';

export const SUPPORT_SLUG = 'ondersteunend';

export interface RosterTab {
  slug: string;
  label: string;
  groupIds: string[];
}

export function groupSlug(groupId: string): string {
  return groupId.replace(/_/g, '-');
}

/** De tabs van het vestigingsrooster: elke vestiging apart en de ondersteunende groepen samen. */
export function rosterTabs(groups: readonly Group[]): RosterTab[] {
  const sorted = [...groups].sort(compareGroups);
  const tabs: RosterTab[] = sorted
    .filter((group) => group.hasCounter)
    .map((group) => ({ slug: groupSlug(group.id), label: group.name, groupIds: [group.id] }));
  const support = sorted.filter((group) => !group.hasCounter).map((group) => group.id);
  if (support.length > 0) tabs.push({ slug: SUPPORT_SLUG, label: 'Ondersteunend', groupIds: support });
  return tabs;
}

export function findTab(groups: readonly Group[], slug: string): RosterTab | null {
  return rosterTabs(groups).find((tab) => tab.slug === slug) ?? null;
}
