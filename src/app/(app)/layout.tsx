import Link from 'next/link';
import type { ReactNode } from 'react';
import { BottomNav, ModuleTabs, SideNav } from '@/components/client/app-nav';
import { SubmitButton } from '@/components/client/form-controls';
import { IconHelp, IconLogout } from '@/components/icons';
import { requireViewer } from '@/lib/auth/session';
import { signOut } from '../actions';

/**
 * Het raamwerk (V53). Breed scherm: links de zijbalk met de onderdelen, in de kop de tabs van het
 * gekozen onderdeel. Telefoon: de kop met de naam, en onderin de tabbalk.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();
  const nav = { isLead: viewer.isLead, usesLoans: viewer.usesLoans };
  return (
    <div className="min-h-dvh pb-24 md:pb-8 md:pl-56">
      <SideNav
        viewer={nav}
        footer={
          <>
            <Link
              href="/uitleg"
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              <IconHelp />
              Uitleg
            </Link>
            <p className="truncate px-3 pt-1 text-sm text-slate-500">{viewer.name}</p>
            <form action={signOut} className="px-1">
              <SubmitButton variant="secondary" size="sm">
                <IconLogout />
                Uitloggen
              </SubmitButton>
            </form>
          </>
        }
      />
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-brand-800 md:hidden">
            Planbord
          </Link>
          <ModuleTabs viewer={nav} />
          <div className="flex min-w-0 items-center gap-3 md:hidden">
            <Link href="/uitleg" className="text-sm font-medium text-brand-700 hover:underline">
              Uitleg
            </Link>
            <span className="max-w-[9rem] truncate text-sm text-slate-600">{viewer.name}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
      <BottomNav viewer={nav} />
    </div>
  );
}
