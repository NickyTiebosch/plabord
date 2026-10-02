'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { ensureAccount } from '@/lib/admin/accounts';
import { dbErrorMessage } from '@/lib/admin/errors';
import { reviewSummary } from '@/lib/admin/planning';
import { requireAdmin, type Viewer } from '@/lib/auth/session';
import type { Json } from '@/lib/db/database.types';
import { mapAbsence, mapCurrentEmployees, mapRecurringShift } from '@/lib/db/mappers';
import { loadGroups, loadSettings, must } from '@/lib/db/queries';
import { reviewAfterChange } from '@/lib/db/review';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { changedDates } from '@/lib/engine/impact';
import { MAX_FILE_BYTES } from '@/lib/import/columns';
import { planImport, type CurrentData } from '@/lib/import/plan';
import { importPreview, type ImportPreview } from '@/lib/import/preview';
import { parseWorkbook, type ParsedWorkbook } from '@/lib/import/workbook';
import { ImportFileError, readWorkbook } from '@/lib/import/xlsx';

export interface ImportState {
  status: 'idle' | 'preview' | 'done';
  error?: string;
  fileName?: string;
  fingerprint?: string;
  preview?: ImportPreview;
  result?: {
    employees: number;
    shifts: number;
    absences: number;
    accountsCreated: number;
    accountErrors: string[];
    /** Uitkomst van de controle op invallen na de geïmporteerde afwezigheid (fase 2). */
    reviewNote: string;
  };
}

async function loadCurrent(supabase: Viewer['supabase'], parsed: ParsedWorkbook): Promise<CurrentData> {
  // Alleen de afwezigheid in de periode van het bestand: meer is niet nodig om dubbelingen te herkennen.
  const starts = parsed.absences.map((absence) => absence.startDate).sort();
  const ends = parsed.absences.map((absence) => absence.endDate).sort();
  const absencesQuery =
    starts.length > 0
      ? supabase
          .from('absences')
          .select('*')
          .gte('start_date', starts[0] ?? '')
          .lte('end_date', ends.at(-1) ?? '')
      : null;

  const [settings, groups, employees, accounts, eligibility, shifts, absences] = await Promise.all([
    loadSettings(supabase),
    loadGroups(supabase),
    supabase.from('employees').select('*'),
    supabase.from('employee_accounts').select('employee_id, email, user_id'),
    supabase.from('counter_eligibility').select('employee_id, group_id'),
    supabase.from('recurring_shifts').select('*'),
    absencesQuery,
  ]);
  return {
    settings,
    groups,
    employees: mapCurrentEmployees(must(employees, 'de medewerkers'), must(accounts, 'de accounts'), must(eligibility, 'de inzetbaarheid')),
    recurringShifts: must(shifts, 'de vaste diensten').map(mapRecurringShift),
    absences: absences ? must(absences, 'de afwezigheid').map(mapAbsence) : [],
  };
}

export async function importAction(previous: ImportState, formData: FormData): Promise<ImportState> {
  const viewer = await requireAdmin();
  const { supabase } = viewer;
  const intent = formData.get('intent');
  if (intent === 'reset') return { status: 'idle' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ...previous, error: 'Kies eerst een .xlsx-bestand.' };
  if (file.size > MAX_FILE_BYTES) return { status: 'idle', error: 'Het bestand is groter dan 2 MB.' };

  let sheets;
  try {
    sheets = await readWorkbook(Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    return { status: 'idle', error: error instanceof ImportFileError ? error.message : 'Het bestand kan niet worden gelezen.' };
  }

  const groups = await loadGroups(supabase);
  const parsed = parseWorkbook(sheets, groups);
  const plan = planImport(parsed, await loadCurrent(supabase, parsed), { importingEmployeeId: viewer.employeeId });
  const preview = importPreview(plan, groups);
  const fingerprint = createHash('sha256')
    .update(JSON.stringify([plan.payload, plan.accountsToCreate]))
    .digest('hex');
  const base: ImportState = { status: 'preview', fileName: file.name, fingerprint, preview };

  if (intent !== 'apply') return base;
  if (!plan.payload || !preview.canApply) return { ...base, error: 'Er valt niets op te slaan. Los eerst de fouten op.' };
  if (formData.get('fingerprint') !== fingerprint) {
    return { ...base, error: 'Er is intussen iets veranderd. Bekijk de voorvertoning opnieuw en klik dan op Importeren.' };
  }

  const applied = await supabase.rpc('apply_import', { plan: plan.payload as unknown as Json });
  if (applied.error) {
    return { ...base, error: dbErrorMessage(applied.error, 'Importeren is mislukt. Er is niets opgeslagen.') };
  }

  // Accounts voor iedereen met een e-mailadres die er nog geen heeft.
  const importedEmails = new Set(plan.employees.map((employee) => employee.email).filter((email): email is string => Boolean(email)));
  const pending = await supabase.from('employee_accounts').select('employee_id, email').is('user_id', null);
  let accountsCreated = 0;
  const accountErrors: string[] = [];
  for (const account of pending.data ?? []) {
    if (!importedEmails.has(account.email)) continue;
    const result = await ensureAccount(account.employee_id, account.email);
    if (result.ok) accountsCreated++;
    else accountErrors.push(`${account.email}: ${result.error}`);
  }

  // Geïmporteerde afwezigheid kan invallen achterhalen (besluit V10).
  const today = todayInAmsterdam(new Date());
  const ranges = (plan.payload.absences ?? []).map((absence) => ({ startDate: absence.start_date, endDate: absence.end_date }));
  const review = await reviewAfterChange(supabase, changedDates(ranges, today), today);

  revalidatePath('/', 'layout');
  const summary = preview.summary;
  return {
    status: 'done',
    fileName: file.name,
    result: {
      employees: summary.employees.create + summary.employees.update,
      shifts: summary.shifts.create + summary.shifts.update,
      absences: summary.absences.create + summary.absences.update,
      accountsCreated,
      accountErrors,
      reviewNote: review.error ?? reviewSummary(review.changes),
    },
  };
}
