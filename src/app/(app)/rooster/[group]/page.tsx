import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { LinkTabs, PeriodNav, PersonLineView, StaffingPills, WorkingBlockView } from '@/components/schedule';
import { Badge, Card, buttonClass } from '@/components/ui';
import { requireViewer } from '@/lib/auth/session';
import { loadPlanningSnapshot } from '@/lib/db/queries';
import {
  addDays,
  isoWeekKey,
  isoWeekOf,
  mondayOfIsoWeekKey,
  startOfIsoWeek,
  todayInAmsterdam,
  weekdayOf,
} from '@/lib/engine/dates';
import { formatDateRange } from '@/lib/engine/format';
import { buildGroupWeek } from '@/lib/views/group-week';
import { findTab, groupSlug, rosterTabs } from '@/lib/views/tabs';

export const metadata: Metadata = { title: 'Rooster' };

export default async function GroupRosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ group: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const [{ group }, { week }] = await Promise.all([params, searchParams]);
  const viewer = await requireViewer();
  const today = todayInAmsterdam(new Date());
  // Op zondag laten we de week erna zien.
  const currentMonday = weekdayOf(today) === 7 ? addDays(today, 1) : startOfIsoWeek(today);
  const monday = (week ? mondayOfIsoWeekKey(week) : null) ?? currentMonday;
  const snapshot = await loadPlanningSnapshot(viewer.supabase, { from: monday, to: addDays(monday, 5) });
  const tab = findTab(snapshot.groups, group);
  if (!tab) notFound();

  const days = buildGroupWeek(snapshot, tab.groupIds, monday, today);
  const hrefFor = (slug: string, date: string) =>
    date === currentMonday ? `/rooster/${slug}` : `/rooster/${slug}?week=${isoWeekKey(date)}`;
  const title = `Week ${isoWeekOf(monday).week} · ${formatDateRange(monday, addDays(monday, 5))}`;
  // Beheerders tikken op een naam voor een roosterwijziging, of op "Regelen" bij een tekort.
  const changeHref = (employeeId: string, date: string) =>
    viewer.isAdmin ? `/beheer/rooster/${employeeId}/${date}` : undefined;

  return (
    <>
      <h1 className="sr-only">Rooster {tab.label}</h1>
      <LinkTabs
        active={tab.slug}
        tabs={rosterTabs(snapshot.groups).map((item) => ({
          key: item.slug,
          label: item.label,
          href: hrefFor(item.slug, monday),
        }))}
      />
      <PeriodNav
        title={title}
        previousHref={hrefFor(tab.slug, addDays(monday, -7))}
        nextHref={hrefFor(tab.slug, addDays(monday, 7))}
        todayHref={`/rooster/${tab.slug}`}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {days.map((day) => {
          const nobody = day.sections.every(
            (section) => !section.closure && section.working.length + section.absent.length + section.elsewhere.length === 0,
          );
          return (
            <Card key={day.date} className={day.isToday ? 'ring-2 ring-brand-600/40' : undefined}>
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
                <h2 className="font-semibold text-slate-900">{day.label}</h2>
                {day.isToday ? <Badge tone="brand">vandaag</Badge> : null}
              </div>
              <div className="space-y-3 px-4 py-2">
                {nobody ? <p className="py-1 text-sm text-slate-400">Niemand ingeroosterd</p> : null}
                {day.sections.map((section) => {
                  const empty =
                    !section.closure &&
                    section.working.length + section.absent.length + section.elsewhere.length === 0 &&
                    section.daysOff.length === 0;
                  if (empty && section.staffing.length === 0 && (day.sections.length > 1 || nobody)) return null;
                  return (
                    <div key={section.groupId}>
                      {day.sections.length > 1 ? (
                        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{section.groupName}</h3>
                      ) : null}
                      {section.closure ? (
                        <p className="py-1.5">
                          <Badge tone="closed">Gesloten: {section.closure}</Badge>
                        </p>
                      ) : null}
                      {section.staffing.length > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                          <StaffingPills pills={section.staffing} />
                          {section.short && viewer.isAdmin ? (
                            <Link
                              href={`/beheer/regelen/${groupSlug(section.groupId)}/${day.date}`}
                              className={buttonClass('primary', 'sm')}
                            >
                              Regelen
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                      {section.working.length > 0 ? (
                        <div className="space-y-2 py-1">
                          {section.working.map((block) => (
                            <WorkingBlockView key={block.role ?? 'iedereen'} block={block}>
                              {block.people.map((line) => (
                                <PersonLineView
                                  key={`${line.employeeId}-${line.borrowed}`}
                                  line={line}
                                  href={line.borrowed ? undefined : changeHref(line.employeeId, day.date)}
                                />
                              ))}
                            </WorkingBlockView>
                          ))}
                        </div>
                      ) : null}
                      {section.elsewhere.length > 0 ? (
                        <ul className="divide-y divide-slate-100">
                          {section.elsewhere.map((line) => (
                            <PersonLineView key={line.employeeId} line={line} href={changeHref(line.employeeId, day.date)} />
                          ))}
                        </ul>
                      ) : null}
                      {section.absent.length > 0 ? (
                        <div className="mt-1 border-t border-dashed border-slate-200 pt-1">
                          <p className="text-xs font-medium text-slate-500">Afwezig</p>
                          <ul>
                            {section.absent.map((line) => (
                              <PersonLineView key={line.employeeId} line={line} absent href={changeHref(line.employeeId, day.date)} />
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {section.daysOff.length > 0 ? (
                        <p className="mt-1 border-t border-dashed border-slate-200 pt-1 text-sm text-slate-500">
                          Geen dienst (gewijzigd):{' '}
                          {section.daysOff.map((person, index) => {
                            const href = changeHref(person.employeeId, day.date);
                            return (
                              <span key={person.employeeId}>
                                {index > 0 ? ', ' : ''}
                                {href ? (
                                  <Link href={href} className="underline decoration-slate-300 underline-offset-2">
                                    {person.name}
                                  </Link>
                                ) : (
                                  person.name
                                )}
                              </span>
                            );
                          })}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
