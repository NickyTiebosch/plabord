import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Role } from '@/lib/engine/types';
import type { LineTone, ScheduleLine } from '@/lib/views/my-schedule';
import type { PersonLine, WorkingBlock } from '@/lib/views/group-week';
import { IconChevronLeft, IconChevronRight } from './icons';
import { Badge, buttonClass, cx } from './ui';

/**
 * Kleur per rol in het rooster: teal voor de balie, paars voor hiker/buitendienst, grijs voor de
 * rest. Amber en rood zijn al bezet: die betekenen "let op" en "afwezig of tekort".
 */
const roleColors: Record<Role, { block: string; heading: string; text: string }> = {
  counter: { block: 'border-brand-600 bg-brand-50/60', heading: 'text-brand-800', text: 'text-brand-700' },
  cleaning: { block: 'border-violet-500 bg-violet-50/70', heading: 'text-violet-800', text: 'text-violet-700' },
  backoffice: { block: 'border-slate-400 bg-slate-50', heading: 'text-slate-600', text: 'text-slate-500' },
  transport: { block: 'border-slate-400 bg-slate-50', heading: 'text-slate-600', text: 'text-slate-500' },
  none: { block: 'border-slate-400 bg-slate-50', heading: 'text-slate-600', text: 'text-slate-500' },
};

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

export function PersonLineView({ line, absent = false, href }: { line: PersonLine; absent?: boolean; href?: string }) {
  return (
    <li className="flex items-start justify-between gap-2 py-1.5">
      <span className={cx('min-w-0', absent ? 'text-slate-500' : 'text-slate-900')}>
        {href ? (
          <Link href={href} className="font-medium underline decoration-slate-300 underline-offset-2 hover:decoration-slate-600">
            {line.name}
          </Link>
        ) : (
          <span className="font-medium">{line.name}</span>
        )}
        {line.roleLabel ? <span className={roleColors[line.role].text}> · {line.roleLabel}</span> : null}
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

/** Wie er werkt met dezelfde rol, met een gekleurde streep en een kopje. Zonder rol gewoon een lijst. */
export function WorkingBlockView({ block, children }: { block: WorkingBlock; children: ReactNode }) {
  if (block.role === null) return <ul className="divide-y divide-slate-100">{children}</ul>;
  const color = roleColors[block.role];
  return (
    <div className={cx('rounded-r-lg border-l-4 pt-1.5 pr-3 pl-3', color.block)}>
      <h3 className={cx('text-xs font-semibold tracking-wide uppercase', color.heading)}>{block.label}</h3>
      <ul className="divide-y divide-slate-200/70">{children}</ul>
    </div>
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

/** Rode melding bij te weinig mensen aan de balie. Is de bezetting in orde, dan staat er niets (besluit V12). */
export function ShortageNotice({ text }: { text: string }) {
  return (
    <p className="inline-flex items-center rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-semibold text-white">{text}</p>
  );
}
