'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { isUuid } from '@/lib/admin/forms';
import { requireViewer } from '@/lib/auth/session';
import { isIsoDate } from '@/lib/engine/dates';

/** Alleen terug naar een eigen pagina van de registraties, nooit naar een adres van buiten. */
function safeBack(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === 'string' ? value : '';
  return /^\/(binnenvallers|meldingen|controle)(\/|\?|$)/.test(path) && !path.includes('//') ? path : fallback;
}

function withMessage(path: string, code: string): string {
  const [base = path, query = ''] = path.split('?');
  const params = new URLSearchParams(query);
  params.delete('melding');
  params.set('melding', code);
  return `${base}?${params}`;
}

/** Plus of min bij één werkplaats (V57). De database telt, zodat twee collega's elkaar niet overschrijven. */
export async function adjustWalkIn(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const back = safeBack(formData.get('back'), '/binnenvallers');
  const workshopId = formData.get('workshopId');
  const date = formData.get('date');
  const delta = Number(formData.get('delta'));
  if (!isUuid(workshopId) || typeof date !== 'string' || !isIsoDate(date) || !Number.isInteger(delta) || delta === 0) {
    redirect(withMessage(back, 'fout'));
  }
  const saved = await viewer.supabase.rpc('adjust_walk_in', { p_workshop_id: workshopId, p_date: date, p_delta: delta });
  revalidatePath('/', 'layout');
  if (saved.error) redirect(withMessage(back, saved.error.code === '42501' ? 'geen-rechten' : 'fout'));
  redirect(back.replace(/([?&])melding=[^&]*&?/g, '$1').replace(/[?&]$/, ''));
}

/** Dag afsluiten (V60), of bij een afgesloten dag het vinkje RentLink erbij zetten. */
export async function closeDay(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const back = safeBack(formData.get('back'), '/binnenvallers');
  const groupId = formData.get('groupId');
  const date = formData.get('date');
  if (typeof groupId !== 'string' || typeof date !== 'string' || !isIsoDate(date)) redirect(withMessage(back, 'fout'));
  const saved = await viewer.supabase.rpc('close_day', {
    p_group_id: groupId,
    p_date: date,
    p_rentlink_checked: formData.get('rentlink') === 'ja',
  });
  revalidatePath('/', 'layout');
  if (saved.error) redirect(withMessage(back, saved.error.code === '42501' ? 'geen-rechten' : 'fout'));
  redirect(withMessage(back, 'afgesloten'));
}

/** Een dag heropenen: alleen beheerder of teamleider. De database controleert dat ook. */
export async function reopenDay(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const back = safeBack(formData.get('back'), '/controle');
  const groupId = formData.get('groupId');
  const date = formData.get('date');
  if (!viewer.isLead || typeof groupId !== 'string' || typeof date !== 'string' || !isIsoDate(date)) redirect(withMessage(back, 'fout'));
  const saved = await viewer.supabase.rpc('reopen_day', { p_group_id: groupId, p_date: date });
  revalidatePath('/', 'layout');
  if (saved.error) redirect(withMessage(back, saved.error.code === '42501' ? 'geen-rechten' : 'fout'));
  redirect(withMessage(back, 'heropend'));
}
