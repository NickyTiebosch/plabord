import { Badge, LinkButton } from '@/components/ui';
import { formatPlate } from '@/lib/loans/plates';
import { formatLoanMoment } from '@/lib/loans/status';
import type { IsoDate } from '@/lib/engine/types';
import { INCIDENT_KIND_LABELS, MISSING_LABELS, type Incident } from '@/lib/registrations/types';

/** Eén melding in een lijst. `editable`: toon Wijzigen (V59). */
export function IncidentRow({
  incident,
  workshopName,
  groupName,
  reporterName,
  today,
  editable,
}: {
  incident: Incident;
  workshopName: string;
  groupName?: string;
  reporterName: string;
  today: IsoDate;
  editable: boolean;
}) {
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">
            {INCIDENT_KIND_LABELS[incident.kind]}
            {incident.missing ? <span className="font-normal text-slate-600"> · {MISSING_LABELS[incident.missing].toLowerCase()} ontbrak</span> : null}
          </p>
          <p className="text-sm text-slate-600">
            {workshopName}
            {groupName ? ` (${groupName})` : ''} · {formatLoanMoment(incident.occurredAt, today)} · door {reporterName}
          </p>
          <p className="text-sm text-slate-600">
            {incident.plate ? <span className="font-mono font-semibold tracking-wide text-slate-800">{formatPlate(incident.plate)}</span> : null}
            {incident.plate && incident.contractNumber ? ' · ' : ''}
            {incident.contractNumber ? `nr. ${incident.contractNumber}` : ''}
            {incident.kind === 'cancellation' && incident.cancelledAt ? `${incident.plate || incident.contractNumber ? ' · ' : ''}geannuleerd om ${incident.cancelledAt}` : ''}
          </p>
          {incident.note ? <p className="text-sm text-slate-500">{incident.note}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {incident.charge === true ? (
            incident.chargedAt ? <Badge tone="success">doorbelast</Badge> : <Badge tone="warning">doorbelasten</Badge>
          ) : incident.charge === false ? (
            <Badge>niet doorbelasten</Badge>
          ) : null}
          {editable ? (
            <LinkButton href={`/meldingen/${incident.id}`} variant="ghost" size="sm">
              Wijzigen
            </LinkButton>
          ) : null}
        </div>
      </div>
    </li>
  );
}
