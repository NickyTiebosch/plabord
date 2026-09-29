import Link from 'next/link';
import { weekdayOf } from '@/lib/engine/dates';
import { formatDateRange } from '@/lib/engine/format';
import { ABSENCE_PART_LABELS } from '@/lib/engine/labels';
import type { LeaveBar, LeaveOverview } from '@/lib/engine/leave-overview';
import type { IsoDate } from '@/lib/engine/types';
import { dayWidth, monthSpans, spanOf, weekSpans, type LeaveView } from '@/lib/views/leave';
import { ScrollContainer } from './client/scroll-container';
import { cx } from './ui';

const NAME_WIDTH = 112;
const ROW_HEIGHT = 36;

function barLabel(name: string, bar: LeaveBar): string {
  const part = bar.dayPart === 'full_day' ? '' : ` (${ABSENCE_PART_LABELS[bar.dayPart]})`;
  const status = bar.status === 'requested' ? ', aangevraagd' : '';
  return `${name}: afwezig ${formatDateRange(bar.fullStartDate, bar.fullEndDate)}${part}${status}`;
}

function counterLabel(absent: number, total: number, width: number): string {
  if (width >= 110) return `${absent} van ${total} afwezig`;
  if (width >= 36) return `${absent}/${total}`;
  return absent > 0 ? String(absent) : '';
}

export function LeaveTimeline({
  overview,
  view,
  today,
  linkBars,
}: {
  overview: LeaveOverview;
  view: LeaveView;
  today: IsoDate;
  /** Beheerders kunnen op een balk tikken om de afwezigheid te wijzigen. */
  linkBars: boolean;
}) {
  const w = dayWidth(view);
  const { from, to, days } = overview;
  const width = days.length * w;
  const months = monthSpans(from, to, view !== 'maand');
  const weeks = weekSpans(from, to, overview.weeks);
  const weekendIndexes = days.flatMap((date, index) => (weekdayOf(date) >= 6 ? [index] : []));
  const todayIndex = today >= from && today <= to ? spanOf(from, to, today, today).start : null;

  // Open het overzicht met vandaag in beeld, met wat ruimte ervoor.
  const initialScrollLeft = todayIndex !== null ? Math.max(0, todayIndex * w - 7 * w) : 0;

  return (
    <ScrollContainer
      initialScrollLeft={initialScrollLeft}
      className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="relative" style={{ width: NAME_WIDTH + width }}>
        {/* Kop: maanden, weken en (bij maand) dagen */}
        <div className="flex border-b border-slate-200 text-xs text-slate-500">
          <div className="sticky left-0 z-20 shrink-0 bg-white" style={{ width: NAME_WIDTH }} />
          <div className="relative" style={{ width, height: view === 'maand' ? 60 : 40 }}>
            {months.map((month) => (
              <div
                key={`m-${month.start}`}
                className="absolute top-0 truncate border-l border-slate-200 px-1 py-0.5 font-medium text-slate-700"
                style={{ left: month.start * w, width: month.length * w }}
              >
                {month.label}
              </div>
            ))}
            {weeks.map((week) => (
              <div
                key={`w-${week.start}`}
                className="absolute top-5 truncate border-l border-slate-100 px-1"
                style={{ left: week.start * w, width: week.length * w }}
              >
                {week.length * w >= 30 ? week.label : ''}
              </div>
            ))}
            {view === 'maand'
              ? days.map((date, index) => (
                  <div
                    key={date}
                    className={cx(
                      'absolute top-10 text-center tabular-nums',
                      weekdayOf(date) >= 6 && 'text-slate-400',
                      date === today && 'font-bold text-brand-700',
                    )}
                    style={{ left: index * w, width: w }}
                  >
                    {Number(date.slice(8, 10))}
                  </div>
                ))
              : null}
          </div>
        </div>

        {overview.sections.map((section) => (
          <div key={section.groupId} className="border-b border-slate-200 last:border-b-0">
            {/* Groepsnaam en per week de teller "x van y afwezig" */}
            <div className="flex bg-slate-50">
              <div
                className="sticky left-0 z-10 shrink-0 truncate bg-slate-50 px-2 py-1.5 text-sm font-semibold text-slate-800"
                style={{ width: NAME_WIDTH }}
              >
                {section.groupName}
              </div>
              <div className="relative" style={{ width }}>
                {section.weekCounters.map((counter, index) => {
                  // De tellers staan in dezelfde volgorde als de weken van het overzicht.
                  const week = weeks[index];
                  if (!week || week.length === 0) return null;
                  const label = counterLabel(counter.absent, counter.total, week.length * w);
                  return (
                    <div
                      key={counter.monday}
                      title={`Week ${week.label.replace('wk ', '')}: ${counter.absent} van ${counter.total} afwezig`}
                      className={cx(
                        'absolute top-1 bottom-1 flex items-center justify-center truncate rounded text-xs tabular-nums',
                        counter.absent > 0 ? 'bg-rose-50 font-medium text-rose-700' : 'text-slate-400',
                      )}
                      style={{ left: week.start * w + 1, width: week.length * w - 2 }}
                    >
                      {label}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative">
              {/* Achtergrond: weekenden, sluitingsdagen en vandaag */}
              <div className="pointer-events-none absolute inset-y-0" style={{ left: NAME_WIDTH, width }} aria-hidden="true">
                {weekendIndexes.map((index) => (
                  <div key={`we-${index}`} className="absolute inset-y-0 bg-slate-100" style={{ left: index * w, width: w }} />
                ))}
                {section.closedDates.map((date) => {
                  const index = spanOf(from, to, date, date).start;
                  return (
                    <div key={`c-${date}`} className="absolute inset-y-0 bg-slate-200/80" style={{ left: index * w, width: w }} />
                  );
                })}
                {todayIndex !== null ? (
                  <div className="absolute inset-y-0 w-0.5 bg-brand-600/70" style={{ left: todayIndex * w + w / 2 }} />
                ) : null}
              </div>

              {section.rows.map((row) => (
                <div key={row.employeeId} className="flex border-t border-slate-100">
                  <div
                    className="sticky left-0 z-10 shrink-0 truncate bg-white px-2 text-sm leading-9 text-slate-800"
                    style={{ width: NAME_WIDTH, height: ROW_HEIGHT }}
                    title={row.name}
                  >
                    {row.name}
                  </div>
                  <div className="relative" style={{ width, height: ROW_HEIGHT }}>
                    {row.bars.map((bar) => {
                      const span = spanOf(from, to, bar.startDate, bar.endDate);
                      const label = barLabel(row.name, bar);
                      const className = cx(
                        'absolute block overflow-hidden rounded-sm',
                        bar.status === 'requested'
                          ? 'pattern-striped bg-rose-50 text-rose-400 ring-1 ring-rose-300 ring-inset'
                          : 'bg-rose-500',
                        bar.dayPart === 'morning' && 'top-1.5 h-3',
                        bar.dayPart === 'afternoon' && 'top-[19px] h-3',
                        bar.dayPart === 'full_day' && 'top-1.5 bottom-1.5',
                      );
                      const style = { left: span.start * w + 1, width: Math.max(span.length * w - 2, 2) };
                      return linkBars ? (
                        <Link
                          key={bar.absenceId}
                          href={`/beheer/afwezigheid/${bar.absenceId}`}
                          className={className}
                          style={style}
                          title={label}
                        >
                          <span className="sr-only">{label}</span>
                        </Link>
                      ) : (
                        <span key={bar.absenceId} className={className} style={style} title={label}>
                          <span className="sr-only">{label}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScrollContainer>
  );
}

export function LeaveLegend() {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-5 rounded-sm bg-rose-500" /> goedgekeurd
      </li>
      <li className="flex items-center gap-1.5">
        <span className="pattern-striped inline-block h-3 w-5 rounded-sm bg-rose-50 text-rose-400 ring-1 ring-rose-300 ring-inset" />{' '}
        aangevraagd
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-1.5 w-5 rounded-sm bg-rose-500" /> halve dag
      </li>
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-5 rounded-sm bg-slate-200" /> weekend of gesloten
      </li>
    </ul>
  );
}
