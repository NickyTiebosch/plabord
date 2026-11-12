import { redirect } from 'next/navigation';

/** Registraties (fase 5): zolang er één onderdeel is, meteen naar de uitleen. */
export default function RegistrationsPage() {
  redirect('/registraties/uitleen');
}
