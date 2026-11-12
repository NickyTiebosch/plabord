import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SubmitButton } from '@/components/client/form-controls';
import { IconCalendar, IconCheck, IconChevronRight, IconHelp, IconLogout, IconSettings } from '@/components/icons';
import { Card, PageHeader } from '@/components/ui';
import { requireViewer } from '@/lib/auth/session';
import { signOut } from '../../actions';

export const metadata: Metadata = { title: 'Meer' };

function Row({ href, icon, title, text }: { href: string; icon: ReactNode; title: string; text: string }) {
  return (
    <li>
      <Link href={href} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-slate-50">
        <span className="text-brand-700">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-slate-900">{title}</span>
          <span className="block text-sm text-slate-600">{text}</span>
        </span>
        <IconChevronRight className="size-5 text-slate-400" />
      </Link>
    </li>
  );
}

/** Meer (fase 5, V44): wat niet in de tabbalk op de telefoon past. */
export default async function MorePage() {
  const viewer = await requireViewer();
  return (
    <>
      <PageHeader title="Meer" />
      <Card>
        <ul className="divide-y divide-slate-100">
          <Row href="/agenda" icon={<IconCalendar />} title="Agenda" text="Je rooster in de agenda van je telefoon of computer." />
          <Row href="/uitleg" icon={<IconHelp />} title="Uitleg" text="Korte uitleg en video’s over Planbord." />
          {viewer.isLead ? (
            <Row href="/controle" icon={<IconCheck />} title="Controle" text="Wat er uit staat, en of Mobiliteit elke werkdag auto’s kreeg." />
          ) : null}
          {viewer.isLead ? (
            <Row
              href="/beheer"
              icon={<IconSettings />}
              title="Beheer"
              text={viewer.isAdmin ? 'Planning, medewerkers en instellingen.' : 'Afwezigheid en gaten regelen.'}
            />
          ) : null}
        </ul>
      </Card>
      <form action={signOut} className="mt-8">
        <SubmitButton variant="secondary">
          <IconLogout />
          Uitloggen
        </SubmitButton>
      </form>
    </>
  );
}
