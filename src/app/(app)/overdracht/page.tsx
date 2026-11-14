import type { Metadata } from 'next';
import { SubmitButton } from '@/components/client/form-controls';
import { StatefulForm } from '@/components/client/stateful-form';
import { GroupSwitch } from '@/components/registrations';
import { Card, EmptyState, PageHeader, SectionTitle, cx, inputClass } from '@/components/ui';
import { requireViewerWith } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { loadNotes } from '@/lib/db/handover-queries';
import { loadCounterGroups } from '@/lib/db/registration-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { KEEP_DAYS, MAX_NOTE, daysLeft, notesFor, wasEdited } from '@/lib/handover/notes';
import { formatLoanMoment } from '@/lib/loans/status';
import { canEditOwn, pickGroup } from '@/lib/registrations/status';
import { addNote, saveNote } from './actions';

export const metadata: Metadata = { title: 'Overdracht' };

/** De overdracht per vestiging (fase 8): korte notities voor de collega van morgen, 7 dagen zichtbaar. */
export default async function HandoverPage({ searchParams }: { searchParams: Promise<{ vestiging?: string }> }) {
  const { vestiging } = await searchParams;
  const today = todayInAmsterdam(new Date());
  const [viewer, [groups, notes, names]] = await requireViewerWith((supabase) => Promise.all([loadCounterGroups(supabase), loadNotes(supabase), loadEmployeeNames(supabase)]));
  const group = pickGroup(groups, vestiging, viewer.groupId);
  if (!group) return <EmptyState title="Er is geen vestiging met een balie." />;
  const own = notesFor(notes, group.id);
  return (
    <>
      <PageHeader
        title="Overdracht"
        subtitle={`${group.name} · notities voor de collega van morgen. Na ${KEEP_DAYS} dagen verdwijnen ze vanzelf.`}
        actions={
          viewer.isLead ? (
            // Een gewone link: elke klik is één export in het logboek.
            <a href="/overdracht/export" download className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50">
              Download (Excel)
            </a>
          ) : null
        }
      />
      <GroupSwitch groups={groups} current={group.id} href={(groupId) => `/overdracht?vestiging=${groupId}`} />
      <Card className="mb-4 p-4">
        <SectionTitle className="mb-2">Nieuwe notitie</SectionTitle>
        <StatefulForm action={addNote} resetOnSuccess className="space-y-3">
          <input type="hidden" name="groupId" value={group.id} />
          <label className="block text-sm text-slate-700">
            <span className="sr-only">Notitie voor {group.name}</span>
            <textarea name="body" rows={3} maxLength={MAX_NOTE} required placeholder="Bijvoorbeeld: sleutel van de Transporter ligt in de kluis." className={inputClass} />
          </label>
          <p className="text-xs text-slate-500">Hooguit {MAX_NOTE} tekens. Klantgegevens zijn niet nodig.</p>
          <SubmitButton>Plaatsen</SubmitButton>
        </StatefulForm>
      </Card>
      {own.length === 0 ? (
        <EmptyState title="Er zijn geen notities van de afgelopen week." />
      ) : (
        <ul className="space-y-3">
          {own.map((note) => {
            const editable = canEditOwn({ ownerId: note.createdBy, createdAt: note.createdAt }, viewer, today);
            return (
              <li key={note.id}>
                <Card className="p-4">
                  <p className="text-xs text-slate-500">
                    {names.get(note.createdBy ?? '') ?? 'oud-collega'} · {formatLoanMoment(note.createdAt, today)}
                    {wasEdited(note) ? ' · gewijzigd' : ''} · nog {daysLeft(note, today) === 0 ? 'vandaag' : `${daysLeft(note, today)} dag(en)`} zichtbaar
                  </p>
                  {editable ? (
                    <StatefulForm action={saveNote} className="mt-2 space-y-2">
                      <input type="hidden" name="id" value={note.id} />
                      <textarea name="body" rows={3} maxLength={MAX_NOTE} required defaultValue={note.body} aria-label="Notitie" className={cx(inputClass, 'text-sm')} />
                      <div className="flex flex-wrap gap-2">
                        <SubmitButton size="sm" variant="secondary">
                          Opslaan
                        </SubmitButton>
                        <SubmitButton size="sm" variant="ghost" name="intent" value="delete" confirm="Deze notitie verwijderen?">
                          Verwijderen
                        </SubmitButton>
                      </div>
                    </StatefulForm>
                  ) : (
                    <p className="mt-1 text-sm whitespace-pre-line text-slate-900">{note.body}</p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
