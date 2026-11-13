/**
 * Het formulier van een melding (fase 6, V58). Lezen uit FormData en controleren. Puur: "nu" komt
 * binnen als parameter.
 */
import { cleanName, type Parsed } from '../admin/forms';
import { isIsoDate } from '../engine/dates';
import { parseTime } from '../engine/time';
import type { IsoDate, TimeOfDay } from '../engine/types';
import { normalizePlate } from '../loans/plates';
import { amsterdamInstant } from '../loans/time';
import { shouldCharge } from './status';
import { isIncidentKind, isMissing, type IncidentKind, type Missing, type Workshop } from './types';

/** Zo ver vooruit mag een tijdstip liggen: de klok van een telefoon loopt soms iets voor. */
const FUTURE_MARGIN_MS = 5 * 60_000;
/** Zo ver terug kun je een melding nog invoeren. */
const MAX_PAST_DAYS = 366;
export const MAX_NOTE = 300;

export interface IncidentInput {
  groupId: string;
  workshopId: string;
  occurredAt: string;
  kind: IncidentKind;
  missing: Missing | null;
  cancelledAt: TimeOfDay | null;
  charge: boolean | null;
  plate: string | null;
  contractNumber: string | null;
  note: string | null;
}

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Een melding uit het formulier. `workshops`: de werkplaatsen waaruit je mag kiezen. `chargeFrom`:
 * het tijdstip waarna een annulering wordt doorbelast; het veld `charge` kan dat per melding
 * omzetten ("ja" of "nee"), leeg volgt de regel.
 */
export function parseIncidentForm(
  form: FormData,
  options: { now: Date; workshops: readonly Workshop[]; chargeFrom: TimeOfDay },
): Parsed<IncidentInput> {
  const errors: Record<string, string> = {};
  const workshop = options.workshops.find((candidate) => candidate.id === text(form, 'workshopId'));
  if (!workshop) errors.workshopId = 'Kies een werkplaats.';

  const kindValue = text(form, 'kind');
  const kind = isIncidentKind(kindValue) ? kindValue : null;
  if (!kind) errors.kind = 'Kies de soort melding.';

  const date = text(form, 'date');
  const time = parseTime(text(form, 'time'));
  let occurredAt: string | null = null;
  if (!isIsoDate(date)) errors.date = 'Vul een datum in.';
  else if (!time) errors.time = 'Vul een tijd in, bijvoorbeeld 09:15.';
  else {
    const moment = amsterdamInstant(date as IsoDate, time);
    if (moment.getTime() > options.now.getTime() + FUTURE_MARGIN_MS) errors.date = 'Dit moment ligt in de toekomst.';
    else if (moment.getTime() < options.now.getTime() - MAX_PAST_DAYS * 86_400_000) errors.date = 'Dit is langer dan een jaar geleden.';
    else occurredAt = moment.toISOString();
  }

  let missing: Missing | null = null;
  if (kind === 'contract_license') {
    const value = text(form, 'missing');
    if (isMissing(value)) missing = value;
    else errors.missing = 'Kies wat er ontbrak.';
  }

  let cancelledAt: TimeOfDay | null = null;
  let charge: boolean | null = null;
  if (kind === 'cancellation') {
    cancelledAt = parseTime(text(form, 'cancelledAt'));
    if (!cancelledAt) errors.cancelledAt = 'Vul in hoe laat de werkplaats annuleerde, bijvoorbeeld 11:20.';
    const choice = text(form, 'charge');
    if (choice === 'ja') charge = true;
    else if (choice === 'nee') charge = false;
    else if (cancelledAt) charge = shouldCharge(cancelledAt, options.chargeFrom);
  }

  const plateValue = text(form, 'plate');
  const plate = plateValue === '' ? null : normalizePlate(plateValue);
  if (plateValue !== '' && !plate) errors.plate = 'Vul een kenteken in: 2 tot 10 letters en cijfers.';

  const contractNumber = cleanName(text(form, 'contractNumber')) || null;
  if (contractNumber && contractNumber.length > 20) errors.contractNumber = 'Maximaal 20 tekens.';

  const note = cleanName(text(form, 'note')) || null;
  if (note && note.length > MAX_NOTE) errors.note = `Maximaal ${MAX_NOTE} tekens.`;

  if (Object.keys(errors).length > 0 || !workshop || !kind || !occurredAt) {
    return { ok: false, state: { error: 'Controleer de gemarkeerde velden.', fieldErrors: errors } };
  }
  return {
    ok: true,
    data: { groupId: workshop.groupId, workshopId: workshop.id, occurredAt, kind, missing, cancelledAt, charge, plate, contractNumber, note },
  };
}

/** Een werkplaats uit de instellingen: naam, 1 tot 40 tekens. */
export function parseWorkshopName(value: unknown): string | null {
  const name = typeof value === 'string' ? cleanName(value) : '';
  return name.length >= 1 && name.length <= 40 ? name : null;
}
