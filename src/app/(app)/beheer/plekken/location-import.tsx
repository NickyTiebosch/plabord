'use client';

import { useActionState, useState, useTransition } from 'react';
import { Card, Notice, SectionTitle, buttonClass, inputClass } from '@/components/ui';
import { importLocationsAction, type LocationImportState } from './actions';

/** De startlijst inlezen: kies een vestiging en het bestand, controleer, en lees in. */
export function LocationImport({ groups }: { groups: { id: string; name: string }[] }) {
  const [state, dispatch] = useActionState<LocationImportState, FormData>(importLocationsAction, { status: 'idle' });
  const [file, setFile] = useState<File | null>(null);
  const [checked, setChecked] = useState<{ file: File; groupId: string } | null>(null);
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '');
  const [pending, startTransition] = useTransition();

  function submit(intent: 'preview' | 'apply' | 'reset') {
    if (intent === 'preview' && file) setChecked({ file, groupId });
    const form = new FormData();
    form.set('intent', intent);
    form.set('groupId', groupId);
    if (file && intent !== 'reset') form.set('file', file);
    startTransition(() => dispatch(form));
  }

  const preview = state.preview;
  const canApply = Boolean(preview && preview.errors.length === 0 && file && checked?.file === file && checked.groupId === groupId);
  return (
    <Card className="space-y-3 p-4 lg:col-span-2">
      <SectionTitle>Lijst inlezen</SectionTitle>
      <p className="text-sm text-slate-600">
        Bijvoorbeeld het bestand Locatie huurauto’s: een kolom Kenteken met de plek ernaast. Onbekende plekken worden toegevoegd. Een auto
        die al ergens staat, verhuist naar de plek uit het bestand.
      </p>
      {state.status === 'done' ? (
        <>
          <Notice tone="success">
            {state.saved} auto’s ingelezen uit {state.fileName}.
          </Notice>
          <button type="button" className={buttonClass('secondary')} onClick={() => submit('reset')}>
            Nog een lijst inlezen
          </button>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-800">
              Vestiging
              <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className={`${inputClass} mt-1`}>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-800">
              Excel-bestand (.xlsx)
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:font-medium file:text-slate-800"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!file || pending} onClick={() => submit('preview')} className={buttonClass(canApply ? 'secondary' : 'primary')}>
              {pending ? 'Bezig…' : 'Controleren'}
            </button>
            {canApply ? (
              <button type="button" disabled={pending} onClick={() => submit('apply')} className={buttonClass('primary')}>
                {pending ? 'Bezig…' : 'Inlezen'}
              </button>
            ) : null}
          </div>
          {state.error ? <Notice tone="error">{state.error}</Notice> : null}
          {preview ? (
            <div className="space-y-2 text-sm">
              {preview.errors.length > 0 ? (
                <Notice tone="error">{preview.errors.map((issue) => issue.message).join(' ')}</Notice>
              ) : (
                <Notice tone="success">
                  {preview.count} auto’s gevonden.{' '}
                  {preview.newSpots.length > 0 ? `Nieuwe plekken: ${preview.newSpots.join(', ')}.` : 'Alle plekken bestaan al.'} Klik op Inlezen om op te slaan.
                </Notice>
              )}
              {preview.notices.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-slate-700">
                  {preview.notices.map((notice, index) => (
                    <li key={index}>
                      {notice.row ? `Regel ${notice.row}: ` : ''}
                      {notice.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
