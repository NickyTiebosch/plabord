/**
 * Formulieren van de uitleen (fase 5): aanmelden, retour melden en corrigeren. Lezen uit FormData
 * en controleren. Puur: "nu" komt binnen als parameter.
 */
import { z } from 'zod';
import { cleanName, type Parsed } from '../admin/forms';
import { amsterdamDateTime, isIsoDate } from '../engine/dates';
import { parseTime } from '../engine/time';
import { normalizePlate } from './plates';
import { amsterdamInstant } from './time';
import { DESTINATIONS, type Destination } from './types';

/** Zo ver vooruit mag een tijdstip liggen: de klok van een telefoon loopt soms iets voor. */
const FUTURE_MARGIN_MS = 5 * 60_000;
/** Zo ver terug kun je een auto nog aanmelden. */
const MAX_PAST_DAYS = 366;
export const MAX_ODOMETER = 2_000_000;

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

/** Kilometerstand: cijfers, met of zonder punten of spaties ("45.210"). Leeg = onbekend. */
export function parseOdometer(value: string): number | null | 'invalid' {
  const cleaned = value.replace(/[\s.]/g, '');
  if (cleaned === '') return null;
  if (!/^\d{1,7}$/.test(cleaned)) return 'invalid';
  const number = Number(cleaned);
  return number <= MAX_ODOMETER ? number : 'invalid';
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    errors[key] ??= issue.message;
  }
  return errors;
}

function parse<T>(schema: z.ZodType<T>, input: unknown): Parsed<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, state: { error: 'Controleer de gemarkeerde velden.', fieldErrors: fieldErrors(result.error) } };
}

const odometer = (label: string) =>
  z.string().transform((value, context) => {
    const parsed = parseOdometer(value);
    if (parsed === 'invalid') {
      context.addIssue({ code: 'custom', message: `Vul bij ${label} alleen cijfers in, bijvoorbeeld 45210.` });
      return z.NEVER;
    }
    return parsed;
  });

const optionalNote = (label: string) =>
  z
    .string()
    .transform(cleanName)
    .pipe(z.string().max(200, { error: `${label}: maximaal 200 tekens.` }))
    .transform((value) => (value === '' ? null : value));

/** Datum en tijd in Nederlandse tijd naar een tijdstip, met controle op toekomst en verleden. */
function moment(
  date: string,
  time: string,
  now: Date,
  context: z.RefinementCtx,
  path: string,
  label: string,
): string | null {
  const parsedTime = parseTime(time);
  if (!isIsoDate(date) || !parsedTime) {
    context.addIssue({ code: 'custom', path: [path], message: `Vul bij ${label} een geldige datum en tijd in.` });
    return null;
  }
  const instant = amsterdamInstant(date, parsedTime);
  if (instant.getTime() > now.getTime() + FUTURE_MARGIN_MS) {
    context.addIssue({ code: 'custom', path: [path], message: `${label} ligt in de toekomst.` });
    return null;
  }
  if (instant.getTime() < now.getTime() - MAX_PAST_DAYS * 86_400_000) {
    context.addIssue({ code: 'custom', path: [path], message: `${label} ligt meer dan een jaar terug.` });
    return null;
  }
  return instant.toISOString();
}

// Aanmelden ----------------------------------------------------------------------

export interface HandOutInput {
  groupId: string;
  plate: string;
  model: string;
  odometerOut: number | null;
  handedOutAt: string;
  destination: Destination;
  handedTo: string;
  note: string | null;
}

function handOutSchema(now: Date, groupIds: readonly string[]) {
  return z
    .object({
      groupId: z.string().refine((value) => groupIds.includes(value), { error: 'Kies de vestiging die de auto meegeeft.' }),
      plate: z.string().transform((value, context) => {
        const plate = normalizePlate(value);
        if (!plate) {
          context.addIssue({ code: 'custom', message: 'Vul een kenteken in: 2 tot 10 letters en cijfers.' });
          return z.NEVER;
        }
        return plate;
      }),
      model: z
        .string()
        .transform(cleanName)
        .pipe(
          z
            .string()
            .min(1, { error: 'Vul het model in, bijvoorbeeld Polo.' })
            .max(40, { error: 'Model: maximaal 40 tekens.' }),
        ),
      odometerOut: odometer('de kilometerstand'),
      date: z.string(),
      time: z.string(),
      destination: z.enum(DESTINATIONS, { error: 'Kies de bestemming: Mobiliteit of Werkplaats (weekend).' }),
      handedTo: z
        .string()
        .transform(cleanName)
        .pipe(
          z
            .string()
            .min(1, { error: 'Vul in aan wie de auto is meegegeven.' })
            .max(60, { error: 'Meegegeven aan: maximaal 60 tekens.' }),
        ),
      note: optionalNote('Opmerking'),
    })
    .transform((value, context) => {
      const handedOutAt = moment(value.date, value.time, now, context, 'date', 'Het moment van meegeven');
      if (!handedOutAt) return z.NEVER;
      return {
        groupId: value.groupId,
        plate: value.plate,
        model: value.model,
        odometerOut: value.odometerOut,
        handedOutAt,
        destination: value.destination,
        handedTo: value.handedTo,
        note: value.note,
      };
    });
}

export function parseHandOutForm(form: FormData, options: { now: Date; groupIds: readonly string[] }): Parsed<HandOutInput> {
  return parse(handOutSchema(options.now, options.groupIds), {
    groupId: text(form, 'groupId'),
    plate: text(form, 'plate'),
    model: text(form, 'model'),
    odometerOut: text(form, 'odometerOut'),
    date: text(form, 'date'),
    time: text(form, 'time'),
    destination: text(form, 'destination'),
    handedTo: text(form, 'handedTo'),
    note: text(form, 'note'),
  });
}

// Retour melden ------------------------------------------------------------------

export interface ReturnInput {
  odometerIn: number | null;
  returnedAt: string;
  note: string | null;
}

function checkReturn(
  value: { odometerIn: number | null; returnedAt: string },
  loan: { handedOutAt: string; odometerOut: number | null },
  context: z.RefinementCtx,
): boolean {
  let ok = true;
  if (Date.parse(value.returnedAt) < Date.parse(loan.handedOutAt)) {
    const out = amsterdamDateTime(new Date(loan.handedOutAt));
    context.addIssue({
      code: 'custom',
      path: ['date'],
      message: `Retour kan niet vóór het meegeven liggen (${out.date.split('-').reverse().join('-')} ${out.time}).`,
    });
    ok = false;
  }
  if (value.odometerIn !== null && loan.odometerOut !== null && value.odometerIn < loan.odometerOut) {
    context.addIssue({
      code: 'custom',
      path: ['odometerIn'],
      message: `De kilometerstand bij retour is lager dan bij het meegeven (${loan.odometerOut}).`,
    });
    ok = false;
  }
  return ok;
}

export function parseReturnForm(
  form: FormData,
  options: { now: Date; loan: { handedOutAt: string; odometerOut: number | null } },
): Parsed<ReturnInput> {
  const schema = z
    .object({ odometerIn: odometer('de kilometerstand'), date: z.string(), time: z.string(), note: optionalNote('Opmerking') })
    .transform((value, context) => {
      const returnedAt = moment(value.date, value.time, options.now, context, 'date', 'Het moment van retour');
      if (!returnedAt) return z.NEVER;
      const result = { odometerIn: value.odometerIn, returnedAt, note: value.note };
      if (!checkReturn(result, options.loan, context)) return z.NEVER;
      return result;
    });
  return parse(schema, {
    odometerIn: text(form, 'odometerIn'),
    date: text(form, 'date'),
    time: text(form, 'time'),
    note: text(form, 'note'),
  });
}

// Corrigeren (teamleider of beheerder) -------------------------------------------

export interface CorrectionInput extends HandOutInput {
  /** Alleen als de auto al retour is. */
  return: { returnedAt: string; odometerIn: number | null; wasUsed: boolean; note: string | null } | null;
}

/** Corrigeren: alles van het aanmelden, en bij een auto die retour is ook de retourgegevens. */
export function parseCorrectionForm(
  form: FormData,
  options: { now: Date; groupIds: readonly string[]; returned: boolean },
): Parsed<CorrectionInput> {
  const handOut = parseHandOutForm(form, options);
  if (!options.returned) return handOut.ok ? { ok: true, data: { ...handOut.data, return: null } } : handOut;

  const schema = z
    .object({
      odometerIn: odometer('de kilometerstand bij retour'),
      returnDate: z.string(),
      returnTime: z.string(),
      wasUsed: z.enum(['ja', 'nee'], { error: 'Kies of de auto is ingezet.' }),
      returnNote: optionalNote('Opmerking bij retour'),
    })
    .transform((value, context) => {
      const returnedAt = moment(value.returnDate, value.returnTime, options.now, context, 'returnDate', 'Het moment van retour');
      if (!returnedAt) return z.NEVER;
      if (handOut.ok && !checkReturn({ odometerIn: value.odometerIn, returnedAt }, handOut.data, context)) return z.NEVER;
      return { returnedAt, odometerIn: value.odometerIn, wasUsed: value.wasUsed === 'ja', note: value.returnNote };
    });
  const returned = parse(schema, {
    odometerIn: text(form, 'odometerIn'),
    returnDate: text(form, 'returnDate'),
    returnTime: text(form, 'returnTime'),
    wasUsed: text(form, 'wasUsed'),
    returnNote: text(form, 'returnNote'),
  });
  if (handOut.ok && returned.ok) return { ok: true, data: { ...handOut.data, return: returned.data } };
  const errors = {
    ...(handOut.ok ? {} : handOut.state.fieldErrors),
    ...(returned.ok ? {} : returned.state.fieldErrors),
  };
  return { ok: false, state: { error: 'Controleer de gemarkeerde velden.', fieldErrors: errors } };
}
