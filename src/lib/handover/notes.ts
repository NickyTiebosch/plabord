/**
 * De overdracht per vestiging (fase 8): een korte notitie voor de collega van morgen, die na 7 dagen
 * vanzelf verdwijnt. Puur: "vandaag" komt binnen als parameter.
 */
import type { IsoDate } from '../engine/types';
import { localMoment } from '../loans/time';

export const MAX_NOTE = 300;
export const KEEP_DAYS = 7;

export interface HandoverNote {
  id: string;
  groupId: string;
  body: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** De tekst zoals iemand hem typt: enkele spaties binnen een regel, hooguit 300 tekens. */
export function parseNote(value: unknown): { ok: true; body: string } | { ok: false; error: string } {
  const body = (typeof value === 'string' ? value : '')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (body === '') return { ok: false, error: 'Schrijf eerst een notitie.' };
  if (body.length > MAX_NOTE) return { ok: false, error: `Hooguit ${MAX_NOTE} tekens. Nu ${body.length}.` };
  return { ok: true, body };
}

/** De notities van één vestiging, nieuwste eerst. */
export function notesFor(notes: readonly HandoverNote[], groupId: string): HandoverNote[] {
  return notes.filter((note) => note.groupId === groupId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** Is de notitie gewijzigd na het schrijven? Dan staat "gewijzigd" erbij. */
export function wasEdited(note: Pick<HandoverNote, 'createdAt' | 'updatedAt'>): boolean {
  return new Date(note.updatedAt).getTime() - new Date(note.createdAt).getTime() > 60_000;
}

/** Nog zoveel dagen zichtbaar (0 = vandaag de laatste dag). */
export function daysLeft(note: Pick<HandoverNote, 'createdAt'>, today: IsoDate): number {
  const written = localMoment(note.createdAt).date;
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${written}T00:00:00Z`)) / 86_400_000);
  return Math.max(0, KEEP_DAYS - days);
}
