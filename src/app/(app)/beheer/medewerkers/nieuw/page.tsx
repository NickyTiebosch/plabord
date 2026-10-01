import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, PageHeader } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/session';
import { loadGroups } from '@/lib/db/queries';
import { EmployeeForm } from '../employee-form';

export const metadata: Metadata = { title: 'Medewerker toevoegen' };

export default async function NewEmployeePage() {
  const { supabase } = await requireAdmin();
  const groups = await loadGroups(supabase);
  return (
    <>
      <PageHeader
        title="Medewerker toevoegen"
        subtitle="Met een werkmail krijgt de medewerker meteen een account en kan inloggen met een code."
        actions={
          <Link href="/beheer/medewerkers" className="text-sm underline">
            Terug
          </Link>
        }
      />
      <Card className="max-w-xl p-4">
        <EmployeeForm groups={groups.map((group) => ({ id: group.id, name: group.name, hasCounter: group.hasCounter }))} />
      </Card>
    </>
  );
}
