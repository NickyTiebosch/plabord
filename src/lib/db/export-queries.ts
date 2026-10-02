/**
 * Gegevens laden voor de export (fase 3, V20). Met de sessie van de beheerder: RLS geldt.
 */
import { describeAudit, type AuditRow } from '../admin/audit';
import type { EmployeeData } from '../export/employee';
import type { PlanningData } from '../export/planning';
import { MAIL_KINDS, MAIL_STATUSES } from '../mail/types';
import { loadEmployeesWithAccounts } from './admin-queries';
import { counterGroupsByEmployee, mapAbsence, mapEmployee, mapRecurringShift, mapShiftOverride, mapSubstitution } from './mappers';
import { loadGroups, must, type DbClient } from './queries';

export async function loadPlanningExport(client: DbClient): Promise<PlanningData> {
  const [employees, groups, shifts, absences, substitutions, overrides] = await Promise.all([
    loadEmployeesWithAccounts(client),
    loadGroups(client),
    client.from('recurring_shifts').select('*'),
    client.from('absences').select('*'),
    client.from('substitutions').select('*'),
    client.from('shift_overrides').select('*'),
  ]);
  return {
    employees,
    groups,
    recurringShifts: must(shifts, 'de vaste diensten').map(mapRecurringShift),
    absences: must(absences, 'de afwezigheid').map(mapAbsence),
    substitutions: must(substitutions, 'de invallen').map(mapSubstitution),
    shiftOverrides: must(overrides, 'de roosterwijzigingen').map(mapShiftOverride),
  };
}

/** Alles over één medewerker, of `null` als die niet (meer) bestaat. */
export async function loadEmployeeExport(client: DbClient, employeeId: string): Promise<EmployeeData | null> {
  const employee = await client.from('employees').select('*').eq('id', employeeId).maybeSingle();
  if (employee.error) throw new Error(`Medewerker laden mislukt: ${employee.error.message}`);
  if (!employee.data) return null;
  const [groups, account, eligibility, shifts, absences, substitutions, overrides, feeds, mails, log] = await Promise.all([
    loadGroups(client),
    client.from('employee_accounts').select('email, user_id').eq('employee_id', employeeId).maybeSingle(),
    client.from('counter_eligibility').select('employee_id, group_id').eq('employee_id', employeeId),
    client.from('recurring_shifts').select('*').eq('employee_id', employeeId),
    client.from('absences').select('*').eq('employee_id', employeeId),
    client.from('substitutions').select('*').eq('employee_id', employeeId),
    client.from('shift_overrides').select('*').eq('employee_id', employeeId),
    client.from('calendar_feeds').select('kind, group_id, created_at, revoked_at').eq('employee_id', employeeId),
    client.from('mail_queue').select('kind, dates, status, last_error, attempts, created_at').eq('employee_id', employeeId),
    client.from('audit_log').select('*').eq('employee_id', employeeId).order('occurred_at').order('id'),
  ]);
  const counters = counterGroupsByEmployee(must(eligibility, 'de inzetbaarheid'));
  const name = employee.data.name;
  const lookups = {
    employeeName: (id: string | null | undefined) => (id === employeeId ? name : 'een collega'),
    groupName: (id: string | null | undefined) => groups.find((group) => group.id === id)?.name ?? String(id ?? ''),
  };
  return {
    employee: { ...mapEmployee(employee.data, counters.get(employeeId) ?? []), email: account.data?.email ?? null },
    hasAccount: Boolean(account.data?.user_id),
    groups,
    recurringShifts: must(shifts, 'de vaste diensten').map(mapRecurringShift),
    absences: must(absences, 'de afwezigheid').map(mapAbsence),
    substitutions: must(substitutions, 'de invallen').map(mapSubstitution),
    shiftOverrides: must(overrides, 'de roosterwijzigingen').map(mapShiftOverride),
    feeds: must(feeds, 'de agendalinks').map((feed) => ({
      kind: feed.kind,
      groupId: feed.group_id,
      createdAt: feed.created_at,
      revokedAt: feed.revoked_at,
    })),
    mails: must(mails, 'de mails').flatMap((mail) => {
      const kind = MAIL_KINDS.find((item) => item === mail.kind);
      const status = MAIL_STATUSES.find((item) => item === mail.status);
      return kind && status
        ? [{ kind, dates: mail.dates, status, lastError: mail.last_error, attempts: mail.attempts, createdAt: mail.created_at }]
        : [];
    }),
    // Wie iets deed, staat er niet in: alleen wat er wanneer met deze gegevens gebeurde.
    log: must(log, 'het logboek').map((row) => {
      const view = describeAudit(row as AuditRow, lookups);
      return { when: view.when, what: view.what, detail: view.detail };
    }),
  };
}
