'use server';

import { revalidatePath } from 'next/cache';
import { dbErrorMessage } from '@/lib/admin/errors';
import { isUuid, type ActionState } from '@/lib/admin/forms';
import { requireViewer } from '@/lib/auth/session';
import { loadCounterGroups } from '@/lib/db/registration-queries';
import { parseNote } from '@/lib/handover/notes';

/** Een notitie voor de collega van morgen. Wie schrijft, vult de database in. */
export async function addNote(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireViewer();
  const groupId = String(formData.get('groupId') ?? '');
  if (!(await loadCounterGroups(supabase)).some((group) => group.id === groupId)) return { error: 'Kies een vestiging.' };
  const parsed = parseNote(formData.get('body'));
  if (!parsed.ok) return { error: parsed.error, fieldErrors: { body: parsed.error } };
  const saved = await supabase.from('handover_notes').insert({ group_id: groupId, body: parsed.body });
  if (saved.error) return { error: dbErrorMessage(saved.error) };
  revalidatePath('/overdracht');
  revalidatePath('/');
  return { ok: true, message: 'Notitie geplaatst.' };
}

/** Wijzigen of verwijderen: de schrijver op dezelfde dag, daarna de teamleider (RLS bewaakt het). */
export async function saveNote(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireViewer();
  const id = formData.get('id');
  if (!isUuid(id)) return { error: 'Deze notitie bestaat niet meer.' };
  if (formData.get('intent') === 'delete') {
    const removed = await supabase.from('handover_notes').delete().eq('id', id).select('id');
    if (removed.error) return { error: dbErrorMessage(removed.error) };
    if ((removed.data ?? []).length === 0) return { error: 'Alleen wie de notitie schreef, kan hem vandaag verwijderen. Daarna doet je teamleider dat.' };
    revalidatePath('/overdracht');
    revalidatePath('/');
    return { ok: true, message: 'Notitie verwijderd.' };
  }
  const parsed = parseNote(formData.get('body'));
  if (!parsed.ok) return { error: parsed.error };
  const saved = await supabase.from('handover_notes').update({ body: parsed.body }).eq('id', id).select('id');
  if (saved.error) return { error: dbErrorMessage(saved.error) };
  if ((saved.data ?? []).length === 0) return { error: 'Alleen wie de notitie schreef, kan hem vandaag wijzigen. Daarna doet je teamleider dat.' };
  revalidatePath('/overdracht');
  revalidatePath('/');
  return { ok: true, message: 'Opgeslagen.' };
}
