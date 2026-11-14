'use server';

import { revalidatePath } from 'next/cache';
import { dbErrorMessage } from '@/lib/admin/errors';
import { isUuid, type ActionState } from '@/lib/admin/forms';
import { requireAdmin } from '@/lib/auth/session';
import { parseTime } from '@/lib/engine/time';
import { parseWorkshopName } from '@/lib/registrations/forms';

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

/** Een werkplaats toevoegen (V56): achteraan in de lijst van de vestiging. */
export async function addWorkshop(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const groupId = text(formData, 'groupId');
  const name = parseWorkshopName(formData.get('name'));
  if (!name) return { error: 'Vul een naam in van 1 tot 40 tekens.' };
  const last = await supabase.from('workshops').select('sort_order').eq('group_id', groupId).order('sort_order', { ascending: false }).limit(1);
  const saved = await supabase.from('workshops').insert({ group_id: groupId, name, sort_order: (last.data?.[0]?.sort_order ?? 0) + 1 });
  if (saved.error) return { error: saved.error.message.includes('workshops_name_key') ? 'Deze werkplaats bestaat al bij deze vestiging.' : dbErrorMessage(saved.error) };
  revalidatePath('/', 'layout');
  return { ok: true, message: `${name} toegevoegd.` };
}

/** Naam, volgorde en actief van één werkplaats. Verwijderen kan alleen zolang er geen cijfers aan hangen. */
export async function saveWorkshop(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = formData.get('id');
  if (!isUuid(id)) return { error: 'Deze werkplaats bestaat niet meer.' };
  if (formData.get('intent') === 'delete') {
    const removed = await supabase.from('workshops').delete().eq('id', id).select('id');
    if (removed.error) {
      return { error: 'Verwijderen kan niet: er hangen binnenvallers of meldingen aan. Zet de werkplaats op inactief.' };
    }
    revalidatePath('/', 'layout');
    return { ok: true, message: 'Werkplaats verwijderd.' };
  }
  const name = parseWorkshopName(formData.get('name'));
  const order = Number(text(formData, 'sortOrder'));
  if (!name) return { error: 'Vul een naam in van 1 tot 40 tekens.' };
  if (!Number.isInteger(order) || order < 0 || order > 99) return { error: 'Vul bij de volgorde een getal in van 0 tot en met 99.' };
  const saved = await supabase.from('workshops').update({ name, sort_order: order, is_active: formData.get('isActive') === 'on' }).eq('id', id);
  if (saved.error) return { error: saved.error.message.includes('workshops_name_key') ? 'Deze naam bestaat al bij deze vestiging.' : dbErrorMessage(saved.error) };
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Opgeslagen.' };
}

/** De twee tijdstippen: vanaf wanneer een annulering wordt doorbelast (V58) en de herinnering (V61). */
export async function saveRegistrationTimes(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const chargeFrom = parseTime(text(formData, 'chargeFrom'));
  if (!chargeFrom) return { error: 'Vul bij doorbelasten een tijd in, bijvoorbeeld 11:00.' };
  const reminderText = text(formData, 'reminderAt');
  const reminderAt = reminderText === '' ? null : parseTime(reminderText);
  if (reminderText !== '' && !reminderAt) return { error: 'Vul bij de herinnering een tijd in, of laat het veld leeg.' };
  const saved = await supabase.from('settings').update({ charge_cancellation_from: chargeFrom, day_close_reminder_at: reminderAt }).eq('id', true);
  if (saved.error) return { error: dbErrorMessage(saved.error) };
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Tijdstippen opgeslagen.' };
}
