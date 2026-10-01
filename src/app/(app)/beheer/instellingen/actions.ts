'use server';

import { revalidatePath } from 'next/cache';
import { dbErrorMessage } from '@/lib/admin/errors';
import { parseNumberFields, parseSettingsForm, type ActionState } from '@/lib/admin/forms';
import { requireAdmin } from '@/lib/auth/session';
import { must } from '@/lib/db/queries';

export async function saveSettings(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = parseSettingsForm(formData);
  if (!parsed.ok) return parsed.state;
  const input = parsed.data;
  const saved = await supabase
    .from('settings')
    .update({
      standard_shift_start: input.standardStart,
      standard_shift_end: input.standardEnd,
      saturday_shift_start: input.saturdayStart,
      saturday_shift_end: input.saturdayEnd,
      day_part_boundary: input.dayPartBoundary,
      lookahead_weeks: input.lookaheadWeeks,
    })
    .eq('id', true);
  if (saved.error) return { error: dbErrorMessage(saved.error) };
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Instellingen opgeslagen.' };
}

/** Normen: velden "norm:{groep}:{weekdag}:{dagdeel}". Alleen wat verandert, wordt opgeslagen. */
export async function saveNorms(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = parseNumberFields(formData, 'norm', 0, 50);
  if (!parsed.ok) return { error: parsed.error };
  const current = must(await supabase.from('staffing_norms').select('group_id, weekday, day_part, min_staff'), 'de normen');
  for (const row of current) {
    const value = parsed.values.get(`${row.group_id}:${row.weekday}:${row.day_part}`);
    if (value === undefined || value === row.min_staff) continue;
    const saved = await supabase
      .from('staffing_norms')
      .update({ min_staff: value })
      .eq('group_id', row.group_id)
      .eq('weekday', row.weekday)
      .eq('day_part', row.day_part);
    if (saved.error) return { error: dbErrorMessage(saved.error) };
  }
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Normen opgeslagen.' };
}

/** Invalvolgorde: velden "rank:{groep}". Lager = eerder aan de beurt. */
export async function saveRanks(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const parsed = parseNumberFields(formData, 'rank', 1, 99);
  if (!parsed.ok) return { error: parsed.error };
  const current = must(await supabase.from('groups').select('id, substitution_rank'), 'de groepen');
  for (const group of current) {
    const value = parsed.values.get(group.id);
    if (value === undefined || value === group.substitution_rank) continue;
    const saved = await supabase.from('groups').update({ substitution_rank: value }).eq('id', group.id);
    if (saved.error) return { error: dbErrorMessage(saved.error) };
  }
  revalidatePath('/', 'layout');
  return { ok: true, message: 'Invalvolgorde opgeslagen.' };
}
