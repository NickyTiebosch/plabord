'use client';

import { useActionState, useState, useTransition } from 'react';
import { Card, Notice, SectionTitle, buttonClass } from '@/components/ui';
import { formatDayShort } from '@/lib/engine/format';
import type { ImportIssue } from '@/lib/import/workbook';
import { historyAction, type HistoryState } from './actions';

function IssueList({ issues }: { issues: ImportIssue[] }) {
  return (
    <ul className="space-y-1 text-sm">
      {issues.map((issue, index) => (
        <li key={index}>
          <span className="font-medium">
            {issue.sheet ?? 'Bestand'}
            {issue.row ? `, regel ${issue.row}` : ''}:
          </span>{' '}
          {issue.message}
        </li>
      ))}
    </ul>
  );
}

export function HistoryPanel() {
  const [state, dispatch] = useActionState<HistoryState, FormData>(historyAction, { status: 'idle' });
  const [file, setFile] = useState<File | null>(null);
  const [checkedFile, setCheckedFile] = useState<File | null>(null);
  const [markCharged, setMarkCharged] = useState(true);
  const [pending, startTransition] = useTransition();

  function submit(intent: 'preview' | 'apply' | 'reset') {
    if (intent === 'preview') setCheckedFile(file);
    const form = new FormData();
    form.set('intent', intent);
    if (file && intent !== 'reset') form.set('file', file);
    if (state.fingerprint) form.set('fingerprint', state.fingerprint);
    if (markCharged) form.set('markCharged', 'on');
    startTransition(() => dispatch(form));
  }

  if (state.status === 'done' && state.result) {
    return (
      <Card className="space-y-3 p-4">
        <Notice tone="success">
          Ingelezen uit {state.fileName}: {state.result.walkIns} binnenvaller-vak(ken) en {state.result.incidents} melding(en) nieuw of
          bijgewerkt.
        </Notice>
        <button
          type="button"
          className={buttonClass('secondary')}
          onClick={() => {
            setFile(null);
            submit('reset');
          }}
        >
          Nog een bestand inlezen
        </button>
      </Card>
    );
  }

  const preview = state.preview;
  const canApply = Boolean(preview && preview.errors.length === 0 && file !== null && file === checkedFile);
  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <label htmlFor="history-file" className="block text-sm font-medium text-slate-800">
          Excel-bestand (.xlsx, maximaal 2 MB)
        </label>
        <input
          id="history-file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:font-medium file:text-slate-800"
        />
        <label className="flex min-h-11 items-start gap-3 text-sm text-slate-800">
          <input
            type="checkbox"
            checked={markCharged}
            onChange={(event) => setMarkCharged(event.target.checked)}
            className="mt-1 size-5 shrink-0"
          />
          <span>
            Annuleringen die doorbelast moesten worden, komen binnen als <strong>doorbelast</strong>.
            <span className="block text-slate-600">
              Het oude bestand zegt niet of dat al is gebeurd. Zet dit uit als je ze op de doorbelastlijst wilt nalopen.
            </span>
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!file || pending}
            onClick={() => submit('preview')}
            className={buttonClass(canApply ? 'secondary' : 'primary')}
          >
            {pending ? 'Bezig…' : 'Controleren'}
          </button>
          {canApply ? (
            <button type="button" disabled={pending} onClick={() => submit('apply')} className={buttonClass('primary')}>
              {pending ? 'Bezig…' : 'Inlezen'}
            </button>
          ) : null}
        </div>
        {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      </Card>

      {preview ? (
        <Card className="space-y-4 p-4">
          <SectionTitle>Voorvertoning{state.fileName ? ` van ${state.fileName}` : ''}</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[20rem] text-left text-sm">
              <thead className="text-xs whitespace-nowrap text-slate-500">
                <tr>
                  <th className="py-1 pr-3 font-medium">Vestiging</th>
                  <th className="py-1 pr-3 font-medium">Periode</th>
                  <th className="py-1 pr-3 font-medium">Dagen</th>
                  <th className="py-1 pr-3 font-medium">Binnenvallers</th>
                  <th className="py-1 font-medium">Meldingen</th>
                </tr>
              </thead>
              <tbody>
                {preview.summary.map((row) => (
                  <tr key={row.groupId} className="border-t border-slate-100">
                    <td className="py-1.5 pr-3 font-medium text-slate-800">{row.name}</td>
                    <td className="py-1.5 pr-3 whitespace-nowrap">
                      {row.from && row.to ? `${formatDayShort(row.from)} – ${formatDayShort(row.to)}` : '–'}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums">{row.walkInDays || '–'}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{row.walkInTotal || '–'}</td>
                    <td className="py-1.5 tabular-nums">{row.incidents || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.incidents > 0 ? (
            <p className="text-sm text-slate-700">
              {preview.chargeable} van de {preview.incidents} meldingen moeten worden doorbelast.
            </p>
          ) : null}
          {preview.errors.length > 0 ? (
            <Notice tone="error">
              <p className="mb-1 font-medium">
                {preview.errors.length} fout(en). Pas het bestand of de werkplaatsen aan en controleer opnieuw; er wordt niets opgeslagen
                zolang er fouten zijn.
              </p>
              <IssueList issues={preview.errors} />
            </Notice>
          ) : (
            <Notice tone="success">Geen fouten. Klik op Inlezen om op te slaan.</Notice>
          )}
          {preview.notices.length > 0 ? (
            <details open={preview.notices.length <= 10}>
              <summary className="cursor-pointer text-sm font-medium text-slate-700">{preview.notices.length} opmerking(en)</summary>
              <div className="mt-2">
                <IssueList issues={preview.notices} />
              </div>
            </details>
          ) : null}
          {preview.skippedSheets.length > 0 ? (
            <p className="text-sm text-slate-600">Overgeslagen tabbladen: {preview.skippedSheets.join(', ')}.</p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
