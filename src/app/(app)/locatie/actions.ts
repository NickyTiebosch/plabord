'use server';

import { revalidatePath } from 'next/cache';
import { isUuid, type ActionState } from '@/lib/admin/forms';
import { requireViewer } from '@/lib/auth/session';
import { formatPlate, normalizePlate } from '@/lib/loans/plates';
import { cleanModel } from '@/lib/locations/status';

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

/**
 * Een auto op een plek zetten (V74): kenteken en plek, het model mag. Staat de auto al ergens, dan
 * verhuist hij. De database controleert de rechten nog een keer.
 */
export async function placeVehicle(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireViewer();
  const plate = normalizePlate(text(formData, 'plate'));
  const spotId = formData.get('spotId');
  const fieldErrors: Record<string, string> = {};
  if (!plate) fieldErrors.plate = 'Vul een kenteken in: 2 tot 10 letters en cijfers.';
  if (!isUuid(spotId)) fieldErrors.spotId = 'Kies een plek.';
  if (!plate || !isUuid(spotId)) return { error: 'Controleer de gemarkeerde velden.', fieldErrors };
  const saved = await supabase.rpc('place_vehicle', { p_plate: plate, p_spot_id: spotId, p_model: cleanModel(text(formData, 'model')) });
  if (saved.error) return { error: saved.error.code === '42501' ? 'Je hebt hier geen rechten voor.' : saved.error.message };
  revalidatePath('/locatie');
  revalidatePath('/zoeken');
  return { ok: true, message: `${formatPlate(plate)} staat op de nieuwe plek.` };
}

/** Weg van het terrein (V74). */
export async function removeVehicle(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await requireViewer();
  const plate = normalizePlate(text(formData, 'plate'));
  if (!plate) return { error: 'Onbekend kenteken.' };
  const removed = await supabase.rpc('remove_vehicle', { p_plate: plate });
  if (removed.error) return { error: removed.error.code === '42501' ? 'Je hebt hier geen rechten voor.' : removed.error.message };
  revalidatePath('/locatie');
  revalidatePath('/zoeken');
  return { ok: true, message: removed.data ? `${formatPlate(plate)} is van het terrein.` : `${formatPlate(plate)} stond al niet meer op het terrein.` };
}
