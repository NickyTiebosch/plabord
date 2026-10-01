import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubmitButton } from '@/components/client/form-controls';
import { Card, PageHeader } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/session';
import { mapAbsence, mapEmployee } from '@/lib/db/mappers';
import { loadGroups, must } from '@/lib/db/queries';
import { employeeOptions } from '../../admin-shared';
import { AbsenceForm } from '../absence-form';
import { deleteAbsence } from '../actions';

export const metadata: Metadata = { title: 'Afwezigheid wijzigen' };

export default async function EditAbsencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [groups, employees, absence] = await Promise.all([
    loadGroups(supabase),
    supabase.from('employees').select('*').then((result) => must(result, 'de medewerkers').map((row) => mapEmployee(row))),
    supabase.from('absences').select('*').eq('id', id).maybeSingle(),
  ]);
  if (!absence.data) notFound();
  const current = mapAbsence(absence.data);
  const options = employeeOptions(employees, groups);
  // Ook een inactieve medewerker moet in de lijst staan als de afwezigheid bij die persoon hoort.
  const owner = employees.find((employee) => employee.id === current.employeeId);
  if (owner && !options.some((option) => option.id === owner.id)) {
    options.push({ id: owner.id, name: `${owner.name} (inactief)`, groupName: 'Inactief' });
  }

  return (
    <>
      <PageHeader title="Afwezigheid wijzigen" actions={<Link href="/beheer/afwezigheid" className="text-sm underline">Terug</Link>} />
      <Card className="max-w-xl p-4">
        <AbsenceForm
          employees={options}
          defaults={{
            id: current.id,
            employeeId: current.employeeId,
            startDate: current.startDate,
            endDate: current.endDate,
            dayPart: current.dayPart,
            status: current.status,
          }}
        />
        <form action={deleteAbsence} className="mt-6 border-t border-slate-100 pt-4">
          <input type="hidden" name="id" value={current.id} />
          <input type="hidden" name="terug" value="lijst" />
          <SubmitButton variant="danger" confirm="Deze afwezigheid verwijderen?">
            Verwijderen
          </SubmitButton>
        </form>
      </Card>
    </>
  );
}
