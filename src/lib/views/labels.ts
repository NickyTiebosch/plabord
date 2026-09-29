import { ABSENCE_PART_LABELS, DAY_PART_LABELS } from '../engine/labels';
import type { AbsenceMark } from '../engine/schedule';
import type { DayPart } from '../engine/types';

/** "Afwezig", "Afwezig (ochtend)" of "Afwezig (middag)" voor de afwezigheden van één dag. */
export function absenceLabel(marks: readonly AbsenceMark[]): string | null {
  if (marks.length === 0) return null;
  const parts = new Set(marks.flatMap((mark) => (mark.dayPart === 'full_day' ? ['morning', 'afternoon'] : [mark.dayPart])));
  if (parts.size === 2) return 'Afwezig';
  const [only] = [...parts] as DayPart[];
  return only ? `Afwezig (${ABSENCE_PART_LABELS[only]})` : 'Afwezig';
}

export function isRequested(marks: readonly AbsenceMark[]): boolean {
  return marks.some((mark) => mark.status === 'requested');
}

/** "ochtend afwezig" of "middag afwezig". */
export function partialAbsenceNote(absentParts: readonly DayPart[]): string | null {
  if (absentParts.length !== 1) return null;
  const [part] = absentParts;
  return part ? `${DAY_PART_LABELS[part]} afwezig` : null;
}
