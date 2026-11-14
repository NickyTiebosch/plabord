/**
 * De overdracht als Excel (fase 8): per vestiging een tabblad met de notities van de laatste 7 dagen.
 * Puur.
 */
import { notesFor, type HandoverNote } from '../handover/notes';
import { localMoment } from '../loans/time';
import type { LoanCell } from './loans';
import type { TitledSheet } from './registrations';

export function handoverExport(
  notes: readonly HandoverNote[],
  context: { groups: readonly { id: string; name: string }[]; personName: (id: string | null) => string; now: Date },
): TitledSheet[] {
  const stand = localMoment(context.now.toISOString());
  return context.groups.map((group) => ({
    sheet: group.name.slice(0, 31),
    title: `Overdracht · ${group.name} · stand ${stand.date.split('-').reverse().join('-')} ${stand.time}`,
    header: ['Datum', 'Tijd', 'Door', 'Notitie'],
    widths: [12, 8, 18, 80],
    rows: notesFor(notes, group.id).map((note): LoanCell[] => {
      const moment = localMoment(note.createdAt);
      return [
        { value: moment.date, kind: 'date' },
        { value: moment.time, kind: 'time' },
        { value: context.personName(note.createdBy), kind: 'text' },
        { value: note.body, kind: 'text' },
      ];
    }),
  }));
}
