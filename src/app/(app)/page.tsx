import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { SubmitButton } from '@/components/client/form-controls';
import { IconChevronRight, IconClipboard, IconGrid, IconLogout, IconSettings } from '@/components/icons';
import { AbsenceBadge, ScheduleLineView } from '@/components/schedule';
import { Badge, Card, LinkButton, PageHeader, SectionTitle } from '@/components/ui';
import { requireViewer, type Viewer } from '@/lib/auth/session';
import { loadPlanningOverview } from '@/lib/db/admin-queries';
import { loadClosures, loadCurrentLoans, loadEndOfDay, loadFirstLoanDates, loadLoanGroups } from '@/lib/db/loan-queries';
import { loadPlanningSnapshot } from '@/lib/db/queries';
import { addDays, todayInAmsterdam } from '@/lib/engine/dates';
import { computePersonalSchedule } from '@/lib/engine/schedule';
import { parseTime } from '@/lib/engine/time';
import type { IsoDate } from '@/lib/engine/types';
import { loanSummary, recentWeekdays, type LoanSummary } from '@/lib/loans/status';
import { buildMySchedule, type MyScheduleDay } from '@/lib/views/my-schedule';
import { startShifts } from '@/lib/views/start';
import { signOut } from '../actions';

export const metadata: Metadata = { title: 'Start' };

/** Zo ver kijkt het startscherm vooruit voor je eerstvolgende dienst. */
const DAYS_AHEAD = 21;

async function loadLoans(viewer: Viewer, now: Date, today: IsoDate): Promise<LoanSummary> {
  const since = recentWeekdays(today, 2)[0] ?? today;
  const [groups, loans, closures, endOfDay] = await Promise.all([
    loadLoanGroups(viewer.supabase),
    loadCurrentLoans(viewer.supabase, since),
    loadClosures(viewer.supabase, since, today),
    loadEndOfDay(viewer.supabase),
  ]);
  const firstDates = await loadFirstLoanDates(viewer.supabase, groups.map((group) => group.id));
  return loanSummary(loans, groups, now, closures, parseTime(endOfDay) ?? '18:00', firstDates);
}

/** Voor beheerder en teamleider: gaten in het rooster en afwezigheid die op akkoord wacht. */
async function loadAttention(viewer: Viewer, today: IsoDate): Promise<{ gaps: number; requests: number } | null> {
  if (!viewer.isLead) return null;
  const [planning, requests] = await Promise.all([
    loadPlanningOverview(viewer.supabase, today),
    viewer.supabase.from('absences').select('id', { count: 'exact', head: true }).eq('status', 'requested'),
  ]);
  return { gaps: planning.gaps.length, requests: requests.count ?? 0 };
}

function DayLines({ day }: { day: MyScheduleDay }) {
  return (
    <div className="space-y-1">
      {day.lines.map((line, index) => (
        <ScheduleLineView key={index} line={line} />
      ))}
      {day.absence ? <AbsenceBadge label={day.absence.label} requested={day.absence.requested} /> : null}
      {day.lines.length === 0 && !day.absence ? <p className="text-slate-400">Vrij</p> : null}
    </div>
  );
}

function Tile({ href, icon, title, children, actions }: { href: string; icon: ReactNode; title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <Card className="flex flex-col">
      <Link href={href} className="flex min-h-14 items-center gap-3 rounded-t-xl px-4 py-3 hover:bg-slate-50">
        <span className="text-brand-700">{icon}</span>
        <span className="flex-1 text-base font-semibold text-slate-900">{title}</span>
        <IconChevronRight className="size-5 text-slate-400" />
      </Link>
      <div className="flex-1 space-y-1 border-t border-slate-100 px-4 py-3 text-sm text-slate-700">{children}</div>
      {actions ? <div className="flex flex-wrap gap-2 px-4 pb-4">{actions}</div> : null}
    </Card>
  );
}

function AttentionRow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50">
        <span className="flex-1">{children}</span>
        <IconChevronRight className="size-5 text-slate-400" />
      </Link>
    </li>
  );
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * Start (V53): waar iedereen na het inloggen uitkomt. Bovenaan je eigen dienst, daaronder een tegel
 * per onderdeel met de stand van nu. Toont alleen gegevens die er al zijn.
 */
export default async function StartPage() {
  // De gegevens hangen af van wie er kijkt (teamleider): daarom eerst de kijker (V31).
  const viewer = await requireViewer();
  const now = new Date();
  const today = todayInAmsterdam(now);
  const to = addDays(today, DAYS_AHEAD);
  const [snapshot, loans, attention] = await Promise.all([
    loadPlanningSnapshot(viewer.supabase, { from: today, to }),
    loadLoans(viewer, now, today),
    loadAttention(viewer, today),
  ]);
  const weeks = buildMySchedule(computePersonalSchedule(snapshot, viewer.employeeId, today, to), snapshot.groups, today);
  const shifts = startShifts(weeks);

  const alerts: { href: string; text: string }[] = [];
  if (attention && attention.gaps > 0) {
    alerts.push({ href: '/beheer/regelen', text: `${plural(attention.gaps, 'gat', 'gaten')} in het rooster om te regelen` });
  }
  if (attention && attention.requests > 0) {
    alerts.push({ href: '/beheer/afwezigheid', text: `${plural(attention.requests, 'aanvraag', 'aanvragen')} voor afwezigheid ${attention.requests === 1 ? 'wacht' : 'wachten'} op akkoord` });
  }
  if (viewer.isLead) {
    if (loans.overdue > 0) alerts.push({ href: '/controle', text: `${plural(loans.overdue, 'auto staat', 'auto’s staan')} te lang uit` });
    for (const short of loans.shortBefore) {
      alerts.push({ href: '/controle', text: `${short.groupName} gaf op ${short.label} ${short.count} van de ${short.required} auto’s aan Mobiliteit mee` });
    }
  }

  return (
    <>
      <PageHeader title="Start" subtitle={`Hallo ${viewer.name}`} />

      <Card className="mb-6">
        <div className="flex items-center justify-between px-4 pt-4">
          <SectionTitle>Jouw dienst</SectionTitle>
          <Link href="/mijn-rooster" className="text-sm font-medium text-brand-700 hover:underline">
            Mijn rooster
          </Link>
        </div>
        <ul className="divide-y divide-slate-100">
          <li className="flex gap-3 px-4 py-3">
            <div className="w-24 shrink-0">
              <Badge tone="brand">vandaag</Badge>
            </div>
            <div className="min-w-0 flex-1">{shifts.today ? <DayLines day={shifts.today} /> : <p className="text-slate-400">Vrij</p>}</div>
          </li>
          <li className="flex gap-3 px-4 py-3">
            <p className="w-24 shrink-0 font-medium whitespace-nowrap text-slate-900">{shifts.next ? shifts.next.label : 'Daarna'}</p>
            <div className="min-w-0 flex-1">
              {shifts.next ? <DayLines day={shifts.next} /> : <p className="text-slate-400">Geen dienst in de komende 3 weken</p>}
            </div>
          </li>
        </ul>
      </Card>

      {viewer.isLead ? (
        <section className="mb-6" aria-labelledby="let-op">
          <h2 id="let-op" className="mb-2 text-base font-semibold text-slate-900">
            Let op
          </h2>
          <Card>
            {alerts.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-600">Niets dat nu aandacht vraagt.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {alerts.map((alert) => (
                  <AttentionRow key={alert.text} href={alert.href}>
                    {alert.text}
                  </AttentionRow>
                ))}
              </ul>
            )}
          </Card>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Tile href="/mijn-rooster" icon={<IconGrid />} title="Planbord">
          <p>Je rooster, het rooster per vestiging, verlof en je agenda.</p>
        </Tile>

        <Tile
          href="/mobiliteit"
          icon={<IconClipboard />}
          title="Mobiliteit"
          actions={
            <LinkButton href="/mobiliteit/nieuw" variant="primary">
              Auto aanmelden
            </LinkButton>
          }
        >
          <p>
            {loans.open === 0 ? 'Er staat nu geen auto uit' : `${plural(loans.open, 'auto', 'auto’s')} uit`}
            {loans.overdue > 0 ? <span className="font-semibold text-rose-700">, {loans.overdue} te lang</span> : null}
          </p>
          {loans.today
            .filter((row) => row.state === 'ok' || row.state === 'pending' || row.state === 'before')
            .map((row) => (
              <p key={row.groupId}>
                Vandaag meegegeven{loans.today.length > 1 ? ` (${row.groupName})` : ''}: {row.count} van {row.required}
              </p>
            ))}
        </Tile>

        {viewer.isLead ? (
          <Tile href="/beheer" icon={<IconSettings />} title="Beheer">
            <p>{viewer.isAdmin ? 'Planning, medewerkers en instellingen.' : 'Afwezigheid en gaten regelen.'}</p>
          </Tile>
        ) : null}
      </div>

      <form action={signOut} className="mt-8 md:hidden">
        <SubmitButton variant="secondary">
          <IconLogout />
          Uitloggen
        </SubmitButton>
      </form>
    </>
  );
}
