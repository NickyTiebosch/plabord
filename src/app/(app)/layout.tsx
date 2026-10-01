import Link from 'next/link';
import type { ReactNode } from 'react';
import { NavBar } from '@/components/client/nav-bar';
import { requireViewer } from '@/lib/auth/session';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const viewer = await requireViewer();
  return (
    <div className="min-h-dvh pb-24 sm:pb-8">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-brand-800">
            Planbord
          </Link>
          <NavBar isAdmin={viewer.isAdmin} variant="top" />
          <span className="max-w-[40%] truncate text-sm text-slate-600 sm:max-w-none">{viewer.name}</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
      <NavBar isAdmin={viewer.isAdmin} variant="bottom" />
    </div>
  );
}
