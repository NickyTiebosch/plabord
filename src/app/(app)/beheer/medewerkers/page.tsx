import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/client/form-controls';
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from '@/components/ui';
import { requireAdminWith } from '@/lib/auth/session';
import { loadEmployeesWithAccounts, loadInvites, type EmployeeWithAccount } from '@/lib/db/admin-queries';
import { loadGroups } from '@/lib/db/queries';
import { ROLE_LABELS } from '@/lib/engine/labels';
import { compareByNameThenId, compareGroups } from '@/lib/engine/sort';
import { inviteTargets, isInvited, latestInvites } from '@/lib/mail/invites';
import { Flash } from '../admin-shared';
import { inviteEveryone } from './actions';

export const metadata: Metadata = { title: 'Medewerkers' };
// Iedereen uitnodigen verstuurt de mails één voor één; geef dat de tijd (V33).
export const maxDuration = 60;

function InviteEveryone({ count }: { count: number }) {
  return (
    <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
      <p className="text-sm text-slate-700">
        {count === 0
          ? 'Iedereen die kan inloggen, heeft een uitnodiging gehad. Een nieuwe collega nodig je uit op diens pagina.'
          : `${count} ${count === 1 ? 'collega kan' : "collega's kunnen"} inloggen maar ${count === 1 ? 'heeft' : 'hebben'} nog geen uitnodiging gehad.`}
      </p>
      {count > 0 ? (
        <form action={inviteEveryone}>
          <SubmitButton
            variant="primary"
            confirm={`${count} ${count === 1 ? 'collega krijgt' : "collega's krijgen"} een uitnodiging per mail, ook als Meldingen versturen uit staat. Doorgaan?`}
          >
            Iedereen uitnodigen ({count})
          </SubmitButton>
        </form>
      ) : null}
    </Card>
  );
}

function EmployeeRow({ employee, invited }: { employee: EmployeeWithAccount; invited: boolean }) {
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
          {invited ? <Badge tone="success">uitgenodigd</Badge> : null}
          {!employee.isActive ? <Badge tone="closed">inactief</Badge> : null}
        </span>
      </Link>
    </li>
  );
}

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ inactief?: string; melding?: string }> }) {
  const params = await searchParams;
  const [viewer, [groups, employees, invites]] = await requireAdminWith((supabase) =>
    Promise.all([loadGroups(supabase), loadEmployeesWithAccounts(supabase), loadInvites(supabase)]),
  );
  const toInvite = inviteTargets(employees, invites, viewer.employeeId).length;
  const latest = latestInvites(invites);
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
      <Flash code={params.melding} />
      {employees.length > 0 ? <InviteEveryone count={toInvite} /> : null}
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
                      <EmployeeRow
                        key={employee.id}
                        employee={employee}
                        invited={isInvited(latest.get(employee.id)?.status ?? 'skipped')}
                      />
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
