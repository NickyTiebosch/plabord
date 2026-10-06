import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { SubmitButton } from '@/components/client/form-controls';
import { IconLogout } from '@/components/icons';
import { Card, PageHeader, SectionTitle } from '@/components/ui';
import { requireViewer } from '@/lib/auth/session';
import { loadGroups, must } from '@/lib/db/queries';
import { formatDate } from '@/lib/engine/format';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { isAndroid } from '@/lib/feeds/device';
import { signOut } from '../../actions';
import { FeedCard, type FeedCardProps } from './feed-card';

export const metadata: Metadata = { title: 'Agenda' };

export default async function AgendaPage() {
  const viewer = await requireViewer();
  const [groups, feeds, android] = await Promise.all([
    loadGroups(viewer.supabase),
    viewer.supabase
      .from('calendar_feeds')
      .select('id, kind, group_id, created_at')
      .eq('employee_id', viewer.employeeId)
      .is('revoked_at', null)
      .then((result) => must(result, 'je agendalinks')),
    // Op Android werkt Toevoegen aan agenda niet; daar gaat het via de website van Google (V35).
    headers().then(isAndroid),
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
            <FeedCard key={`${card.kind}-${card.groupId ?? ''}`} {...card} android={android} />
          ))}
        </ul>
      </Card>

      <section className="mt-6 space-y-3">
        <SectionTitle>Zo voeg je de link toe</SectionTitle>
        {android ? <AndroidSteps open /> : null}
        <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer font-medium text-slate-900">iPhone of iPad</summary>
          <p className="mt-2 text-sm text-slate-700">
            Tik op <strong>Toevoegen aan agenda</strong> en daarna op <strong>Abonneer</strong>. Klaar. Via iCloud verschijnt
            de agenda ook op je andere Apple-apparaten.
          </p>
        </details>
        {android ? null : <AndroidSteps open={false} />}
        <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <summary className="cursor-pointer font-medium text-slate-900">Outlook</summary>
          <p className="mt-2 text-sm text-slate-700">
            Doe dit één keer op de computer: kopieer de link, open Outlook (of outlook.com), kies bij Agenda{' '}
            <strong>Agenda toevoegen</strong> → <strong>Abonneren vanaf internet</strong> en plak de link. Daarna staat hij
            ook in de Outlook-app op je telefoon.
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

/**
 * Android (besluit V35): de app Google Agenda kan geen agenda via een link toevoegen, en een
 * webcal-link opent daar niets. Het kan wel op de website van Google Agenda, ook op de telefoon met
 * Desktopsite aan. Op Android staat dit blok bovenaan en open.
 */
function AndroidSteps({ open }: { open: boolean }) {
  return (
    <details id="android" open={open} className="scroll-mt-20 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <summary className="cursor-pointer font-medium text-slate-900">Android (Google Agenda)</summary>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
        <li>
          Tik op <strong>Link maken</strong> en daarna op <strong>Kopieer link</strong>.
        </li>
        <li>
          Open <strong>Chrome</strong>, niet Samsung Internet, en ga naar <strong>calendar.google.com</strong>. Tik op{' '}
          <strong>⋮</strong> en zet <strong>Desktopsite</strong> aan.
        </li>
        <li>
          Tik bij <strong>Andere agenda&apos;s</strong> op <strong>+</strong> en kies <strong>Via URL</strong>. Zie je dat
          niet? Tik dan eerst linksboven op <strong>☰</strong>.
        </li>
        <li>
          Plak de link en tik op <strong>Agenda toevoegen</strong>.
        </li>
        <li>
          Open de app Google Agenda: <strong>☰</strong> → <strong>Instellingen</strong> → de nieuwe agenda (of eerst{' '}
          <strong>Meer weergeven</strong>). Zet <strong>Synchroniseren</strong> aan.
        </li>
      </ol>
      <p className="mt-2 text-sm text-slate-700">
        Liever op een computer? Doe stap 2 tot en met 4 daar, zonder Desktopsite. Stap 5 doe je op je telefoon.
      </p>
    </details>
  );
}
