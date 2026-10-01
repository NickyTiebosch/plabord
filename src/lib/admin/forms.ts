/**
 * Formulieren van de beheerschermen: lezen uit FormData en controleren. Puur en los te testen.
 */
import { z } from 'zod';
import { ABSENCE_PARTS, ABSENCE_STATUSES, ROLES } from '../engine/types';
import { parseTime } from '../engine/time';
import { isValidEmail, normalizeEmail } from '../import/cells';

export interface ActionState {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /**
   * Eerst bevestigen (impactcheck, fase 2): de gevolgen en een sleutel die hoort bij precies deze
   * invoer. "Toch opslaan" stuurt de sleutel mee; is de invoer intussen veranderd, dan wordt opnieuw gecontroleerd.
   */
  confirm?: { token: string; lines: string[] };
}

export type Parsed<T> = { ok: true; data: T } | { ok: false; state: ActionState };

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
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

const isoDate = (label: string) => z.iso.date({ error: `Vul een geldige datum in bij ${label}.` });
const optionalTime = (label: string) =>
  z
    .string()
    .transform((value, context) => {
      if (value === '') return null;
      const time = parseTime(value);
      if (!time) {
        context.addIssue({ code: 'custom', message: `Vul bij ${label} een tijd in als uu:mm.` });
        return z.NEVER;
      }
      return time;
    });

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Een uuid zoals Postgres die accepteert (8-4-4-4-12 hex), zonder eisen aan versie of variant. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/** Naam: zonder spaties aan begin en eind, en met enkele spaties. */
export function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

// Afwezigheid ------------------------------------------------------------------

const absenceSchema = z
  .object({
    employeeId: z.string().regex(UUID_PATTERN, { error: 'Kies een medewerker.' }),
    startDate: isoDate('van'),
    endDate: isoDate('tot'),
    dayPart: z.enum(ABSENCE_PARTS, { error: 'Kies een dagdeel.' }),
    status: z.enum(ABSENCE_STATUSES, { error: 'Kies een status.' }),
  })
  .superRefine((value, context) => {
    if (value.endDate < value.startDate) {
      context.addIssue({ code: 'custom', path: ['endDate'], message: '"Tot" mag niet vóór "van" liggen.' });
    }
    if (value.dayPart !== 'full_day' && value.startDate !== value.endDate) {
      context.addIssue({ code: 'custom', path: ['dayPart'], message: 'Een halve dag kan alleen bij één dag.' });
    }
  });

export type AbsenceInput = z.infer<typeof absenceSchema>;

export function parseAbsenceForm(form: FormData): Parsed<AbsenceInput> {
  const startDate = text(form, 'startDate');
  return parse(absenceSchema, {
    employeeId: text(form, 'employeeId'),
    startDate,
    endDate: text(form, 'endDate') || startDate,
    dayPart: text(form, 'dayPart') || 'full_day',
    status: text(form, 'status') || 'approved',
  });
}

// Medewerker -------------------------------------------------------------------

const employeeSchema = z.object({
  name: z
    .string()
    .transform(cleanName)
    .pipe(z.string().min(1, { error: 'Vul een naam in.' }).max(80, { error: 'Maximaal 80 tekens.' })),
  email: z
    .string()
    .transform((value) => (value === '' ? null : normalizeEmail(value)))
    .refine((value) => value === null || isValidEmail(value), { error: 'Vul een geldig e-mailadres in.' }),
  groupId: z.string().min(1, { error: 'Kies een groep.' }),
  defaultRole: z.enum(ROLES, { error: 'Kies een rol.' }),
  counterGroupIds: z.array(z.string()),
  isAdmin: z.boolean(),
  isActive: z.boolean(),
});

export type EmployeeInput = z.infer<typeof employeeSchema>;

export function parseEmployeeForm(form: FormData): Parsed<EmployeeInput> {
  return parse(employeeSchema, {
    name: text(form, 'name'),
    email: text(form, 'email'),
    groupId: text(form, 'groupId'),
    defaultRole: text(form, 'defaultRole') || 'none',
    counterGroupIds: form.getAll('counterGroupIds').filter((value): value is string => typeof value === 'string'),
    isAdmin: form.get('isAdmin') === 'on',
    // Een nieuw formulier heeft geen veld "actief": dan is iemand actief.
    isActive: form.has('isActivePresent') ? form.get('isActive') === 'on' : true,
  });
}

// Vaste dienst -----------------------------------------------------------------

const shiftSchema = z
  .object({
    weekday: z.coerce.number().int().min(1, { error: 'Kies een dag.' }).max(6, { error: 'Kies een dag van ma t/m za.' }),
    groupId: z.string().min(1, { error: 'Kies een groep.' }),
    role: z.enum(ROLES, { error: 'Kies een rol.' }),
    startTime: optionalTime('begintijd'),
    endTime: optionalTime('eindtijd'),
    validFrom: isoDate('geldig vanaf'),
  })
  .superRefine((value, context) => {
    if (value.startTime && value.endTime && value.endTime <= value.startTime) {
      context.addIssue({ code: 'custom', path: ['endTime'], message: 'De eindtijd moet na de begintijd liggen.' });
    }
  });

export type ShiftInput = z.infer<typeof shiftSchema> & { weekday: 1 | 2 | 3 | 4 | 5 | 6 };

export function parseShiftForm(form: FormData): Parsed<ShiftInput> {
  return parse(shiftSchema, {
    weekday: text(form, 'weekday'),
    groupId: text(form, 'groupId'),
    role: text(form, 'role'),
    startTime: text(form, 'startTime'),
    endTime: text(form, 'endTime'),
    validFrom: text(form, 'validFrom'),
  }) as Parsed<ShiftInput>;
}

// Roosterwijziging voor één dag (fase 2) -----------------------------------------

/** Ma t/m za, net als vaste diensten. */
function isWorkday(date: string): boolean {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return day >= 1 && day <= 6;
}

const workday = (label: string) =>
  isoDate(label).refine(isWorkday, { error: `Kies bij ${label} een dag van maandag t/m zaterdag.` });

const dayShiftSchema = z
  .object({
    employeeId: z.string().regex(UUID_PATTERN, { error: 'Kies een medewerker.' }),
    date: workday('datum'),
    groupId: z.string().min(1, { error: 'Kies een groep.' }),
    role: z.enum(ROLES, { error: 'Kies een rol.' }),
    startTime: optionalTime('begintijd'),
    endTime: optionalTime('eindtijd'),
  })
  .superRefine((value, context) => {
    if (value.startTime && value.endTime && value.endTime <= value.startTime) {
      context.addIssue({ code: 'custom', path: ['endTime'], message: 'De eindtijd moet na de begintijd liggen.' });
    }
  });

export type DayShiftInput = z.infer<typeof dayShiftSchema>;

/** "Andere dienst deze dag": groep, rol en tijden voor één datum. */
export function parseDayShiftForm(form: FormData, dateField = 'date'): Parsed<DayShiftInput> {
  return parse(dayShiftSchema, {
    employeeId: text(form, 'employeeId'),
    date: text(form, dateField),
    groupId: text(form, 'groupId'),
    role: text(form, 'role'),
    startTime: text(form, 'startTime'),
    endTime: text(form, 'endTime'),
  });
}

const dayRefSchema = z.object({
  employeeId: z.string().regex(UUID_PATTERN, { error: 'Kies een medewerker.' }),
  date: workday('datum'),
});

/** Medewerker en datum, voor "geen dienst" en "terug naar de vaste dienst". */
export function parseDayRef(form: FormData): Parsed<z.infer<typeof dayRefSchema>> {
  return parse(dayRefSchema, { employeeId: text(form, 'employeeId'), date: text(form, 'date') });
}

// Sluitingsdag -----------------------------------------------------------------

const closureSchema = z.object({
  date: isoDate('datum'),
  groupId: z.string().transform((value) => (value === '' || value === 'all' ? null : value)),
  label: z
    .string()
    .transform((value) => cleanName(value))
    .pipe(z.string().max(60, { error: 'Maximaal 60 tekens.' }))
    .transform((value) => (value === '' ? null : value)),
});

export type ClosureInput = z.infer<typeof closureSchema>;

export function parseClosureForm(form: FormData): Parsed<ClosureInput> {
  return parse(closureSchema, { date: text(form, 'date'), groupId: text(form, 'groupId'), label: text(form, 'label') });
}

// Instellingen -----------------------------------------------------------------

const requiredTime = (label: string) =>
  z.string().transform((value, context) => {
    const time = parseTime(value);
    if (!time) {
      context.addIssue({ code: 'custom', message: `Vul bij ${label} een tijd in als uu:mm.` });
      return z.NEVER;
    }
    return time;
  });

const settingsSchema = z
  .object({
    standardStart: requiredTime('begin standaarddienst'),
    standardEnd: requiredTime('einde standaarddienst'),
    saturdayStart: requiredTime('begin zaterdag'),
    saturdayEnd: requiredTime('einde zaterdag'),
    dayPartBoundary: requiredTime('dagdeelgrens'),
    lookaheadWeeks: z.coerce
      .number({ error: 'Vul een aantal weken in.' })
      .int({ error: 'Vul een heel aantal weken in.' })
      .min(1, { error: 'Minimaal 1 week.' })
      .max(52, { error: 'Maximaal 52 weken.' }),
  })
  .superRefine((value, context) => {
    if (value.standardEnd <= value.standardStart) {
      context.addIssue({ code: 'custom', path: ['standardEnd'], message: 'Het einde moet na het begin liggen.' });
    }
    if (value.saturdayEnd <= value.saturdayStart) {
      context.addIssue({ code: 'custom', path: ['saturdayEnd'], message: 'Het einde moet na het begin liggen.' });
    }
  });

export type SettingsInput = z.infer<typeof settingsSchema>;

export function parseSettingsForm(form: FormData): Parsed<SettingsInput> {
  return parse(settingsSchema, {
    standardStart: text(form, 'standardStart'),
    standardEnd: text(form, 'standardEnd'),
    saturdayStart: text(form, 'saturdayStart'),
    saturdayEnd: text(form, 'saturdayEnd'),
    dayPartBoundary: text(form, 'dayPartBoundary'),
    lookaheadWeeks: text(form, 'lookaheadWeeks'),
  });
}

/** Leest getallen uit velden met een vaste naamopbouw, zoals "norm:den_bosch:1:morning". */
export function parseNumberFields(
  form: FormData,
  prefix: string,
  min: number,
  max: number,
): { ok: true; values: Map<string, number> } | { ok: false; error: string } {
  const values = new Map<string, number>();
  for (const [key, raw] of form.entries()) {
    if (!key.startsWith(`${prefix}:`) || typeof raw !== 'string') continue;
    const value = Number(raw.trim());
    if (!Number.isInteger(value) || value < min || value > max) {
      return { ok: false, error: `Vul overal een heel getal in van ${min} tot en met ${max}.` };
    }
    values.set(key.slice(prefix.length + 1), value);
  }
  return { ok: true, values };
}
