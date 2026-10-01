import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { SubmitButton } from '@/components/client/form-controls';
import { Card } from '@/components/ui';
import { getSession } from '@/lib/auth/session';
import { signOut } from '../actions';

export const metadata: Metadata = { title: 'Geen toegang' };

export default async function NoAccessPage() {
  const session = await getSession();
  if (!session.userId) redirect('/inloggen');
  if (session.employee) redirect('/');

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <Card className="space-y-4 p-5">
        <h1 className="text-xl font-semibold text-slate-900">Geen toegang</h1>
        <p className="text-slate-700">
          Je bent ingelogd{session.email ? ` als ${session.email}` : ''}, maar dit account hoort niet bij een actieve
          medewerker. Vraag de beheerder om je toe te voegen.
        </p>
        <form action={signOut}>
          <SubmitButton variant="secondary">Uitloggen</SubmitButton>
        </form>
      </Card>
    </main>
  );
}
