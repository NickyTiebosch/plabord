'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dbErrorMessage } from '@/lib/admin/errors';
import { isUuid, type ActionState } from '@/lib/admin/forms';
import { requireViewer, type Viewer } from '@/lib/auth/session';
import { loadLoan, loadLoanGroups } from '@/lib/db/loan-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { correctionChanges, parseCorrectionForm, parseHandOutForm, parseReturnForm } from '@/lib/loans/forms';
import { formatPlate, normalizePlate } from '@/lib/loans/plates';
import { formatLoanMoment } from '@/lib/loans/status';
import { canEditOwn } from '@/lib/registrations/status';

const LIST = '/mobiliteit';
const ARCHIVE = '/mobiliteit/archief';

/** Terug naar een lijst met een melding (?melding=…) en eventueel het kenteken erbij. */
function back(path: string, code: string, extra: Record<string, string> = {}): never {
  revalidatePath('/', 'layout');
  redirect(`${path}?${new URLSearchParams({ melding: code, ...extra })}`);
}

/** "staat nog uitgeleend aan Mobiliteit (Den Bosch), sinds vandaag 09:12". */
async function stillOutMessage(viewer: Viewer, plate: string, exceptId: string | null): Promise<string | null> {
  let query = viewer.supabase
    .from('vehicle_loans')
    .select('id, group_id, handed_to, handed_out_at')
    .eq('license_plate', plate)
    .is('returned_at', null);
  if (exceptId) query = query.neq('id', exceptId);
  const open = (await query).data?.[0];
  if (!open) return null;
  const groups = await loadLoanGroups(viewer.supabase);
  const group = groups.find((item) => item.id === open.group_id)?.name ?? open.group_id;
  const since = formatLoanMoment(new Date(open.handed_out_at).toISOString(), todayInAmsterdam(new Date()));
  return `${formatPlate(plate)} staat nog uitgeleend aan ${open.handed_to} (${group}), sinds ${since}. Meld hem eerst retour.`;
}

/** Een auto aanmelden (V46). Altijd op eigen naam: de database vult in wie het doet. */
export async function handOutVehicle(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const groups = await loadLoanGroups(viewer.supabase);
  const parsed = parseHandOutForm(formData, { now: new Date(), groupIds: groups.map((group) => group.id) });
  if (!parsed.ok) return parsed.state;
  const input = parsed.data;

  const stillOut = await stillOutMessage(viewer, input.plate, null);
  if (stillOut) return { error: stillOut };

  const saved = await viewer.supabase.from('vehicle_loans').insert({
    group_id: input.groupId,
    license_plate: input.plate,
    model: input.model,
    destination: input.destination,
    handed_to: input.handedTo,
    handed_out_at: input.handedOutAt,
    odometer_out: input.odometerOut,
    note: input.note,
  });
  if (saved.error) {
    // Net tegelijk door een collega aangemeld.
    if (saved.error.code === '23505') {
      return { error: (await stillOutMessage(viewer, input.plate, null)) ?? dbErrorMessage(saved.error) };
    }
    return { error: dbErrorMessage(saved.error) };
  }
  back(LIST, 'aangemeld', {
    kenteken: input.plate,
    bestemming: input.destination,
    aan: input.handedTo,
    vestiging: input.groupId,
  });
}

/** Retour · ingezet (V47): met kilometerstand, tijdstip en een opmerking. */
export async function returnUsed(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) return { error: 'Deze registratie bestaat niet meer.' };
  const loan = await loadLoan(viewer.supabase, id);
  if (!loan) return { error: 'Deze registratie bestaat niet meer.' };
  if (loan.returnedAt) back(LIST, 'al-retour', { kenteken: loan.plate });
  const parsed = parseReturnForm(formData, { now: new Date(), loan });
  if (!parsed.ok) return parsed.state;
  const result = await viewer.supabase.rpc('return_vehicle_loan', {
    p_id: id,
    p_was_used: true,
    p_odometer_in: parsed.data.odometerIn,
    p_note: parsed.data.note,
    p_returned_at: parsed.data.returnedAt,
  });
  if (result.error) return { error: dbErrorMessage(result.error) };
  back(LIST, result.data === 0 ? 'al-retour' : 'retour', { kenteken: loan.plate });
}

/** Retour · niet ingezet (V47): één tik. */
export async function returnNotUsed(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) back(LIST, 'niet-gevonden');
  const result = await viewer.supabase.rpc('return_vehicle_loan', { p_id: id, p_was_used: false });
  const plate = String(formData.get('kenteken') ?? '');
  if (result.error) back(LIST, 'retour-mislukt', { kenteken: plate });
  back(LIST, result.data === 0 ? 'al-retour' : 'retour-niet-ingezet', { kenteken: plate });
}

/**
 * Na een retour: waar staat de auto nu (fase 8)? Eén tik op een plek zet hem bij Locatie. Lukt het
 * niet, dan blijft de retour gewoon staan.
 */
export async function placeAfterReturn(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const plate = normalizePlate(String(formData.get('kenteken') ?? ''));
  const spotId = formData.get('spotId');
  if (!plate || !isUuid(spotId)) back(LIST, 'plaatsen-mislukt');
  const result = await viewer.supabase.rpc('place_vehicle', { p_plate: plate, p_spot_id: spotId, p_model: null });
  back(LIST, result.error ? 'plaatsen-mislukt' : 'geplaatst', { kenteken: plate });
}

/** Retour ongedaan maken (V47): wie het meldde, vandaag; daarna de teamleider of beheerder. */
export async function undoReturn(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const id = String(formData.get('id') ?? '');
  const plate = String(formData.get('kenteken') ?? '');
  const to = formData.get('terug') === 'archief' ? ARCHIVE : LIST;
  if (!isUuid(id)) back(to, 'niet-gevonden');
  const result = await viewer.supabase.rpc('undo_vehicle_loan_return', { p_id: id });
  if (result.error) {
    back(to, result.error.code === '23505' ? 'ongedaan-weer-uit' : result.error.code === '42501' ? 'ongedaan-niet-toegestaan' : 'ongedaan-mislukt', {
      kenteken: plate,
    });
  }
  back(LIST, result.data === 0 ? 'niet-gevonden' : 'ongedaan', { kenteken: plate });
}

/** Mag deze kijker de registratie corrigeren (V59)? Wie aanmeldde op dezelfde dag, of beheerder of teamleider. RLS controleert het ook. */
function mayCorrect(viewer: Viewer, loan: { handedOutBy: string | null; createdAt?: string }): boolean {
  return canEditOwn({ ownerId: loan.handedOutBy, createdAt: loan.createdAt ?? '1970-01-01T00:00:00.000Z' }, viewer, todayInAmsterdam(new Date()));
}

/** Corrigeren: alles van de registratie. In het logboek staat wat er veranderde. */
export async function correctLoan(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) return { error: 'Deze registratie bestaat niet meer.' };
  const [loan, groups] = await Promise.all([loadLoan(viewer.supabase, id), loadLoanGroups(viewer.supabase)]);
  if (!loan) return { error: 'Deze registratie bestaat niet meer.' };
  if (!mayCorrect(viewer, loan)) return { error: 'Je kunt deze registratie niet meer corrigeren. Vraag het je teamleider.' };
  const parsed = parseCorrectionForm(formData, {
    now: new Date(),
    groupIds: groups.map((group) => group.id),
    returned: Boolean(loan.returnedAt),
  });
  if (!parsed.ok) return parsed.state;
  const input = parsed.data;
  if (!input.return) {
    const stillOut = await stillOutMessage(viewer, input.plate, id);
    if (stillOut) return { error: stillOut };
  }
  // Alleen wat echt verandert: zo staat in het logboek wat er is aangepast, en niets anders.
  const changes = correctionChanges(loan, input);
  if (Object.keys(changes).length === 0) back(loan.returnedAt ? ARCHIVE : LIST, 'niets-gewijzigd', { kenteken: loan.plate });
  const saved = await viewer.supabase.from('vehicle_loans').update(changes).eq('id', id).select('id');
  if (saved.error) return { error: dbErrorMessage(saved.error) };
  if (!saved.data?.length) return { error: 'Opslaan is niet gelukt: je hebt hier geen rechten voor, of de registratie bestaat niet meer.' };
  back(loan.returnedAt ? ARCHIVE : LIST, 'gecorrigeerd', { kenteken: input.plate });
}

/** Verwijderen, bijvoorbeeld een dubbele of verkeerde registratie. Dezelfde regel als corrigeren (V59). */
export async function deleteLoan(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const id = String(formData.get('id') ?? '');
  if (!isUuid(id)) back(LIST, 'niet-gevonden');
  const loan = await loadLoan(viewer.supabase, id);
  if (!loan) back(LIST, 'niet-gevonden');
  if (!mayCorrect(viewer, loan)) back(LIST, 'verwijderen-mislukt', { kenteken: loan.plate });
  const removed = await viewer.supabase.from('vehicle_loans').delete().eq('id', id).select('id');
  const to = loan.returnedAt ? ARCHIVE : LIST;
  if (removed.error || !removed.data?.length) back(to, 'verwijderen-mislukt', { kenteken: loan.plate });
  back(to, 'verwijderd', { kenteken: loan.plate });
}
