import { redirect } from 'next/navigation';

/** Het oude adres van de uitleen (tot V54): alles onder /registraties gaat naar Mobiliteit. */
export default function OldRegistrationsPage() {
  redirect('/mobiliteit');
}
