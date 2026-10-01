import type { Metadata } from 'next';
import { SubmitButton } from '@/components/client/form-controls';
import { IconLogout } from '@/components/icons';
import { Card, PageHeader, SectionTitle } from '@/components/ui';
import { requireViewer } from '@/lib/auth/session';
import { loadGroups, must } from '@/lib/db/queries';
import { formatDate } from '@/lib/engine/format';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { signOut } from '../../actions';
import { FeedCard, type FeedCardProps } from './feed-card';

export const metadata: Metadata = { title: 'Agenda' };

export default async function AgendaPage() {
  const viewer = await requireViewer();
  const [groups, feeds] = await Promise.all([
    loadGroups(viewer.supabase),
    viewer.supabase
      .from('calendar_feeds')
      .select('id, kind, group_id, created_at')
      .eq('employee_id', viewer.employeeId)
      .is('revoked_at', null)
      .then((result) => must(result, 'je agendalinks')),
  ]);

  const activeFor = (kind: string, groupId: string | null) => {
    const feed = feeds.find((item) => item.kind === kind && item.group_id === groupId);
    return feed ? { id: feed.id, since: formatDate(todayInAmsterdam(new Date(feed.created_at))) } : null;
  };

  const cards: FeedCardProps[] = [
    {
      kind: 'personal',
      groupId: null,
      title: 'Mijn rooster',
      description: 'Je eigen diensten en afwezigheid.',
      active: activeFor('personal', null),
    },
    ...groups
      .filter((group) => group.hasCounter)
      .map((group) => ({
        kind: 'location' as const,
        groupId: group.id,
        title: `Vestiging ${group.name}`,
        description: `Wie er werkt in ${group.name}.`,
        active: activeFor('location', group.id),
      })),
    {
      kind: 'absences',
      groupId: null,
      title: 'Verlof team',
      description: 'Wie er afwezig is.',
      active: activeFor('absences', null),
    },
  ];

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle="Zet je rooster in de agenda van je telefoon of computer. De agenda werkt zichzelf bij."
      />
      <Card>
        <ul className="divide-y divide-slate-100">
          {cards.map((card) => (
            <FeedCard key={`${card.kind}-${card.groupId ?? ''}`} {...card} />
          ))}
        </ul>
      </Card>

      <section className="mt-6 space-y-3">
        <SectionTitle>Zo voeg je de link toe</SectionTitle>
        <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer font-medium text-slate-900">iPhone of iPad</summary>
          <p className="mt-2 text-sm text-slate-700">
            Tik op <strong>Toevoegen aan agenda</strong> en daarna op <strong>Abonneer</strong>. Klaar. Via iCloud verschijnt
            de agenda ook op je andere Apple-apparaten.
          </p>
        </details>
        <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer font-medium text-slate-900">Outlook</summary>
          <p className="mt-2 text-sm text-slate-700">
            Doe dit één keer op de computer: kopieer de link, open Outlook (of outlook.com), kies bij Agenda{' '}
            <strong>Agenda toevoegen</strong> → <strong>Abonneren vanaf internet</strong> en plak de link. Daarna staat hij
            ook in de Outlook-app op je telefoon.
          </p>
        </details>
        <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer font-medium text-slate-900">Google Agenda</summary>
          <p className="mt-2 text-sm text-slate-700">
            Doe dit één keer op de computer: kopieer de link, ga naar calendar.google.com, klik bij{' '}
            <strong>Andere agenda&apos;s</strong> op <strong>+</strong> → <strong>Via URL</strong> en plak de link. Daarna
            staat hij ook in de app op je telefoon.
          </p>
        </details>
        <p className="text-sm text-slate-600">
          Let op: Google Agenda en Outlook halen wijzigingen zelf op, soms pas na een paar uur. In Planbord zie je altijd de
          actuele stand.
        </p>
      </section>

      <form action={signOut} className="mt-8">
        <SubmitButton variant="secondary">
          <IconLogout />
          Uitloggen
        </SubmitButton>
      </form>
    </>
  );
}
