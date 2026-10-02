'use client';

import { useActionState, useState, useTransition } from 'react';
import { Badge, Card, Notice, SectionTitle, buttonClass, cx } from '@/components/ui';
import type { ImportIssue } from '@/lib/import/workbook';
import { importAction, type ImportState } from './actions';

const SHEET_LABELS: Record<string, string> = {
  employees: 'Medewerkers',
  shifts: 'Vaste roosters',
  absences: 'Afwezigheid',
};

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

export function ImportPanel() {
  const [state, dispatch] = useActionState<ImportState, FormData>(importAction, { status: 'idle' });
  const [file, setFile] = useState<File | null>(null);
  // Alleen importeren wat je ook hebt gecontroleerd.
  const [checkedFile, setCheckedFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(intent: 'preview' | 'apply' | 'reset') {
    if (intent === 'preview') setCheckedFile(file);
    const form = new FormData();
    form.set('intent', intent);
    if (file && intent !== 'reset') form.set('file', file);
    if (state.fingerprint) form.set('fingerprint', state.fingerprint);
    startTransition(() => dispatch(form));
  }

  if (state.status === 'done' && state.result) {
    const result = state.result;
    return (
      <Card className="space-y-3 p-4">
        <Notice tone="success">
          Import klaar: {result.employees} medewerker(s), {result.shifts} vaste dienst(en) en {result.absences} afwezigheid
          opgeslagen. {result.accountsCreated > 0 ? `${result.accountsCreated} inlogaccount(s) aangemaakt.` : ''}
        </Notice>
        {result.reviewNote ? <Notice tone="warning">{result.reviewNote}</Notice> : null}
        {result.accountErrors.length > 0 ? (
          <Notice tone="warning">
            Niet alle accounts konden worden aangemaakt. Importeer het bestand nog een keer om het opnieuw te proberen.
            <ul className="mt-1 list-disc pl-5">
              {result.accountErrors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </Notice>
        ) : null}
        <button
          type="button"
          className={buttonClass('secondary')}
          onClick={() => {
            setFile(null);
            submit('reset');
          }}
        >
          Nog een bestand importeren
        </button>
      </Card>
    );
  }

  const preview = state.preview;
  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <label htmlFor="import-file" className="block text-sm font-medium text-slate-800">
          Excel-bestand (.xlsx, maximaal 2 MB)
        </label>
        <input
          id="import-file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:font-medium file:text-slate-800"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!file || pending}
            onClick={() => submit('preview')}
            className={buttonClass(preview?.canApply && file === checkedFile ? 'secondary' : 'primary')}
          >
            {pending ? 'Bezig…' : 'Controleren'}
          </button>
          {preview?.canApply && file !== null && file === checkedFile ? (
            <button type="button" disabled={!file || pending} onClick={() => submit('apply')} className={buttonClass('primary')}>
              {pending ? 'Bezig…' : 'Importeren'}
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
                  <th className="py-1 pr-3 font-medium">Tabblad</th>
                  <th className="py-1 pr-3 font-medium">Nieuw</th>
                  <th className="py-1 pr-3 font-medium">Bijgewerkt</th>
                  <th className="py-1 font-medium">Ongewijzigd</th>
                </tr>
              </thead>
              <tbody>
                {(['employees', 'shifts', 'absences'] as const).map((key) => (
                  <tr key={key} className="border-t border-slate-100">
                    <td className="py-1.5 pr-3 font-medium text-slate-800">{SHEET_LABELS[key]}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{preview.summary[key].create}</td>
                    <td className="py-1.5 pr-3 tabular-nums">{preview.summary[key].update}</td>
                    <td className="py-1.5 tabular-nums">{preview.summary[key].unchanged}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.errors.length > 0 ? (
            <Notice tone="error">
              <p className="mb-1 font-medium">
                {preview.errors.length} fout(en). Pas het bestand aan en controleer het opnieuw; er wordt niets opgeslagen
                zolang er fouten zijn.
              </p>
              <IssueList issues={preview.errors} />
            </Notice>
          ) : preview.canApply ? (
            <Notice tone="success">Geen fouten. Klik op Importeren om op te slaan.</Notice>
          ) : (
            <Notice tone="info">Alles is al up-to-date: er is niets nieuws om op te slaan.</Notice>
          )}

          {preview.accountsToCreate.length > 0 ? (
            <p className="text-sm text-slate-700">
              Er wordt een inlogaccount aangemaakt voor: {preview.accountsToCreate.join(', ')}.
            </p>
          ) : null}

          {preview.notices.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                {preview.notices.length} opmerking(en)
              </summary>
              <div className="mt-2">
                <IssueList issues={preview.notices} />
              </div>
            </details>
          ) : null}

          {preview.changes.length > 0 ? (
            <details open={preview.changes.length <= 20}>
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                {preview.changes.length} wijziging(en)
              </summary>
              <ul className="mt-2 space-y-1 text-sm">
                {preview.changes.map((change, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Badge tone={change.action === 'create' ? 'success' : 'warning'} className={cx('shrink-0')}>
                      {change.action === 'create' ? 'nieuw' : 'bijgewerkt'}
                    </Badge>
                    <span>
                      <span className="text-slate-500">
                        {change.sheet}
                        {change.row ? ` r${change.row}` : ''}:
                      </span>{' '}
                      {change.text}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
