import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/session';
import { loadEmployeesWithAccounts, type EmployeeWithAccount } from '@/lib/db/admin-queries';
import { loadGroups } from '@/lib/db/queries';
import { ROLE_LABELS } from '@/lib/engine/labels';
import { compareByNameThenId, compareGroups } from '@/lib/engine/sort';

export const metadata: Metadata = { title: 'Medewerkers' };

function EmployeeRow({ employee }: { employee: EmployeeWithAccount }) {
  return (
    <li>
      <Link
        href={`/beheer/medewerkers/${employee.id}`}
        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-slate-50"
      >
        <span className="min-w-0">
          <span className="font-medium text-slate-900">{employee.name}</span>
          {employee.defaultRole !== 'none' ? (
            <span className="text-sm text-slate-500"> · {ROLE_LABELS[employee.defaultRole]}</span>
          ) : null}
        </span>
        <span className="flex flex-wrap gap-1">
          {employee.isAdmin ? <Badge tone="brand">beheerder</Badge> : null}
          {!employee.email ? <Badge>geen e-mail</Badge> : !employee.hasAccount ? <Badge tone="warning">nog geen account</Badge> : null}
          {!employee.isActive ? <Badge tone="closed">inactief</Badge> : null}
        </span>
      </Link>
    </li>
  );
}

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ inactief?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const [groups, employees] = await Promise.all([loadGroups(supabase), loadEmployeesWithAccounts(supabase)]);
  const showInactive = params.inactief === '1';
  const visible = employees.filter((employee) => showInactive || employee.isActive);
  const inactiveCount = employees.filter((employee) => !employee.isActive).length;

  return (
    <>
      <PageHeader
        title="Medewerkers"
        subtitle={`${employees.length - inactiveCount} actief${inactiveCount > 0 ? `, ${inactiveCount} inactief` : ''}`}
        actions={
          <LinkButton href="/beheer/medewerkers/nieuw" variant="primary">
            Medewerker toevoegen
          </LinkButton>
        }
      />
      {employees.length === 0 ? (
        <EmptyState title="Nog geen medewerkers">
          Voeg ze één voor één toe of gebruik de <Link href="/beheer/import" className="underline">Excel-import</Link>.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {[...groups].sort(compareGroups).map((group) => {
            const members = visible.filter((employee) => employee.groupId === group.id).sort(compareByNameThenId);
            if (members.length === 0) return null;
            return (
              <section key={group.id}>
                <SectionTitle className="mb-2">{group.name}</SectionTitle>
                <Card>
                  <ul className="divide-y divide-slate-100">
                    {members.map((employee) => (
                      <EmployeeRow key={employee.id} employee={employee} />
                    ))}
                  </ul>
                </Card>
              </section>
            );
          })}
        </div>
      )}
      {inactiveCount > 0 ? (
        <p className="mt-4 text-sm">
          <Link href={showInactive ? '/beheer/medewerkers' : '/beheer/medewerkers?inactief=1'} className="underline">
            {showInactive ? 'Inactieve medewerkers verbergen' : 'Ook inactieve medewerkers tonen'}
          </Link>
        </p>
      ) : null}
    </>
  );
}
