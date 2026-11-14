import { describe, expect, it } from 'vitest';
import { amsterdamInstant } from '../loans/time';
import { daysLeft, notesFor, parseNote, wasEdited, type HandoverNote } from './notes';

const at = (date: string, time = '17:00') => amsterdamInstant(date, time as never).toISOString();
const note = (id: string, groupId: string, createdAt: string, updatedAt = createdAt): HandoverNote => ({ id, groupId, body: 'x', createdBy: null, createdAt, updatedAt });

describe('overdracht', () => {
  it('maakt de tekst netjes en bewaakt de lengte', () => {
    expect(parseNote('  Sleutel   S 18 \n\n\n\n ligt in de kluis ')).toEqual({ ok: true, body: 'Sleutel S 18\n\nligt in de kluis' });
    expect(parseNote('   ')).toEqual({ ok: false, error: 'Schrijf eerst een notitie.' });
    expect(parseNote('a'.repeat(301))).toEqual({ ok: false, error: 'Hooguit 300 tekens. Nu 301.' });
  });

  it('toont per vestiging de nieuwste eerst, met gewijzigd en hoe lang hij nog blijft', () => {
    const notes = [note('a', 'den_bosch', at('2026-11-12')), note('b', 'den_bosch', at('2026-11-13'), at('2026-11-13', '18:00')), note('c', 'breda', at('2026-11-13'))];
    expect(notesFor(notes, 'den_bosch').map((item) => item.id)).toEqual(['b', 'a']);
    expect(wasEdited(notes[1] as HandoverNote)).toBe(true);
    expect(wasEdited(notes[0] as HandoverNote)).toBe(false);
    expect(daysLeft(notes[0] as HandoverNote, '2026-11-13')).toBe(6);
    expect(daysLeft(notes[0] as HandoverNote, '2026-11-20')).toBe(0);
  });
});

describe('overdracht als Excel', () => {
  it('maakt per vestiging een tabblad, nieuwste eerst', async () => {
    const { handoverExport } = await import('../export/handover');
    const sheets = handoverExport([note('a', 'den_bosch', at('2026-11-12')), note('b', 'den_bosch', at('2026-11-13'))], {
      groups: [
        { id: 'den_bosch', name: 'Den Bosch' },
        { id: 'breda', name: 'Breda' },
      ],
      personName: () => 'Sanne',
      now: new Date('2026-11-13T17:00:00Z'),
    });
    expect(sheets.map((sheet) => [sheet.sheet, sheet.rows.length])).toEqual([
      ['Den Bosch', 2],
      ['Breda', 0],
    ]);
    expect(sheets[0]?.rows[0]?.map((cell) => cell.value)).toEqual(['2026-11-13', '17:00', 'Sanne', 'x']);
  });
});
