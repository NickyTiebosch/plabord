import { attentionItems, buildGapViews, planningWindow, warningTexts, type AttentionMailState } from '../admin/planning';
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
  const mailStates = await loadCancellationMailStates(client, unhandled.map((sub) => sub.employeeId));
  return {
    window,
    snapshot,
    dismissals,
    gaps,
    ignored,
    attention: attentionItems(unhandled, names, groupNames, (employeeId, date) => mailStates.get(`${employeeId}|${date}`) ?? null),
    warnings: warningTexts(reviewSubstitutions(snapshot, eachDay(window.from, window.to), today), names, groupNames),
  };
}

/**
 * Per invaller en dag: hoe het staat met de laatste mail over een vervallen inval (fase 3, V19).
 * Een verstuurde mail telt niet: die inval is dan al afgehandeld.
 */
async function loadCancellationMailStates(client: DbClient, employeeIds: readonly string[]): Promise<Map<string, AttentionMailState>> {
  const states = new Map<string, AttentionMailState>();
  const ids = [...new Set(employeeIds)];
  if (ids.length === 0) return states;
  const rows = must(
    await client
      .from('mail_queue')
      .select('employee_id, dates, status, last_error, created_at')
      .eq('kind', 'substitution_cancelled')
      .in('employee_id', ids)
      .order('created_at'),
    'de mails',
  );
  for (const row of rows) {
    const state: AttentionMailState | null =
      row.status === 'pending'
        ? 'pending'
        : row.status === 'failed'
          ? 'failed'
          : row.status === 'skipped'
            ? row.last_error === 'mails uit'
              ? 'off'
              : 'no-address'
            : null;
    for (const date of row.dates) {
      // De nieuwste mail per dag telt; een verstuurde wist de oude stand.
      if (state) states.set(`${row.employee_id}|${date}`, state);
      else states.delete(`${row.employee_id}|${date}`);
    }
  }
  return states;
}
