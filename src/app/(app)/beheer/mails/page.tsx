import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { amsterdamDateTime } from '@/lib/engine/dates';
import { formatDayShort } from '@/lib/engine/format';
import { MAIL_KIND_LABELS, mailStatusLabel, pushLabel } from '@/lib/mail/labels';
import { formatDateList } from '@/lib/mail/messages';
import { MAIL_KINDS, MAIL_STATUSES } from '@/lib/mail/types';

export const metadata: Metadata = { title: 'Mails' };

const DAYS = 30;

/**
 * Beheer → Mails (fase 3): de mails van de laatste 30 dagen, met wie, waarover en de status.
 * Namen, geen e-mailadressen en geen inhoud.
 */
export default async function MailsPage() {
  const { supabase } = await requireAdmin();
  const now = new Date();
  const since = new Date(now.getTime() - DAYS * 24 * 60 * 60 * 1000).toISOString();
  const [names, result, setting] = await Promise.all([
    loadEmployeeNames(supabase),
    supabase
      .from('mail_queue')
      .select('id, employee_id, kind, dates, status, attempts, last_error, created_at, push_devices')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('settings').select('mail_enabled').maybeSingle(),
  ]);
  if (result.error) throw new Error('De mails konden niet worden geladen.');
  const rows = (result.data ?? []).flatMap((row) => {
    const kind = MAIL_KINDS.find((item) => item === row.kind);
    const status = MAIL_STATUSES.find((item) => item === row.status);
    if (!kind || !status) return [];
    const moment = amsterdamDateTime(new Date(row.created_at));
    return [
      {
        id: row.id,
        when: `${formatDayShort(moment.date)} ${moment.time}`,
        who: names.get(row.employee_id) ?? 'verwijderde medewerker',
        what: MAIL_KIND_LABELS[kind],
        dates: formatDateList(row.dates),
        status,
        statusLabel: mailStatusLabel(status, row.last_error, row.attempts),
        push: pushLabel(row.push_devices),
      },
    ];
  });

  return (
    <>
      <PageHeader
        title="Mails"
        subtitle={`De mails van de laatste ${DAYS} dagen. Zonder e-mailadressen of inhoud.`}
      />
      {!setting.data?.mail_enabled ? (
        <p className="mb-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          Meldingen staan uit. Hieronder zie je wat er verstuurd zou zijn. Aanzetten doe je bij{' '}
          <Link href="/beheer/instellingen" className="underline">
            Instellingen
          </Link>
          .
        </p>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState title="Nog geen mails" />
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <li key={row.id} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="font-medium text-slate-900">
                    {row.what}: {row.who}
                  </p>
                  <p className="text-xs text-slate-500 tabular-nums">{row.when}</p>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                  {row.dates ? <span>{row.dates}</span> : null}
                  <Badge tone={row.status === 'sent' ? 'success' : row.status === 'failed' ? 'absent' : 'neutral'}>
                    {row.statusLabel}
                  </Badge>
                  {row.push ? <Badge tone="brand">{row.push}</Badge> : null}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
