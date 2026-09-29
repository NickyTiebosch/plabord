'use client';

import { useActionState } from 'react';
import { CopyButton, SubmitButton } from '@/components/client/form-controls';
import { IconCalendar } from '@/components/icons';
import { Badge, Notice, buttonClass } from '@/components/ui';
import { createFeedLink, revokeFeedLink, type FeedLinkState } from './actions';

export interface FeedCardProps {
  kind: 'personal' | 'location' | 'absences';
  groupId: string | null;
  title: string;
  description: string;
  active: { id: string; since: string } | null;
}

export function FeedCard({ kind, groupId, title, description, active }: FeedCardProps) {
  const [state, formAction] = useActionState<FeedLinkState, FormData>(createFeedLink, {});

  return (
    <li className="space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        {active ? <Badge tone="success">actief sinds {active.since}</Badge> : <Badge>nog geen link</Badge>}
      </div>

      {state.error ? <Notice tone="error">{state.error}</Notice> : null}

      {state.https && state.webcal ? (
        <div className="space-y-2 rounded-lg border border-brand-100 bg-brand-50 p-3">
          <p className="text-sm text-slate-800">
            Je nieuwe link. <strong>Je ziet hem maar één keer:</strong> voeg hem nu toe aan je agenda of bewaar hem.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={state.webcal} className={buttonClass('primary')}>
              <IconCalendar />
              Toevoegen aan agenda
            </a>
            <CopyButton text={state.https} />
          </div>
          <p className="text-xs break-all text-slate-600 select-all">{state.https}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <form action={formAction}>
          <input type="hidden" name="kind" value={kind} />
          {groupId ? <input type="hidden" name="groupId" value={groupId} /> : null}
          <SubmitButton
            variant={active ? 'secondary' : 'primary'}
            confirm={active ? 'Je huidige link stopt dan met werken. Doorgaan?' : undefined}
          >
            {active ? 'Nieuwe link maken' : 'Link maken'}
          </SubmitButton>
        </form>
        {active ? (
          <form action={revokeFeedLink}>
            <input type="hidden" name="id" value={active.id} />
            <SubmitButton variant="danger" confirm="Deze link intrekken? Agenda's met deze link worden niet meer bijgewerkt.">
              Intrekken
            </SubmitButton>
          </form>
        ) : null}
      </div>
    </li>
  );
}
