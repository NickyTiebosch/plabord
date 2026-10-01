'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '../ui';

const ITEMS = [
  { href: '/beheer', label: 'Overzicht', exact: true },
  { href: '/beheer/afwezigheid', label: 'Afwezigheid' },
  { href: '/beheer/invallen', label: 'Invallen' },
  { href: '/beheer/medewerkers', label: 'Medewerkers' },
  { href: '/beheer/sluitingsdagen', label: 'Sluitingsdagen' },
  { href: '/beheer/instellingen', label: 'Instellingen' },
  { href: '/beheer/import', label: 'Import' },
  { href: '/beheer/logboek', label: 'Logboek' },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Beheer" className="-mx-4 mb-5 overflow-x-auto px-4">
      <ul className="flex w-max gap-1 rounded-xl bg-slate-100 p-1">
        {ITEMS.map((item) => {
          const active = item.exact ? path === item.href : path.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap',
                  active ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-600 hover:text-slate-900',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
