import Link from 'next/link';
import { buttonClass } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Deze pagina bestaat niet</h1>
      <Link href="/" className={buttonClass('primary')}>
        Naar mijn rooster
      </Link>
    </main>
  );
}
