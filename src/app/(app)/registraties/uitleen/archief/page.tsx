import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/client/form-controls';
import { Badge, Card, EmptyState, Field, LinkButton, PageHeader, buttonClass, inputClass } from '@/components/ui';
import { requireViewerWith } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { ARCHIVE_LIMIT, loadArchive, loadLoanGroups, type ArchiveFilter } from '@/lib/db/loan-queries';
import { addDays, isIsoDate, todayInAmsterdam } from '@/lib/engine/dates';
import { formatPlate, plateQuery } from '@/lib/loans/plates';
import { distance, formatLoanMoment, formatOdometer } from '@/lib/loans/status';
import { DESTINATION_LABELS, DESTINATIONS, isDestination } from '@/lib/loans/types';
import { undoReturn } from '../actions';
import { LoanFlash, type FlashParams } from '../flash';

export const metadata: Metadata = { title: 'Archief uitleen' };

interface Params extends FlashParams {
  zoek?: string;
  vestiging?: string;
  bestemming?: string;
  ingezet?: string;
  van?: string;
  tot?: string;
}

const DEFAULT_DAYS = 30;

/** Het archief van de uitleen (V47): alles wat retour is, ingezet en niet ingezet. */
export default async function LoanArchivePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const today = todayInAmsterdam(new Date());
  const to = isIsoDate(params.tot) ? params.tot : today;
  const fromCandidate = isIsoDate(params.van) ? params.van : addDays(to, -DEFAULT_DAYS);
  const from = fromCandidate <= to ? fromCandidate : to;
  const filter: ArchiveFilter = {
    from,
    to,
    groupId: params.vestiging && /^[a-z_]{1,40}$/.test(params.vestiging) ? params.vestiging : null,
    destination: isDestination(params.bestemming) ? params.bestemming : null,
    wasUsed: params.ingezet === 'ja' ? true : params.ingezet === 'nee' ? false : null,
    plate: plateQuery(params.zoek ?? ''),
  };
  const [viewer, [groups, archive, names]] = await requireViewerWith((supabase) =>
    Promise.all([loadLoanGroups(supabase), loadArchive(supabase, filter), loadEmployeeNames(supabase)]),
  );
  const groupName = (id: string) => groups.find((group) => group.id === id)?.name ?? id;
  const personName = (id: string | null) => (id ? (names.get(id) ?? 'oud-collega') : 'oud-collega');

  return (
    <>
      <PageHeader
        title="Archief uitleen"
        subtitle="Alles wat retour is gemeld, ingezet en niet ingezet. Registraties blijven 24 maanden bewaard."
        actions={
          <>
            {viewer.isLead ? (
              // Een gewone link: elke klik is één export in het logboek.
              <a href="/registraties/uitleen/export" download className={buttonClass('secondary')}>
                Download (Excel)
              </a>
            ) : null}
            <Link href="/registraties/uitleen" className="text-sm underline">
              Terug
            </Link>
          </>
        }
      />
      <LoanFlash params={params} />

      <Card className="mb-4 p-4">
        <form className="grid gap-3 sm:grid-cols-3" role="search">
          <Field label="Kenteken" htmlFor="zoek">
            <input
              id="zoek"
              name="zoek"
              defaultValue={params.zoek ?? ''}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="bijv. 39-K"
              className={`${inputClass} font-mono uppercase`}
            />
          </Field>
          <Field label="Van" htmlFor="van">
            <input id="van" name="van" type="date" defaultValue={from} className={inputClass} />
          </Field>
          <Field label="Tot en met" htmlFor="tot">
            <input id="tot" name="tot" type="date" defaultValue={to} className={inputClass} />
          </Field>
          <Field label="Vestiging" htmlFor="vestiging">
            <select id="vestiging" name="vestiging" defaultValue={filter.groupId ?? ''} className={inputClass}>
              <option value="">Alle vestigingen</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bestemming" htmlFor="bestemming">
            <select id="bestemming" name="bestemming" defaultValue={filter.destination ?? ''} className={inputClass}>
              <option value="">Alle bestemmingen</option>
              {DESTINATIONS.map((destination) => (
                <option key={destination} value={destination}>
                  {DESTINATION_LABELS[destination]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Ingezet" htmlFor="ingezet">
            <select id="ingezet" name="ingezet" defaultValue={params.ingezet ?? ''} className={inputClass}>
              <option value="">Ingezet en niet ingezet</option>
              <option value="ja">Ingezet</option>
              <option value="nee">Niet ingezet</option>
            </select>
          </Field>
          <div className="flex gap-2 sm:col-span-3">
            <SubmitButton>Zoeken</SubmitButton>
            <LinkButton href="/registraties/uitleen/archief" variant="ghost">
              Wissen
            </LinkButton>
          </div>
        </form>
      </Card>

      {archive.loans.length === 0 ? (
        <EmptyState title="Niets gevonden">Kies een langere periode of wis de filters.</EmptyState>
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-600">
            {archive.more ? `De nieuwste ${ARCHIVE_LIMIT}. Maak de periode kleiner om de rest te zien.` : `${archive.loans.length} gevonden.`}
          </p>
          <Card>
            <ul className="divide-y divide-slate-100">
              {archive.loans.map((loan) => {
                const km = distance(loan);
                return (
                  <li key={loan.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          <span className="font-mono tracking-wide">{formatPlate(loan.plate)}</span>
                          <span className="font-normal text-slate-600"> · {loan.model}</span>
                        </p>
                        <p className="text-sm text-slate-600">
                          {formatLoanMoment(loan.handedOutAt, today)} → {loan.returnedAt ? formatLoanMoment(loan.returnedAt, today) : '?'} ·{' '}
                          {groupName(loan.groupId)} · aan {loan.handedTo}
                        </p>
                        <p className="text-sm text-slate-500">
                          Mee: {personName(loan.handedOutBy)} · retour: {personName(loan.returnedBy)}
                          {loan.odometerOut !== null || loan.odometerIn !== null
                            ? ` · km ${formatOdometer(loan.odometerOut) || '?'} → ${formatOdometer(loan.odometerIn) || '?'}${km !== null ? ` (${formatOdometer(km)} km)` : ''}`
                            : ''}
                        </p>
                        {loan.note || loan.returnNote ? (
                          <p className="text-sm text-slate-500">{[loan.note, loan.returnNote].filter(Boolean).join(' · ')}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge tone="brand">{DESTINATION_LABELS[loan.destination]}</Badge>
                        {loan.wasUsed ? <Badge tone="success">ingezet</Badge> : <Badge>niet ingezet</Badge>}
                      </div>
                    </div>
                    {viewer.isLead ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <LinkButton href={`/registraties/uitleen/${loan.id}`} variant="ghost" size="sm">
                          Corrigeren
                        </LinkButton>
                        <form action={undoReturn}>
                          <input type="hidden" name="id" value={loan.id} />
                          <input type="hidden" name="kenteken" value={loan.plate} />
                          <input type="hidden" name="terug" value="archief" />
                          <SubmitButton size="sm" variant="ghost">
                            Retour ongedaan maken
                          </SubmitButton>
                        </form>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
