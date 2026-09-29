import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LineTone, ScheduleLine } from '@/lib/views/my-schedule';
import type { PersonLine } from '@/lib/views/group-week';
import { IconChevronLeft, IconChevronRight } from './icons';
import { Badge, buttonClass, cx } from './ui';

const lineToneClass: Record<LineTone, string> = {
  normal: 'text-slate-900',
  deviation: 'text-slate-900',
  absent: 'text-slate-400 line-through decoration-slate-300',
  closed: 'text-slate-400',
};

export function ScheduleLineView({ line }: { line: ScheduleLine }) {
  return (
    <p className={cx('flex flex-wrap items-center gap-x-2 gap-y-1', lineToneClass[line.tone])}>
      <span className="font-medium">{line.title}</span>
      <span className={line.tone === 'normal' || line.tone === 'deviation' ? 'text-slate-600' : undefined}>
        {line.detail}
      </span>
      {line.note ? (
        <Badge tone={line.tone === 'closed' ? 'closed' : line.tone === 'absent' ? 'absent' : 'warning'}>{line.note}</Badge>
      ) : null}
    </p>
  );
}

export function AbsenceBadge({ label, requested }: { label: string; requested: boolean }) {
  return (
    <Badge tone={requested ? 'requested' : 'absent'}>
      {label}
      {requested ? ' · aangevraagd' : ''}
    </Badge>
  );
}

export function PersonLineView({ line, absent = false }: { line: PersonLine; absent?: boolean }) {
  return (
    <li className="flex items-start justify-between gap-2 py-1.5">
      <span className={cx('min-w-0', absent ? 'text-slate-500' : 'text-slate-900')}>
        <span className="font-medium">{line.name}</span>
        {line.role ? <span className="text-slate-500"> · {line.role}</span> : null}
        {line.note ? (
          <span className="ml-1 inline-block align-middle">
            {absent ? (
              <Badge tone={line.requested ? 'requested' : 'absent'}>{line.note}</Badge>
            ) : (
              <Badge tone={line.borrowed ? 'brand' : 'warning'}>{line.note}</Badge>
            )}
          </span>
        ) : null}
      </span>
      {absent ? null : <span className="shrink-0 text-sm text-slate-600 tabular-nums">{line.times}</span>}
    </li>
  );
}

/** Vorige/volgende en "vandaag" voor een periode. */
export function PeriodNav({
  title,
  previousHref,
  nextHref,
  todayHref,
  children,
}: {
  title: string;
  previousHref: string;
  nextHref: string;
  todayHref: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Link href={previousHref} className={buttonClass('secondary', 'md')} aria-label="Vorige">
        <IconChevronLeft />
      </Link>
      <Link href={nextHref} className={buttonClass('secondary', 'md')} aria-label="Volgende">
        <IconChevronRight />
      </Link>
      <Link href={todayHref} className={buttonClass('ghost', 'md')}>
        Vandaag
      </Link>
      <h2 className="ml-1 text-lg font-semibold text-slate-900">{title}</h2>
      {children ? <div className="ml-auto flex flex-wrap gap-2">{children}</div> : null}
    </div>
  );
}

/** Tabs als links (werkt zonder JavaScript). */
export function LinkTabs({ tabs, active }: { tabs: { href: string; label: string; key: string }[]; active: string }) {
  return (
    <nav aria-label="Weergave" className="-mx-4 mb-4 overflow-x-auto px-4">
      <ul className="flex w-max gap-1 rounded-xl bg-slate-100 p-1">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={isActive ? 'page' : undefined}
                className={cx(
                  'inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap',
                  isActive ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
