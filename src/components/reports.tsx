import Link from 'next/link';
import { Card, SectionTitle, buttonClass, cx, inputClass } from '@/components/ui';
import type { Report, ReportChart, ReportTable, ReportValue } from '@/lib/reports/build';
import { COUNT_OPTIONS, MAX_COUNT, UNIT_LABELS, monthChoices, reportHref, type PeriodUnit, type ReportQuery } from '@/lib/reports/periods';

const UNITS: PeriodUnit[] = ['week', 'month', 'year'];

/**
 * De periodekeuze (V67): per week, maand of jaar; een aantal perioden of losse maanden; een
 * vestiging. Een gewoon formulier zonder JavaScript: de keuze komt in het adres.
 */
export function PeriodPicker({
  path,
  query,
  groups,
  today,
}: {
  path: string;
  query: ReportQuery;
  groups: readonly { id: string; name: string }[];
  today: string;
}) {
  const choices = monthChoices(today);
  return (
    <Card className="mb-4 space-y-3 p-4">
      <nav aria-label="Periode" className="flex flex-wrap gap-2">
        {UNITS.map((unit) => (
          <Link
            key={unit}
            href={reportHref(path, query, { unit })}
            aria-current={unit === query.unit ? 'page' : undefined}
            className={cx(
              'inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-medium',
              unit === query.unit ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            {UNIT_LABELS[unit]}
          </Link>
        ))}
      </nav>
      <form method="get" action={path} className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
        <input type="hidden" name="per" value={query.unit === 'week' ? 'week' : query.unit === 'month' ? 'maand' : 'jaar'} />
        <label className="block text-sm font-medium text-slate-800">
          Aantal
          <input
            name="aantal"
            type="number"
            min={1}
            max={MAX_COUNT[query.unit]}
            defaultValue={query.count}
            list="report-counts"
            className={cx(inputClass, 'mt-1')}
          />
          <datalist id="report-counts">
            {COUNT_OPTIONS[query.unit].map((count) => (
              <option key={count} value={count} />
            ))}
          </datalist>
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Vestiging
          <select name="vestiging" defaultValue={query.groupId ?? ''} className={cx(inputClass, 'mt-1')}>
            <option value="">Alle vestigingen</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClass('primary')}>
          Toon
        </button>
        {query.unit === 'month' ? (
          <details className="sm:col-span-3" open={query.months.length > 0}>
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-brand-800">
              Of kies losse maanden{query.months.length > 0 ? ` (${query.months.length} gekozen)` : ''}
            </summary>
            <fieldset className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              <legend className="sr-only">Losse maanden</legend>
              {choices.map((choice) => (
                <label key={choice.value} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-2 text-sm">
                  <input type="checkbox" name="maanden" value={choice.value} defaultChecked={query.months.includes(choice.value)} className="size-4" />
                  {choice.label}
                </label>
              ))}
            </fieldset>
            <p className="mt-2 text-xs text-slate-500">Met losse maanden telt het aantal niet. Haal alle vinkjes weg om weer de laatste maanden te zien.</p>
          </details>
        ) : null}
      </form>
    </Card>
  );
}

function formatValue(value: ReportValue, format: ReportTable['format']): string {
  if (value === null) return '–';
  if (typeof value === 'string') return value;
  if (format === 'percent') return `${value}%`;
  return value.toLocaleString('nl-NL', { maximumFractionDigits: format === 'decimal' ? 1 : 0 });
}

export function ReportTableView({ table }: { table: ReportTable }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-4 pt-4">
        <SectionTitle>{table.title}</SectionTitle>
        {table.note ? <p className="mt-1 text-xs text-slate-500">{table.note}</p> : null}
      </div>
      {table.rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-slate-500">Geen cijfers in deze periode.</p>
      ) : (
        <div className="relative mt-2 overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th scope="col" className="sticky left-0 bg-white px-4 py-2 text-left font-medium">
                  <span className="sr-only">Onderwerp</span>
                </th>
                {table.columns.map((column) => (
                  <th key={column} scope="col" className="px-3 py-2 text-right font-medium whitespace-nowrap">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {table.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className={cx('sticky left-0 bg-white px-4 py-2 text-left whitespace-nowrap', row.strong ? 'font-semibold text-slate-900' : 'font-normal text-slate-700')}>
                    {row.label}
                  </th>
                  {row.values.map((value, index) => (
                    <td
                      key={index}
                      className={cx(
                        'px-3 py-2 text-right tabular-nums',
                        row.strong ? 'font-semibold text-slate-900' : 'text-slate-700',
                        value === null && 'text-slate-300',
                      )}
                    >
                      {formatValue(value, table.format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Kleuren per reeks: brand, amber, blauw, paars. De tabel eronder heeft dezelfde cijfers. */
const SERIES_COLORS = ['#0f766e', '#d97706', '#2563eb', '#7c3aed', '#be123c'];

/** Een staafgrafiek als SVG, zonder bibliotheek of JavaScript (V68). Per periode een groep staven. */
export function BarChart({ chart }: { chart: ReportChart }) {
  const max = Math.max(1, ...chart.series.flatMap((series) => series.values));
  const width = 640;
  const height = 200;
  const top = 12;
  const bottom = 28;
  const left = 32;
  const plot = height - top - bottom;
  const group = (width - left) / Math.max(1, chart.labels.length);
  const bar = Math.max(2, Math.min(28, (group * 0.8) / Math.max(1, chart.series.length)));
  const step = niceStep(max);
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, index) => index * step);
  const y = (value: number) => top + plot - (value / Math.max(max, ticks.at(-1) ?? max)) * plot;
  const summary = chart.series.map((series) => `${series.name}: ${series.values.join(', ')}`).join('; ');
  return (
    <Card className="p-4">
      <SectionTitle>{chart.title}</SectionTitle>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${chart.title}. ${summary}`} className="mt-2 h-auto w-full">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={left} x2={width} y1={y(tick)} y2={y(tick)} stroke="#e2e8f0" />
            <text x={left - 6} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="#64748b">
              {tick}
            </text>
          </g>
        ))}
        {chart.labels.map((label, index) => {
          const start = left + index * group + (group - bar * chart.series.length) / 2;
          return (
            <g key={label}>
              {chart.series.map((series, seriesIndex) => {
                const value = series.values[index] ?? 0;
                return (
                  <rect
                    key={series.name}
                    x={start + seriesIndex * bar}
                    y={y(value)}
                    width={Math.max(1, bar - 2)}
                    height={Math.max(0, top + plot - y(value))}
                    rx={2}
                    fill={SERIES_COLORS[seriesIndex % SERIES_COLORS.length]}
                  >
                    <title>{`${series.name}, ${label}: ${value}`}</title>
                  </rect>
                );
              })}
              <text x={left + index * group + group / 2} y={height - 8} textAnchor="middle" fontSize="11" fill="#475569">
                {label}
              </text>
            </g>
          );
        })}
      </svg>
      {chart.series.length > 1 ? (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          {chart.series.map((series, index) => (
            <li key={series.name} className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-sm" style={{ backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length] }} aria-hidden="true" />
              {series.name}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

/** Een rond getal voor de lijnen in de grafiek: 1, 2, 5, 10, 20, 50… */
function niceStep(max: number): number {
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(Math.max(1, rough)));
  return [1, 2, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= rough) ?? 10 * power;
}

export function ReportView({ report }: { report: Report }) {
  return (
    <div className="space-y-4">
      {report.charts.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {report.charts.map((chart) => (
            <BarChart key={chart.title} chart={chart} />
          ))}
        </div>
      ) : null}
      {report.tables.map((table) => (
        <ReportTableView key={table.title} table={table} />
      ))}
    </div>
  );
}
