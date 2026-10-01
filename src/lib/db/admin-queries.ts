import type { Employee } from '../engine/types';
import { counterGroupsByEmployee, mapEmployee } from './mappers';
import { must, type DbClient } from './queries';

export interface EmployeeWithAccount extends Employee {
  email: string | null;
  hasAccount: boolean;
}

/** Alle medewerkers met e-mail en accountstatus. Alleen zinvol voor beheerders (RLS). */
export async function loadEmployeesWithAccounts(client: DbClient): Promise<EmployeeWithAccount[]> {
  const [employees, accounts, eligibility] = await Promise.all([
    client.from('employees').select('*').order('name'),
    client.from('employee_accounts').select('employee_id, email, user_id'),
    client.from('counter_eligibility').select('employee_id, group_id'),
  ]);
  const accountByEmployee = new Map(must(accounts, 'de accounts').map((row) => [row.employee_id, row]));
  const counters = counterGroupsByEmployee(must(eligibility, 'de inzetbaarheid'));
  return must(employees, 'de medewerkers').map((row) => {
    const account = accountByEmployee.get(row.id);
    return {
      ...mapEmployee(row, counters.get(row.id) ?? []),
      email: account?.email ?? null,
      hasAccount: Boolean(account?.user_id),
    };
  });
}

/** Namen per id, ook van inactieve medewerkers (voor lijsten en het logboek). */
export async function loadEmployeeNames(client: DbClient): Promise<Map<string, string>> {
  const rows = must(await client.from('employees').select('id, name'), 'de medewerkers');
  return new Map(rows.map((row) => [row.id, row.name]));
}
