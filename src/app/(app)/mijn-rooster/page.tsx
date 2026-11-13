import type { Metadata } from 'next';
import { PushToggle } from '@/components/client/push-toggle';
import { AbsenceBadge, ScheduleLineView } from '@/components/schedule';
import { Badge, Card, Notice, PageHeader, SectionTitle } from '@/components/ui';
import { requireViewerWith } from '@/lib/auth/session';
import { loadPlanningSnapshot } from '@/lib/db/queries';
import { addDays, startOfIsoWeek, todayInAmsterdam } from '@/lib/engine/dates';
import { computePersonalSchedule } from '@/lib/engine/schedule';
import { vapidPublicKey } from '@/lib/push/send';
import { buildMySchedule } from '@/lib/views/my-schedule';

export const metadata: Metadata = { title: 'Mijn rooster' };

const DAYS_AHEAD = 6 * 7;

export default async function MySchedulePage() {
  const today = todayInAmsterdam(new Date());
  // 6 weken vooruit, afgerond op hele weken (t/m de zaterdag).
  const to = addDays(startOfIsoWeek(addDays(today, DAYS_AHEAD - 1)), 5);
  const [viewer, snapshot] = await requireViewerWith((supabase) => loadPlanningSnapshot(supabase, { from: today, to }));
  const weeks = buildMySchedule(computePersonalSchedule(snapshot, viewer.employeeId, today, to), snapshot.groups, today);
  const hasShifts = snapshot.recurringShifts.some((shift) => shift.employeeId === viewer.employeeId);

  return (
    <>
      <PageHeader title="Mijn rooster" subtitle="De komende 6 weken" />
      {!hasShifts ? (
        <Notice tone="info" className="mb-4">
          Je hebt (nog) geen vaste diensten. Je afwezigheid staat hieronder wel.
        </Notice>
      ) : null}
      <div className="space-y-6">
        {weeks.map((week) => (
          <section key={week.key} aria-labelledby={`week-${week.key}`}>
            <h2 id={`week-${week.key}`} className="mb-2 text-sm font-semibold text-slate-500">
              {week.label}
            </h2>
            <Card>
              <ul className="divide-y divide-slate-100">
                {week.days.map((day) => (
                  <li
                    key={day.date}
                    className={day.isToday ? 'flex gap-3 bg-brand-50/60 px-4 py-3' : 'flex gap-3 px-4 py-3'}
                    aria-current={day.isToday ? 'date' : undefined}
                  >
                    <div className="w-24 shrink-0 whitespace-nowrap">
                      <p className="font-medium text-slate-900">{day.label}</p>
                      {day.isToday ? <Badge tone="brand">vandaag</Badge> : null}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      {day.lines.map((line, index) => (
                        <ScheduleLineView key={index} line={line} />
                      ))}
                      {day.absence ? <AbsenceBadge label={day.absence.label} requested={day.absence.requested} /> : null}
                      {day.lines.length === 0 && !day.absence ? <p className="text-slate-400">Vrij</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        ))}
      </div>
      <Card className="mt-6 space-y-2 p-4">
        <SectionTitle>Meldingen op dit toestel</SectionTitle>
        <PushToggle publicKey={vapidPublicKey()} />
      </Card>
    </>
  );
}
