import type { Metadata } from 'next';
import Link from 'next/link';
import { DayCloseCard, RegistrationFlash } from '@/components/registrations';
import { Card, PageHeader, SectionTitle, cx } from '@/components/ui';
import { requireLeadWith } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { loadClosures } from '@/lib/db/loan-queries';
import { loadCounterGroups, loadDayData, loadFirstClosedDates, loadWorkshops } from '@/lib/db/registration-queries';
import { isIsoDate, todayInAmsterdam } from '@/lib/engine/dates';
import { formatDayShort } from '@/lib/engine/format';
import { completionGrid, incidentDate, recentDays, walkInRows, type DayState } from '@/lib/registrations/status';
import { INCIDENT_KIND_LABELS } from '@/lib/registrations/types';

export const metadata: Metadata = { title: 'Invulcontrole' };

/** Zoveel dagen (ma–za) in het raster. */
const DAYS = 12;

const CELL: Record<DayState, { className: string; text: string; label: string }> = {
  closed: { className: 'bg-emerald-50 text-emerald-800', text: '✓', label: 'afgesloten' },
  pending: { className: 'bg-amber-50 text-amber-800', text: '…', label: 'vandaag, nog niet afgesloten' },
  open: { className: 'bg-rose-50 font-semibold text-rose-700', text: '✕', label: 'niet afgesloten' },
  shut: { className: 'bg-slate-50 text-slate-400', text: 'dicht', label: 'gesloten' },
  weekend: { className: 'text-slate-300', text: '–', label: 'zaterdag zonder registraties' },
  before: { className: 'text-slate-300', text: '–', label: 'nog niet in Planbord' },
};

/**
 * De invulcontrole (fase 6, V61), voor beheerder en teamleider: per vestiging per dag of de dag is
 * afgesloten. Een tik op een vakje toont wat er die dag is geregistreerd.
 */
export default async function CompletionPage({ searchParams }: { searchParams: Promise<{ vestiging?: string; dag?: string; melding?: string }> }) {
  const params = await searchParams;
  const today = todayInAmsterdam(new Date());
  const days = recentDays(today, DAYS);
  const first = days.at(-1) ?? today;
  const [viewer, [groups, workshops, data, dayOff, names]] = await requireLeadWith((supabase) =>
    Promise.all([
      loadCounterGroups(supabase),
      loadWorkshops(supabase),
      loadDayData(supabase, first, today),
      loadClosures(supabase, first, today),
      loadEmployeeNames(supabase),
    ]),
  );
  const firstDates = await loadFirstClosedDates(viewer.supabase, groups.map((group) => group.id));
  const rows = completionGrid(groups, days, today, data, dayOff, firstDates);
  const totalOpen = rows.reduce((sum, row) => sum + row.open, 0);

  const group = groups.find((item) => item.id === params.vestiging) ?? null;
  const date = params.dag && isIsoDate(params.dag) && days.includes(params.dag) ? params.dag : null;
  const detail = group && date ? { group, date } : null;
  const closure = detail ? (data.closures.find((item) => item.groupId === detail.group.id && item.date === detail.date) ?? null) : null;
  const dayIncidents = detail ? data.incidents.filter((item) => item.groupId === detail.group.id && incidentDate(item) === detail.date) : [];
  const dayWalkIns = detail ? walkInRows(workshops, data.walkIns, detail.group.id, detail.date).filter((row) => row.count > 0) : [];
  const workshopName = (id: string) => workshops.find((workshop) => workshop.id === id)?.name ?? 'Onbekende werkplaats';

  return (
    <>
      <PageHeader
        title="Invulcontrole"
        subtitle={totalOpen === 0 ? 'Alle dagen zijn afgesloten.' : `${totalOpen} ${totalOpen === 1 ? 'dag is' : 'dagen zijn'} niet afgesloten.`}
      />
      <RegistrationFlash code={params.melding} />

      <Card className="relative mb-2 overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-600">
              <th scope="col" className="sticky left-0 bg-white px-3 py-2 text-left font-medium">
                Vestiging
              </th>
              {days.map((day) => (
                <th key={day} scope="col" className="px-1 py-2 text-center font-medium whitespace-nowrap">
                  {day === today ? 'vandaag' : formatDayShort(day)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.groupId}>
                <th scope="row" className="sticky left-0 bg-white px-3 py-2 text-left font-medium whitespace-nowrap text-slate-900">
                  {row.groupName}
                </th>
                {row.cells.map((cell) => {
                  const style = CELL[cell.state];
                  const selected = detail?.group.id === row.groupId && detail.date === cell.date;
                  return (
                    <td key={cell.date} className="p-1 text-center">
                      <Link
                        href={`/controle?vestiging=${row.groupId}&dag=${cell.date}#dag`}
                        scroll={false}
                        className={cx(
                          'flex min-h-11 min-w-11 flex-col items-center justify-center rounded-lg px-1',
                          style.className,
                          selected && 'ring-2 ring-brand-600',
                        )}
                      >
                        <span aria-hidden="true">{style.text}</span>
                        <span className="sr-only">
                          {row.groupName}, {cell.label}: {style.label}
                        </span>
                        {cell.walkIns + cell.incidents > 0 ? (
                          <span className="text-[10px] font-normal text-slate-500" aria-hidden="true">
                            {cell.walkIns}·{cell.incidents}
                          </span>
                        ) : null}
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mb-6 text-xs text-slate-500">
        ✓ afgesloten · … vandaag nog open · ✕ niet afgesloten · – telt niet mee. De kleine cijfers: binnenvallers · meldingen. Een
        vestiging telt mee vanaf de eerste dag die ze in Planbord afsluit. Tik op een vakje voor de dag.
      </p>

      {detail ? (
        <section id="dag" className="scroll-mt-20 space-y-4">
          <SectionTitle>
            {detail.group.name}, {detail.date === today ? 'vandaag' : formatDayShort(detail.date)}
          </SectionTitle>
          <Card className="space-y-3 p-4 text-sm">
            <div>
              <p className="font-medium text-slate-900">Binnenvallers</p>
              {dayWalkIns.length === 0 ? (
                <p className="text-slate-500">Geen.</p>
              ) : (
                <p className="text-slate-700">{dayWalkIns.map((row) => `${row.workshop.name} ${row.count}`).join(' · ')}</p>
              )}
            </div>
            <div>
              <p className="font-medium text-slate-900">Meldingen</p>
              {dayIncidents.length === 0 ? (
                <p className="text-slate-500">Geen.</p>
              ) : (
                <ul className="text-slate-700">
                  {dayIncidents.map((incident) => (
                    <li key={incident.id}>
                      {workshopName(incident.workshopId)}: {INCIDENT_KIND_LABELS[incident.kind]}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href={`/binnenvallers?vestiging=${detail.group.id}&dag=${detail.date}`} className="font-medium text-brand-800 underline underline-offset-2">
                Binnenvallers van deze dag
              </Link>
              <Link
                href={`/meldingen/archief?vestiging=${detail.group.id}&van=${detail.date}&tot=${detail.date}`}
                className="font-medium text-brand-800 underline underline-offset-2"
              >
                Meldingen van deze dag
              </Link>
            </p>
          </Card>
          <DayCloseCard
            group={detail.group}
            date={detail.date}
            today={today}
            closure={closure}
            closedByName={closure?.closedBy ? (names.get(closure.closedBy) ?? null) : null}
            canReopen
            back={`/controle?vestiging=${detail.group.id}&dag=${detail.date}`}
          />
        </section>
      ) : null}
    </>
  );
}
