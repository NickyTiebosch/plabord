'use server';

import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { dbErrorMessage } from '@/lib/admin/errors';
import { requireAdmin } from '@/lib/auth/session';
import type { Json } from '@/lib/db/database.types';
import { must } from '@/lib/db/queries';
import { loadCounterGroups, loadRegistrationSettings, loadWorkshops } from '@/lib/db/registration-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { MAX_FILE_BYTES } from '@/lib/import/columns';
import { planHistory, type HistoryGroupSummary } from '@/lib/import/history';
import type { ImportIssue } from '@/lib/import/workbook';
import { ImportFileError, readWorkbook } from '@/lib/import/xlsx';

export interface HistoryState {
  status: 'idle' | 'preview' | 'done';
  error?: string;
  fileName?: string;
  fingerprint?: string;
  preview?: {
    summary: HistoryGroupSummary[];
    walkIns: number;
    incidents: number;
    chargeable: number;
    errors: ImportIssue[];
    notices: ImportIssue[];
    skippedSheets: string[];
  };
  result?: { walkIns: number; incidents: number };
}

/**
 * De historie van binnenvallers en meldingen inlezen (fase 6, V63). Eerst een voorvertoning, dan
 * opslaan. Opnieuw inlezen maakt geen dubbele regels; een binnenvaller wordt bijgewerkt naar het
 * aantal uit het bestand.
 */
export async function historyAction(previous: HistoryState, formData: FormData): Promise<HistoryState> {
  const { supabase } = await requireAdmin();
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

  const [groups, workshops, settings, employees] = await Promise.all([
    loadCounterGroups(supabase),
    loadWorkshops(supabase),
    loadRegistrationSettings(supabase),
    supabase.from('employees').select('id, name'),
  ]);
  const plan = planHistory(sheets, {
    groups,
    workshops,
    employees: must(employees, 'de medewerkers'),
    chargeFrom: settings.chargeFrom,
    today: todayInAmsterdam(new Date()),
  });
  const markCharged = formData.get('markCharged') === 'on';
  const fingerprint = createHash('sha256').update(JSON.stringify([plan.walkIns, plan.incidents])).digest('hex');
  const base: HistoryState = {
    status: 'preview',
    fileName: file.name,
    fingerprint,
    preview: {
      summary: plan.summary,
      walkIns: plan.walkIns.length,
      incidents: plan.incidents.length,
      chargeable: plan.incidents.filter((incident) => incident.charge).length,
      errors: plan.errors,
      notices: plan.notices,
      skippedSheets: plan.skippedSheets,
    },
  };

  if (intent !== 'apply') return base;
  if (plan.errors.length > 0) return { ...base, error: 'Los eerst de fouten op. Er is niets opgeslagen.' };
  if (formData.get('fingerprint') !== fingerprint) {
    return { ...base, error: 'Er is intussen iets veranderd. Bekijk de voorvertoning opnieuw en klik dan op Inlezen.' };
  }

  const saved = await supabase.rpc('import_registrations', {
    plan: { walk_ins: plan.walkIns, incidents: plan.incidents, mark_charged: markCharged } as unknown as Json,
  });
  if (saved.error) return { ...base, error: dbErrorMessage(saved.error, 'Inlezen is mislukt. Er is niets opgeslagen.') };
  const counts = (saved.data ?? {}) as { walk_ins?: number; incidents?: number };
  revalidatePath('/', 'layout');
  return { status: 'done', fileName: file.name, result: { walkIns: counts.walk_ins ?? 0, incidents: counts.incidents ?? 0 } };
}
