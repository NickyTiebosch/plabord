import { redirect } from 'next/navigation';

/** Meer is vervangen door het startscherm (V53). Een oude link komt daar uit. */
export default function MorePage() {
  redirect('/');
}
