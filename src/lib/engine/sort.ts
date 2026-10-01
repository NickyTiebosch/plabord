import type { Group } from './types';

const nameCollator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

/** Vergelijkt namen op z'n Nederlands, zonder op hoofdletters te letten. */
export function compareNames(a: string, b: string): number {
  return nameCollator.compare(a, b);
}

/** Vaste volgorde: eerst op naam, bij gelijke naam op id. */
export function compareByNameThenId(a: { name: string; id: string }, b: { name: string; id: string }): number {
  return compareNames(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Groepen op hun ingestelde volgorde, bij gelijke volgorde op id. */
export function compareGroups(a: Group, b: Group): number {
  return a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Normaliseert een naam voor het vergelijken: zonder spaties aan begin/eind, enkele spaties, kleine letters. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('nl');
}
