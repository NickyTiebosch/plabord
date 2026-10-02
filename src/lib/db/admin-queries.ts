import { attentionItems, buildGapViews, planningWindow, warningTexts } from '../admin/planning';
import { eachDay } from '../engine/dates';
import { reviewSubstitutions } from '../engine/review';
import type { Employee, IsoDate } from '../engine/types';
import { counterGroupsByEmployee, mapEmployee, mapGapDismissal, mapSubstitution } from './mappers';
import { loadPlanningSnapshot, loadSettings, must, type DbClient } from './queries';

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

/**
 * Alles voor "Nog te regelen" en "Let op" (fase 2): de gaten in de komende weken met voorstellen,
 * genegeerde gaten, vervallen invallen die nog niet zijn afgehandeld, en invallen die niet meer kloppen.
 */
export async function loadPlanningOverview(client: DbClient, today: IsoDate) {
  const settings = await loadSettings(client);
  const window = planningWindow(today, settings.lookaheadWeeks);
  const [snapshot, dismissals, unhandled] = await Promise.all([
    loadPlanningSnapshot(client, window),
    client
      .from('gap_dismissals')
      .select('group_id, date, day_part, shortage')
      .gte('date', window.from)
      .lte('date', window.to)
      .then((result) => must(result, 'de genegeerde gaten').map(mapGapDismissal)),
    client
      .from('substitutions')
      .select('*')
      .in('status', ['not_needed', 'reschedule'])
      .is('handled_at', null)
      .order('date')
      .then((result) => must(result, 'de vervallen invallen').map(mapSubstitution)),
  ]);
  const names = new Map(snapshot.employees.map((employee) => [employee.id, employee.name]));
  const groupNames = new Map(snapshot.groups.map((group) => [group.id, group.name]));
  const { gaps, ignored } = buildGapViews(snapshot, window, dismissals);
  return {
    window,
    snapshot,
    dismissals,
    gaps,
    ignored,
    attention: attentionItems(unhandled, names, groupNames),
    warnings: warningTexts(reviewSubstitutions(snapshot, eachDay(window.from, window.to), today), names, groupNames),
  };
}
