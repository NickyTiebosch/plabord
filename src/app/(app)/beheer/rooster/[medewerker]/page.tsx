import { notFound, redirect } from 'next/navigation';
import { isUuid } from '@/lib/admin/forms';
import { requireAdmin } from '@/lib/auth/session';
import { isIsoDate } from '@/lib/engine/dates';

/** Vanaf de pagina van een medewerker: ?datum=… doorsturen naar de roosterwijziging van die dag. */
export default async function DayChangeRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ medewerker: string }>;
  searchParams: Promise<{ datum?: string }>;
}) {
  const [{ medewerker }, { datum }] = await Promise.all([params, searchParams]);
  await requireAdmin();
  if (!isUuid(medewerker)) notFound();
  if (!datum || !isIsoDate(datum)) redirect(`/beheer/medewerkers/${medewerker}`);
  redirect(`/beheer/rooster/${medewerker}/${datum}?terug=${encodeURIComponent(`/beheer/medewerkers/${medewerker}`)}`);
}
