'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { dbErrorMessage } from '@/lib/admin/errors';
import { isUuid, type ActionState } from '@/lib/admin/forms';
import { requireLead, requireViewer } from '@/lib/auth/session';
import { loadIncident, loadRegistrationSettings, loadWorkshops } from '@/lib/db/registration-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { parseIncidentForm } from '@/lib/registrations/forms';
import { canEditOwn } from '@/lib/registrations/status';

function done(path: string, code: string): never {
  revalidatePath('/', 'layout');
  redirect(`${path}${path.includes('?') ? '&' : '?'}melding=${code}`);
}

/** Een nieuwe melding (V58). Altijd op eigen naam: de database vult in wie het doet. */
export async function createIncident(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const [workshops, settings] = await Promise.all([loadWorkshops(viewer.supabase), loadRegistrationSettings(viewer.supabase)]);
  const parsed = parseIncidentForm(formData, { now: new Date(), workshops: workshops.filter((item) => item.isActive), chargeFrom: settings.chargeFrom });
  if (!parsed.ok) return parsed.state;
  const input = parsed.data;
  const saved = await viewer.supabase.from('incident_reports').insert({
    group_id: input.groupId,
    workshop_id: input.workshopId,
    occurred_at: input.occurredAt,
    kind: input.kind,
    missing: input.missing,
    cancelled_at: input.cancelledAt,
    charge: input.charge,
    license_plate: input.plate,
    contract_number: input.contractNumber,
    note: input.note,
  });
  if (saved.error) return { error: dbErrorMessage(saved.error) };
  done(`/meldingen?vestiging=${input.groupId}`, 'gemeld');
}

/** Een melding wijzigen (V59): de maker op dezelfde dag, anders beheerder of teamleider. RLS controleert het ook. */
export async function updateIncident(_previous: ActionState, formData: FormData): Promise<ActionState> {
  const viewer = await requireViewer();
  const id = formData.get('id');
  if (!isUuid(id)) return { error: 'Deze melding bestaat niet meer.' };
  const [incident, workshops, settings] = await Promise.all([
    loadIncident(viewer.supabase, id),
    loadWorkshops(viewer.supabase),
    loadRegistrationSettings(viewer.supabase),
  ]);
  if (!incident) return { error: 'Deze melding bestaat niet meer.' };
  const today = todayInAmsterdam(new Date());
  if (!canEditOwn({ ownerId: incident.reportedBy, createdAt: incident.createdAt }, viewer, today)) {
    return { error: 'Je kunt deze melding niet meer wijzigen. Vraag het je teamleider.' };
  }
  // Een werkplaats die intussen op inactief staat, mag bij deze melding blijven staan.
  const allowed = workshops.filter((item) => item.isActive || item.id === incident.workshopId);
  const parsed = parseIncidentForm(formData, { now: new Date(), workshops: allowed, chargeFrom: settings.chargeFrom });
  if (!parsed.ok) return parsed.state;
  const input = parsed.data;
  if (incident.chargedAt && input.charge !== true) {
    return { error: 'Deze annulering is al doorbelast. Zet eerst op de doorbelastlijst terug dat het niet is doorbelast.' };
  }
  const saved = await viewer.supabase
    .from('incident_reports')
    .update({
      group_id: input.groupId,
      workshop_id: input.workshopId,
      occurred_at: input.occurredAt,
      kind: input.kind,
      missing: input.missing,
      cancelled_at: input.cancelledAt,
      charge: input.charge,
      license_plate: input.plate,
      contract_number: input.contractNumber,
      note: input.note,
    })
    .eq('id', id)
    .select('id');
  if (saved.error) return { error: dbErrorMessage(saved.error) };
  if (!saved.data?.length) return { error: 'Opslaan is niet gelukt: je hebt hier geen rechten voor, of de melding bestaat niet meer.' };
  done(`/meldingen?vestiging=${input.groupId}`, 'gewijzigd');
}

export async function deleteIncident(formData: FormData): Promise<void> {
  const viewer = await requireViewer();
  const id = formData.get('id');
  if (!isUuid(id)) done('/meldingen', 'niet-gevonden');
  const removed = await viewer.supabase.from('incident_reports').delete().eq('id', id).select('id');
  if (removed.error) done('/meldingen', 'fout');
  done('/meldingen', removed.data?.length ? 'verwijderd' : 'geen-rechten');
}

/** Doorbelast ja of nee (V62): alleen beheerder of teamleider. */
export async function setCharged(formData: FormData): Promise<void> {
  const viewer = await requireLead();
  const id = formData.get('id');
  if (!isUuid(id)) done('/meldingen/doorbelasten', 'niet-gevonden');
  const saved = await viewer.supabase.rpc('set_incident_charged', { p_id: id, p_charged: formData.get('charged') === 'ja' });
  done('/meldingen/doorbelasten', saved.error ? 'fout' : 'doorbelast');
}
