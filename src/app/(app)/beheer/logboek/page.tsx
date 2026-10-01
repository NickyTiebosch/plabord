import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader, buttonClass } from '@/components/ui';
import { AUDIT_ENTITIES, describeAudit, type AuditRow } from '@/lib/admin/audit';
import { isUuid } from '@/lib/admin/forms';
import { requireAdmin } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { loadGroups } from '@/lib/db/queries';

export const metadata: Metadata = { title: 'Logboek' };

const PAGE_SIZE = 50;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ soort?: string; medewerker?: string; pagina?: string }>;
}) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const page = Math.max(1, Number.parseInt(params.pagina ?? '1', 10) || 1);
  const entity = params.soort && params.soort in AUDIT_ENTITIES ? params.soort : '';
  const employeeId = isUuid(params.medewerker) ? params.medewerker : '';

  let query = supabase
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (entity) query = query.eq('entity', entity);
  if (employeeId) query = query.eq('employee_id', employeeId);

  const [names, groups, result] = await Promise.all([loadEmployeeNames(supabase), loadGroups(supabase), query]);
  if (result.error) throw new Error('Het logboek kon niet worden geladen.');
  const lookups = {
    employeeName: (id: string | null | undefined) => (id ? (names.get(id) ?? 'verwijderde medewerker') : 'onbekend'),
    groupName: (id: string | null | undefined) => groups.find((group) => group.id === id)?.name ?? String(id ?? ''),
  };
  const rows = (result.data ?? []).map((row) => describeAudit(row as AuditRow, lookups));
  const total = result.count ?? rows.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (entity) query.set('soort', entity);
    if (employeeId) query.set('medewerker', employeeId);
    if (target > 1) query.set('pagina', String(target));
    const text = query.toString();
    return text ? `/beheer/logboek?${text}` : '/beheer/logboek';
  };
  const people = [...names.entries()].sort((a, b) => a[1].localeCompare(b[1], 'nl'));

  return (
    <>
      <PageHeader title="Logboek" subtitle="Wie wat wanneer wijzigde. Zonder e-mailadressen of andere gevoelige inhoud. Regels blijven 12 maanden bewaard." />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-2">
        <select name="soort" defaultValue={entity} aria-label="Soort" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
          <option value="">Alles</option>
          {Object.entries(AUDIT_ENTITIES).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select name="medewerker" defaultValue={employeeId} aria-label="Medewerker" className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
          <option value="">Iedereen</option>
          {people.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClass('secondary')}>
          Filteren
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="Nog niets in het logboek" />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <li key={row.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-medium text-slate-900">{row.what}</p>
                  <p className="text-xs text-slate-500 tabular-nums">{row.when}</p>
                </div>
                {row.detail ? <p className="text-sm text-slate-700">{row.detail}</p> : null}
                <p className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                  door {row.who}
                  {row.source === 'import' ? <Badge>import</Badge> : null}
                  {row.source === 'controle' ? <Badge>automatisch</Badge> : null}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {pages > 1 ? (
        <nav aria-label="Pagina's" className="mt-4 flex items-center gap-2">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={buttonClass('secondary', 'sm')}>
              Nieuwer
            </Link>
          ) : null}
          <span className="text-sm text-slate-600">
            Pagina {page} van {pages}
          </span>
          {page < pages ? (
            <Link href={pageHref(page + 1)} className={buttonClass('secondary', 'sm')}>
              Ouder
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
