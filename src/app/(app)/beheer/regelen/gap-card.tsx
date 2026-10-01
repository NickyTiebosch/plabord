import Link from 'next/link';
import { SubmitButton } from '@/components/client/form-controls';
import { Card } from '@/components/ui';
import type { GapView } from '@/lib/admin/planning';
import type { Candidate } from '@/lib/engine/candidates';
import type { DayPart } from '@/lib/engine/types';
import { assignSubstitution, ignoreGap } from './actions';

/** Knop "Inzetten" voor één kandidaat. De server controleert vlak voor het opslaan opnieuw. */
export function AssignButton({
  candidate,
  groupId,
  date,
  dayParts,
  returnTo,
  primary = false,
}: {
  candidate: Candidate;
  groupId: string;
  date: string;
  dayParts: readonly DayPart[];
  returnTo: string;
  primary?: boolean;
}) {
  return (
    <form action={assignSubstitution}>
      <input type="hidden" name="employeeId" value={candidate.employeeId} />
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="date" value={date} />
      {dayParts.map((part) => (
        <input key={part} type="hidden" name="dayPart" value={part} />
      ))}
      <input type="hidden" name="terug" value={returnTo} />
      <SubmitButton size="sm" variant={primary ? 'primary' : 'secondary'}>
        Inzetten
      </SubmitButton>
    </form>
  );
}

/** Eén kandidaat met zijn uitleg en de knop. */
export function CandidateRow({
  candidate,
  groupId,
  date,
  dayParts,
  returnTo,
  primary,
}: {
  candidate: Candidate;
  groupId: string;
  date: string;
  dayParts: readonly DayPart[];
  returnTo: string;
  primary?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2">
      <p className="min-w-0 flex-1 text-sm text-slate-700">{candidate.explanation}</p>
      <AssignButton
        candidate={candidate}
        groupId={groupId}
        date={date}
        dayParts={dayParts}
        returnTo={returnTo}
        primary={primary}
      />
    </li>
  );
}

/** Een gat in "Nog te regelen": tekort, de eerste drie voorstellen, en verder naar alle keuzes of negeren. */
export function GapCard({ gap, returnTo }: { gap: GapView; returnTo: string }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold text-slate-900">
          {gap.groupName} · {gap.dateLabel}
        </h3>
        <p className="flex flex-wrap gap-1.5">
          {gap.parts.map((part) => (
            <span
              key={part.dayPart}
              className="inline-flex rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white tabular-nums"
            >
              {part.label}
            </span>
          ))}
        </p>
      </div>
      {gap.proposals.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">Niemand kan invallen voor het hele gat. Bekijk de keuzes per dagdeel.</p>
      ) : (
        <ul className="mt-1 divide-y divide-slate-100">
          {gap.proposals.map((candidate, index) => (
            <CandidateRow
              key={candidate.employeeId}
              candidate={candidate}
              groupId={gap.groupId}
              date={gap.date}
              dayParts={gap.dayParts}
              returnTo={returnTo}
              primary={index === 0}
            />
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <Link href={gap.href} className="text-sm font-medium text-brand-800 underline underline-offset-2">
          {gap.candidateCount > gap.proposals.length ? `Alle ${gap.candidateCount} keuzes` : 'Meer keuze en uitleg'}
        </Link>
        <form action={ignoreGap} className="ml-auto">
          <input type="hidden" name="groupId" value={gap.groupId} />
          <input type="hidden" name="date" value={gap.date} />
          <input type="hidden" name="terug" value={returnTo} />
          <SubmitButton size="sm" variant="ghost" confirm="Dit gat negeren? Het komt terug als het tekort groter wordt.">
            Negeren
          </SubmitButton>
        </form>
      </div>
    </Card>
  );
}
