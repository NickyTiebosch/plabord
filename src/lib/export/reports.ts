/**
 * Een rapport als Excel (fase 7, V70): elke tabel een tabblad, met dezelfde cijfers als op het
 * scherm. Puur: van rapport naar tabbladen.
 */
import type { Report, ReportTable } from '../reports/build';
import type { ReportQuery } from '../reports/periods';
import type { ExportSheet } from './planning';

/** Excel staat hooguit 31 tekens toe in de naam van een tabblad, en geen : \ / ? * [ ]. */
function sheetName(title: string, used: Set<string>): string {
  const base = title.replace(/[:\\/?*[\]]/g, '').slice(0, 28).trim() || 'Tabel';
  let name = base;
  for (let index = 2; used.has(name.toLowerCase()); index++) name = `${base.slice(0, 26)} ${index}`;
  used.add(name.toLowerCase());
  return name;
}

const unitSuffix = (table: ReportTable) => (table.format === 'percent' ? ' (%)' : '');

export function reportExport(report: Report, info: { title: string; query: ReportQuery; groupName: string | null }): ExportSheet[] {
  const used = new Set<string>();
  const periods = info.query.periods.map((period) => period.title).join(', ');
  const about: ExportSheet = {
    sheet: sheetName('Over dit rapport', used),
    header: ['Gegeven', 'Waarde'],
    rows: [
      ['Rapport', info.title],
      ['Perioden', periods],
      ['Vestiging', info.groupName ?? 'Alle vestigingen'],
      ['Let op', 'Aantallen per vestiging en werkplaats. Planbord houdt geen cijfers per medewerker bij.'],
    ],
  };
  return [
    about,
    ...report.tables.map((table) => ({
      sheet: sheetName(table.title, used),
      header: [`${table.title}${unitSuffix(table)}`, ...table.columns],
      rows: table.rows.map((row) => [row.label, ...row.values.map((value) => (value === null ? '' : value))]),
    })),
  ];
}
