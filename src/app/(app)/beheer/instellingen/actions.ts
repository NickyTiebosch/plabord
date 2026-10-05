'use server';

import { revalidatePath } from 'next/cache';
import { dbErrorMessage } from '@/lib/admin/errors';
import { parseNumberFields, parseSettingsForm, type ActionState } from '@/lib/admin/forms';
import { requireAdmin } from '@/lib/auth/session';
import { must } from '@/lib/db/queries';
import { sendTestMail, sendTestPush } from '@/lib/mail/dispatch';
import { siteBaseUrl } from '@/lib/site-url';

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

/** Meldingen (mail en push) aan of uit (fase 3, V18; fase 4, V27). Staat in het logboek. */
export async function setMailEnabled(formData: FormData): Promise<void> {
  const { supabase } = await requireAdmin();
  const enabled = formData.get('mails') === 'aan';
  await supabase.from('settings').update({ mail_enabled: enabled }).eq('id', true);
  revalidatePath('/beheer', 'layout');
}

/** Een testmail aan je eigen werkmail (V18). Gaat ook als mails uit staan. */
export async function sendTestMailAction(): Promise<ActionState> {
  const { supabase, employeeId } = await requireAdmin();
  const result = await sendTestMail(supabase, employeeId, { now: new Date(), appUrl: `${await siteBaseUrl()}/` });
  revalidatePath('/beheer/mails');
  if (result === 'verstuurd') {
    return { ok: true, message: 'Testmail verstuurd naar je werkmail. Kijk in je inbox, en anders bij spam.' };
  }
  if (result === 'geen-adres') return { error: 'Je hebt geen werkmail in Planbord, dus de testmail kan nergens heen.' };
  return {
    error:
      'De testmail kon niet worden verstuurd. Controleer in Netlify SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD en MAIL_FROM (zie de README).',
  };
}

/** Een testmelding aan je eigen toestellen (fase 4, V27). Gaat ook als meldingen uit staan. */
export async function sendTestPushAction(): Promise<ActionState> {
  const { supabase, employeeId } = await requireAdmin();
  const result = await sendTestPush(supabase, employeeId, { now: new Date(), appUrl: null });
  switch (result.status) {
    case 'verstuurd':
      return {
        ok: true,
        message:
          result.sent === result.devices
            ? `Testmelding verstuurd naar ${result.sent === 1 ? 'je toestel' : `je ${result.sent} toestellen`}.`
            : `Testmelding verstuurd naar ${result.sent} van je ${result.devices} toestellen.`,
      };
    case 'geen-toestel':
      return { error: 'Je hebt op geen enkel toestel meldingen aan. Zet ze aan onderaan Mijn rooster, op je telefoon.' };
    case 'niet-ingesteld':
      return { error: 'Push is nog niet ingesteld: zet eerst de sleutels in Netlify (zie hieronder).' };
    case 'mislukt':
      return { error: 'De testmelding kon niet worden verstuurd. Controleer de sleutels in Netlify en probeer het opnieuw.' };
  }
}
