/**
 * De overdracht laden (fase 8). Met de sessie van wie kijkt: RLS toont alleen de laatste 7 dagen.
 */
import type { HandoverNote } from '../handover/notes';
import type { Tables } from './database.types';
import type { DbClient } from './queries';

export function mapNote(row: Tables<'handover_notes'>): HandoverNote {
  return {
    id: row.id,
    groupId: row.group_id,
    body: row.body,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/** Alle notities van de laatste 7 dagen. Zonder fase 8 in de database: geen. */
export async function loadNotes(client: DbClient): Promise<HandoverNote[]> {
  const result = await client.from('handover_notes').select('*').order('created_at', { ascending: false }).limit(500);
  if (result.error) return [];
  return (result.data ?? []).map(mapNote);
}
