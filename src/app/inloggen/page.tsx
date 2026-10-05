import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, Notice } from '@/components/ui';
import { safeNextPath } from '@/lib/auth/redirect';
import { getSession } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Inloggen' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ volgende?: string }> }) {
  const { volgende } = await searchParams;
  const next = safeNextPath(volgende);

  if (isSupabaseConfigured()) {
    const session = await getSession();
    if (session.userId && session.employee) redirect(next);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-sm font-medium tracking-wide text-brand-700 uppercase">Planbord</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Inloggen</h1>
      </div>
      <Card className="p-5">
        {isSupabaseConfigured() ? (
          <LoginForm next={next} />
        ) : (
          <Notice tone="error">
            De app is nog niet gekoppeld aan Supabase. Zet de omgevingsvariabelen uit .env.example in Netlify en deploy
            opnieuw.
          </Notice>
        )}
      </Card>
      <p className="mt-6 text-center text-sm text-slate-600">
        Nieuw hier?{' '}
        <Link href="/uitleg" className="font-medium text-brand-700 underline underline-offset-2">
          Bekijk de uitleg
        </Link>
      </p>
    </main>
  );
}
