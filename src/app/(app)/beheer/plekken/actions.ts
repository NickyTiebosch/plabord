'use server';

import { revalidatePath } from 'next/cache';
import { dbErrorMessage } from '@/lib/admin/errors';
import { isUuid, type ActionState } from '@/lib/admin/forms';
import { requireAdmin } from '@/lib/auth/session';
import type { Json } from '@/lib/db/database.types';
import { loadSpots } from '@/lib/db/location-queries';
import { MAX_FILE_BYTES } from '@/lib/import/columns';
import { planLocations, type LocationPlan } from '@/lib/import/locations';
import { ImportFileError, readWorkbook } from '@/lib/import/xlsx';
import { cleanSpotName, parseSpotList } from '@/lib/locations/status';

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

/** Plekken toevoegen (V73), één of meer tegelijk: één per regel, achteraan in de lijst. */
export async function addSpots(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const groupId = text(formData, 'groupId');
  const parsed = parseSpotList(text(formData, 'names'));
  if (!parsed.ok) return { error: parsed.error };
  const existing = (await loadSpots(supabase)).filter((spot) => spot.groupId === groupId);
  const known = new Set(existing.map((spot) => spot.name.toLocaleLowerCase('nl')));
  const fresh = parsed.names.filter((name) => !known.has(name.toLocaleLowerCase('nl')));
  if (fresh.length === 0) return { error: 'Deze plekken bestaan al.' };
  const start = Math.max(0, ...existing.map((spot) => spot.sortOrder)) + 1;
  const saved = await supabase.from('parking_spots').insert(fresh.map((name, index) => ({ group_id: groupId, name, sort_order: Math.min(999, start + index) })));
  if (saved.error) return { error: dbErrorMessage(saved.error) };
  revalidatePath('/', 'layout');
  return { ok: true, message: fresh.length === 1 ? `${fresh[0]} toegevoegd.` : `${fresh.length} plekken toegevoegd.` };
}

/** Naam, volgorde en actief van één plek. Verwijderen kan alleen als er geen auto staat. */
export async function saveSpot(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = formData.get('id');
  if (!isUuid(id)) return { error: 'Deze plek bestaat niet meer.' };
  if (formData.get('intent') === 'delete') {
    const removed = await supabase.from('parking_spots').delete().eq('id', id);
    if (removed.error) return { error: 'Verwijderen kan niet: er staat nog een auto. Verzet die eerst, of zet de plek op inactief.' };
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Plek verwijderd.' };
  }
  const name = cleanSpotName(formData.get('name'));
  const order = Number(text(formData, 'sortOrder'));
  if (!name) return { error: 'Vul een naam in van 1 tot 20 tekens.' };
  if (!Number.isInteger(order) || order < 0 || order > 999) return { error: 'Vul bij de volgorde een getal in van 0 tot en met 999.' };
  const saved = await supabase.from('parking_spots').update({ name, sort_order: order, is_active: formData.get('isActive') === 'on' }).eq('id', id);
  if (saved.error) return { error: saved.error.message.includes('parking_spots_name_key') ? 'Deze plek bestaat al bij deze vestiging.' : dbErrorMessage(saved.error) };
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Opgeslagen.' };
}

export interface LocationImportState {
  status: 'idle' | 'preview' | 'done';
  error?: string;
  fileName?: string;
  groupId?: string;
  preview?: Pick<LocationPlan, 'newSpots' | 'errors' | 'notices'> & { count: number };
  saved?: number;
}

/** De startlijst inlezen (bouwvolgorde 5): eerst een voorvertoning, dan opslaan. */
export async function importLocationsAction(previous: LocationImportState, formData: FormData): Promise<LocationImportState> {
  const { supabase } = await requireAdmin();
  const intent = formData.get('intent');
  if (intent === 'reset') return { status: 'idle' };
  const groupId = text(formData, 'groupId');
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ...previous, error: 'Kies eerst een .xlsx-bestand.' };
  if (file.size > MAX_FILE_BYTES) return { status: 'idle', error: 'Het bestand is groter dan 2 MB.' };
  let sheets;
  try {
    sheets = await readWorkbook(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    return { status: 'idle', error: error instanceof ImportFileError ? error.message : 'Het bestand kan niet worden gelezen.' };
  }
  const existing = (await loadSpots(supabase)).filter((spot) => spot.groupId === groupId).map((spot) => spot.name);
  const plan = planLocations(sheets, existing);
  const base: LocationImportState = {
    status: 'preview',
    fileName: file.name,
    groupId,
    preview: { count: plan.rows.length, newSpots: plan.newSpots, errors: plan.errors, notices: plan.notices },
  };
  if (intent !== 'apply') return base;
  if (plan.errors.length > 0) return { ...base, error: 'Los eerst de fouten op. Er is niets opgeslagen.' };
  const saved = await supabase.rpc('import_locations', { p_group_id: groupId, p_rows: plan.rows as unknown as Json });
  if (saved.error) return { ...base, error: dbErrorMessage(saved.error, 'Inlezen is mislukt. Er is niets opgeslagen.') };
  revalidatePath('/', 'layout');
  return { status: 'done', fileName: file.name, saved: saved.data ?? 0 };
}
