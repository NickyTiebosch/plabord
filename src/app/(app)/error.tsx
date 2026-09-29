'use client';

import { buttonClass } from '@/components/ui';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-rose-200 bg-white p-5">
      <h1 className="text-lg font-semibold text-slate-900">Er ging iets mis</h1>
      <p className="text-slate-700">
        De gegevens konden niet worden geladen. Probeer het opnieuw. Blijft het misgaan, geef dan deze code door aan de
        beheerder: <code className="rounded bg-slate-100 px-1">{error.digest ?? 'onbekend'}</code>
      </p>
      <button type="button" onClick={reset} className={buttonClass('primary')}>
        Opnieuw proberen
      </button>
    </div>
  );
}
