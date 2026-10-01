/**
 * De voorvertoning van een import: tellingen, fouten per regel en een leesbare lijst van wijzigingen.
 */
import { formatDate, formatDateRange, weekdayShort } from '../engine/format';
import { ABSENCE_PART_LABELS, ABSENCE_STATUS_LABELS, ROLE_LABELS } from '../engine/labels';
import type { Group } from '../engine/types';
import { SHEET_NAMES } from './columns';
import type { ActionCounts, ImportPlan, PlanAction } from './plan';
import type { ImportIssue } from './workbook';

export interface PreviewChange {
  sheet: string;
  row: number | null;
  action: Exclude<PlanAction, 'unchanged'>;
  text: string;
}

export interface ImportPreview {
  summary: Record<'employees' | 'shifts' | 'absences', ActionCounts>;
  errors: ImportIssue[];
  notices: ImportIssue[];
  changes: PreviewChange[];
  accountsToCreate: string[];
  hasChanges: boolean;
  canApply: boolean;
}

const MAX_CHANGES = 300;

function sortIssues(issues: readonly ImportIssue[]): ImportIssue[] {
  const order = [SHEET_NAMES.employees, SHEET_NAMES.shifts, SHEET_NAMES.absences] as string[];
  return [...issues].sort(
    (a, b) =>
      (order.indexOf(a.sheet ?? '') + 10) % 10 - ((order.indexOf(b.sheet ?? '') + 10) % 10) ||
      (a.row ?? 0) - (b.row ?? 0),
  );
}

export function importPreview(plan: ImportPlan, groups: readonly Group[]): ImportPreview {
  const groupName = (id: string) => groups.find((group) => group.id === id)?.name ?? id;
  const changes: PreviewChange[] = [];

  for (const employee of plan.employees) {
    if (employee.action === 'unchanged') continue;
    changes.push({
      sheet: SHEET_NAMES.employees,
      row: employee.row,
      action: employee.action,
      text:
        employee.action === 'create'
          ? `${employee.name} (${groupName(employee.groupId)}${employee.email ? ', met e-mail' : ', zonder e-mail'})`
          : `${employee.name}: ${employee.changes.join('; ')}`,
    });
  }
  for (const shift of plan.shifts) {
    if (shift.action === 'unchanged') continue;
    const times = shift.startTime || shift.endTime ? `${shift.startTime ?? 'standaard'}–${shift.endTime ?? 'standaard'}` : 'standaardtijden';
    const base = `${shift.employeeName}, ${weekdayShort(shift.weekday)} vanaf ${formatDate(shift.validFrom)}${
      shift.validTo ? ` t/m ${formatDate(shift.validTo)}` : ''
    }: ${groupName(shift.groupId)}, ${ROLE_LABELS[shift.role]}, ${times}`;
    changes.push({
      sheet: SHEET_NAMES.shifts,
      row: shift.row,
      action: shift.action,
      text: shift.changes.length > 0 ? `${base} (${shift.changes.join('; ')})` : base,
    });
  }
  for (const absence of plan.absences) {
    if (absence.action === 'unchanged') continue;
    const base = `${absence.employeeName}, ${formatDateRange(absence.startDate, absence.endDate)}, ${
      ABSENCE_PART_LABELS[absence.dayPart]
    }, ${ABSENCE_STATUS_LABELS[absence.status]}`;
    changes.push({
      sheet: SHEET_NAMES.absences,
      row: absence.row,
      action: absence.action,
      text: absence.changes.length > 0 ? `${absence.employeeName}: ${absence.changes.join('; ')}` : base,
    });
  }

  return {
    summary: plan.summary,
    errors: sortIssues(plan.errors),
    notices: sortIssues(plan.notices),
    changes: changes.slice(0, MAX_CHANGES),
    accountsToCreate: plan.accountsToCreate,
    hasChanges: plan.hasChanges,
    canApply: plan.errors.length === 0 && plan.payload !== null && plan.hasChanges,
  };
}
